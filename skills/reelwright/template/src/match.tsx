import React, {useLayoutEffect, useState} from 'react';
import {AbsoluteFill, Easing, continueRender, delayRender, interpolate, useCurrentFrame} from 'remotion';
import {mix, useBrand} from './ui';

// A match cut: the main shape of one scene (its device, window, frame or mark, tagged data-match)
// becomes the main shape of the next. Over the transition the rest of the old scene fades out behind
// a plain copy of its shape, the copy moves and reshapes onto the new scene's shape, and the new scene
// fades up underneath it. Shapes are measured from the page at render time, with their pop-in
// transforms switched off, so the copy lands where the new shape comes to rest.

type Box = {x: number; y: number; w: number; h: number; r: number; fill: string};

// where an element sits in its scene at rest: the transforms between it and the scene's root (pop-ins,
// tilts) are switched off for the moment it's measured, then put back
const measure = (root: Element | null): Box | null => {
  const el = root?.querySelector('[data-match]') as HTMLElement | null;
  if (!root || !el) return null;
  const held: [HTMLElement, string][] = [];
  for (let n: HTMLElement | null = el; n && n !== root; n = n.parentElement) { held.push([n, n.style.transform]); n.style.transform = 'none'; }
  const r = el.getBoundingClientRect(), o = root.getBoundingClientRect();
  held.forEach(([n, t]) => { n.style.transform = t; });
  const k = (root as HTMLElement).offsetWidth / (o.width || 1); // the page may be shown scaled
  const cs = getComputedStyle(el);
  const fill = cs.backgroundColor && cs.backgroundColor !== 'rgba(0, 0, 0, 0)' ? cs.backgroundColor : '';
  return {x: (r.left - o.left) * k, y: (r.top - o.top) * k, w: r.width * k, h: r.height * k, r: parseFloat(cs.borderTopLeftRadius) || 0, fill};
};

export const MATCH_LEN = 18;

export const MatchLayer: React.FC<{from: number; to: number; fromBg: string; toBg: string}> = ({from, to, fromBg, toBg}) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const [boxes, setBoxes] = useState<[Box | null, Box | null] | null>(null);
  const [handle] = useState(() => delayRender('match cut: measuring'));
  useLayoutEffect(() => {
    // measure once the page has laid out (on mount the scenes may not have sizes yet)
    const id = requestAnimationFrame(() => {
      setBoxes([measure(document.querySelector(`[data-scene="${from}"]`)), measure(document.querySelector(`[data-scene="${to}"]`))]);
      continueRender(handle);
    });
    return () => cancelAnimationFrame(id);
  }, [from, to, handle]);
  if (!boxes) return null;
  const [a, z] = boxes;
  const t = (lo: number, hi: number, e = Easing.inOut(Easing.cubic)) => interpolate(frame, [lo * MATCH_LEN, hi * MATCH_LEN], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: e});
  const cover = t(0, 0.3); // the old scene's other content fades out
  const move = t(0.2, 0.8); // the shape travels
  const reveal = t(0.8, 1); // the new scene comes up under it
  if (!a || !z) return <AbsoluteFill style={{background: mix(fromBg, toBg, move), opacity: cover * (1 - reveal)}} />; // nothing to match: a dip through the colours
  const lerp = (p: number, q: number) => p + (q - p) * move;
  const box = {x: lerp(a.x, z.x), y: lerp(a.y, z.y), w: lerp(a.w, z.w), h: lerp(a.h, z.h), r: lerp(a.r, z.r)};
  return (
    <AbsoluteFill style={{pointerEvents: 'none', opacity: 1 - reveal}}>
      <AbsoluteFill style={{background: mix(fromBg, toBg, move), opacity: cover}} />
      <div style={{position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, borderRadius: box.r, background: move < 0.5 ? a.fill || 'transparent' : z.fill || 'transparent', border: `${Math.max(3, Math.min(box.w, box.h) * 0.012)}px solid ${b.accent}`, boxSizing: 'border-box', opacity: Math.min(1, cover * 1.5)}} />
    </AbsoluteFill>
  );
};
