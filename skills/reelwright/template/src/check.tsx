import {useEffect, useState} from 'react';
import {continueRender, delayRender} from 'remotion';

// render.mjs check: once the frame has laid out, list every piece of text on it with its size on screen,
// its colour and the colour behind it, where it sits, and how faded it is, as one console line that
// render.mjs reads. Nothing is drawn. Only rendered when props.check is set.
type RGBA = [number, number, number, number];
const rgba = (s: string): RGBA => {
  const m = s.match(/rgba?\(([^)]+)\)/);
  if (!m) return [0, 0, 0, 0];
  const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
};
// a over b, both straight (not premultiplied) colours
const over = (a: RGBA, b: RGBA): RGBA => {
  const al = a[3] + b[3] * (1 - a[3]);
  if (!al) return [0, 0, 0, 0];
  return [0, 1, 2].map((i) => (a[i] * a[3] + b[i] * b[3] * (1 - a[3])) / al).concat(al) as RGBA;
};

// what's behind an element: the background colours of it and its ancestors, laid over each other until
// one is solid. null when a picture or gradient is behind it (no one colour to measure against).
const behind = (el: Element): RGBA | null => {
  let acc: RGBA = [0, 0, 0, 0];
  for (let e: Element | null = el; e; e = e.parentElement) {
    const cs = getComputedStyle(e);
    if (cs.backgroundImage !== 'none') return null;
    const bg = rgba(cs.backgroundColor);
    if (bg[3] > 0) acc = acc[3] ? over(acc, bg) : bg;
    if (acc[3] >= 0.999) return acc;
  }
  return acc[3] ? over(acc, [255, 255, 255, 1]) : [255, 255, 255, 1];
};

export const Check: React.FC = () => {
  const [handle] = useState(() => delayRender('check: measuring text'));
  useEffect(() => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      const out: any[] = [];
      for (const el of Array.from(document.querySelectorAll('body *'))) {
        const texts = Array.from(el.childNodes).filter((n) => n.nodeType === 3 && (n.textContent ?? '').trim());
        const own = texts.map((n) => n.textContent ?? '').join('').replace(/\s+/g, ' ').trim();
        if (!own || el.closest('svg, [data-check-skip]')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        let op = 1;
        for (let e: Element | null = el; e; e = e.parentElement) op *= Number(getComputedStyle(e).opacity);
        const r = el.getBoundingClientRect();
        const he = (el as HTMLElement).offsetHeight;
        const k = he > 0 ? r.height / he : 1; // drawn bigger or smaller by a transform
        // where the letters are, not the whole box (a centred line in a full-width block)
        const ink = {l: Infinity, t: Infinity, r: -Infinity, b: -Infinity};
        for (const n of texts) {
          const range = document.createRange();
          range.selectNodeContents(n);
          for (const q of Array.from(range.getClientRects())) if (q.width && q.height) Object.assign(ink, {l: Math.min(ink.l, q.left), t: Math.min(ink.t, q.top), r: Math.max(ink.r, q.right), b: Math.max(ink.b, q.bottom)});
        }
        if (!isFinite(ink.l)) continue;
        const scene = el.closest('[data-scene]')?.getAttribute('data-scene');
        out.push({
          text: own, // its own words, counted once however deep the markup
          show: (el.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 60), // with any starred words inside it, to name it by
          px: parseFloat(cs.fontSize) * k,
          color: rgba(cs.color),
          bg: behind(el),
          op,
          box: [ink.l, ink.t, ink.r - ink.l, ink.b - ink.t],
          scene: scene == null ? null : Number(scene),
          caption: !!el.closest('[data-captions]'),
        });
      }
      console.log('RW-CHECK ' + JSON.stringify(out));
      continueRender(handle);
    };
    document.fonts.ready.then(() => requestAnimationFrame(() => requestAnimationFrame(finish)));
  }, [handle]);
  return null;
};
