import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {CursorLayer, coverMap} from './product';
import type {Scene} from './types';
import {Emph, asset, font, mix, rise, sceneColors, ts, useBrand, useFade, useLayout, usePop} from './ui';
import {useLook} from './looks';

type C = ReturnType<typeof sceneColors>;
type P = {scene: Scene; c: C};
const cue = (s: Scene, i = 0) => s.cues[Math.min(i, s.cues.length - 1)] ?? 0;

// Text that types on from a frame, a character at a time behind a block cursor that blinks for a
// second after the last character, then goes. Characters not yet typed hold their place (invisible),
// so lines never reflow as they type. *stars* still set words in the accent.
const CPS = 40; // characters a second
export const Typed: React.FC<{text: string; at: number; color: string; accent: string}> = ({text, at, color, accent}) => {
  const frame = useCurrentFrame();
  const parts = text.split(/(\*[^*]+\*)/).filter(Boolean).map((t) => (t.startsWith('*') && t.endsWith('*') ? {t: t.slice(1, -1), hot: true} : {t, hot: false}));
  const total = parts.reduce((n, p) => n + p.t.length, 0);
  const shown = Math.max(0, Math.floor(((frame - at) / 30) * CPS));
  const done = at + Math.ceil((total / CPS) * 30);
  const cursorOn = frame >= at && frame < done + 30 && (frame < done || Math.floor((frame - done) / 8) % 2 === 0);
  // the cursor sits after the last typed character, but before any spaces just typed, so it never
  // hangs off the end of a line that is about to wrap
  const flat = parts.map((p) => p.t).join('');
  let at2 = Math.min(shown, total);
  while (at2 > 0 && flat[at2 - 1] === ' ' && at2 < total) at2--;
  let k = 0;
  const glow = (c: string) => `0 0 0.14em ${c}66`;
  const out: React.ReactNode[] = [];
  parts.forEach((p, i) => {
    const col = p.hot ? accent : color;
    const vis = Math.max(0, Math.min(p.t.length, shown - k));
    // the cursor belongs to the part it follows (so it stays on the line of the character before it)
    const c = cursorOn && ((at2 > k && at2 <= k + p.t.length) || (at2 === 0 && i === 0)) ? at2 - k : -1;
    const cut = c >= 0 ? c : vis;
    // the last typed character and the cursor stay together (no line break between them)
    const tail = c > 0 ? 1 : 0;
    out.push(<span key={`v${i}`} style={{color: col, textShadow: glow(col)}}>{p.t.slice(0, cut - tail)}</span>);
    if (c >= 0) out.push(<span key="c" style={{color: col, textShadow: glow(col), whiteSpace: 'nowrap'}}>{p.t.slice(cut - tail, cut)}<Cursor color={col} /></span>);
    if (vis > cut) out.push(<span key={`s${i}`} style={{color: col}}>{p.t.slice(cut, vis)}</span>);
    out.push(<span key={`h${i}`} style={{opacity: 0}}>{p.t.slice(vis)}</span>);
    k += p.t.length;
  });
  return <>{out}</>;
};
// a block cursor that takes no room, wide or tall, so it never pushes a line along or makes it taller
const Cursor: React.FC<{color: string}> = ({color}) => (
  <span style={{position: 'relative', display: 'inline-block', width: 0, height: 0}}>
    <span style={{position: 'absolute', left: '0.04em', bottom: '-0.2em', width: '0.55em', height: '0.95em', background: color, boxShadow: `0 0 0.2em ${color}88`}} />
  </span>
);

// Big words, a word at a time from the phrase's cue (or typed on, under a look that types).
export const Words: React.FC<{text: string; at: number; size: number; color: string; accent: string; align?: 'left' | 'center'; step?: number}> = ({text, at, size, color, accent, align = 'center', step = 3}) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const look = useLook();
  if (look.text === 'type')
    return <div style={{...font(b.display), fontSize: ts(size), lineHeight: 1.12, letterSpacing: -0.01 * ts(size), textAlign: align, textWrap: 'balance' as any}}><Typed text={text} at={at} color={color} accent={accent} /></div>;
  const words = text.split(' ');
  let star = false;
  return (
    <div style={{...font(b.display), fontSize: ts(size), lineHeight: 1.08, letterSpacing: -0.02 * ts(size), color, textAlign: align, textWrap: 'balance' as any}}>
      {words.map((w, i) => {
        const open = w.startsWith('*');
        const close = w.replace(/[.,!?:;]+$/, '').endsWith('*');
        const hot = star || open;
        star = open ? !close : star && !close;
        const p = interpolate(frame, [at + i * step, at + i * step + 7], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
        return <span key={i} style={{display: 'inline-block', marginRight: '0.24em', opacity: p, transform: `translateY(${(1 - p) * 0.25}em)`, color: hot ? accent : color}}>{w.replace(/\*/g, '')}</span>;
      })}
    </div>
  );
};

const Mark: React.FC<{src?: string; size: number; at?: number}> = ({src, size, at = 0}) => {
  const p = usePop(at, 11);
  if (!src) return null;
  return <Img src={asset(src)} style={{width: size, height: size, transform: `scale(${p}) rotate(${(1 - p) * -8}deg)`}} />;
};

// title: mark pops, name, tagline.  props: {name?, tagline?}
export const Title: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.25 : 1;
  const name = usePop(cue(scene, 0) + 6);
  const tag = usePop(cue(scene, 1) + 2);
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 40 * u, padding: 90 * u}}>
      <Mark src={c.mark} size={(vertical ? 300 : 240) * u} at={2} />
      <div style={{...font(b.display), ...rise(name, u), fontSize: ts(128 * k * u), letterSpacing: -2.5 * u, color: c.ink, lineHeight: 1}}>
        <Emph text={scene.props.name ?? b.name} color={b.accent} />
      </div>
      {(scene.props.tagline ?? b.tagline) && (
        <div style={{...font(b.text), ...rise(tag, u, 24), fontSize: ts(46 * k * u), color: c.quiet, textAlign: 'center', maxWidth: 760 * u, lineHeight: 1.25, textWrap: 'balance' as any}}>
          <Emph text={scene.props.tagline ?? b.tagline!} color={b.accent} />
        </div>
      )}
    </AbsoluteFill>
  );
};

// statement: one big line, word by word, optional kicker above.  props: {text*, kicker?}
export const Statement: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = useFade(cue(scene));
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 90 : 110) * u, gap: 36 * u}}>
      {scene.props.kicker && <div style={{...font(b.text), opacity: k, fontSize: ts(34 * u), letterSpacing: 4 * u, textTransform: 'uppercase', color: b.accent, fontWeight: 700}}>{scene.props.kicker}</div>}
      <Words text={scene.props.text} at={cue(scene) + 2} size={(vertical ? 112 : 104) * u} color={c.ink} accent={b.accent} align="left" />
    </AbsoluteFill>
  );
};

// screen: a real screenshot or screen clip in a browser or phone frame, with a caption.
// props: {image? | video?, frame: 'browser'|'phone', caption*, url?, zoom?: [from, to]}
export const Screen: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical, landscape} = useLayout();
  const frame = useCurrentFrame();
  const p = usePop(cue(scene), 16);
  const phone = scene.props.frame === 'phone';
  const [z0, z1] = scene.props.zoom ?? [1, 1.06];
  const zoom = interpolate(frame, [0, scene.dur], [z0, z1]);
  const r = (b.radius ?? 20) * u;
  const media = scene.props.video ? (
    <OffthreadVideo src={asset(scene.props.video)} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top'}} />
  ) : (
    <Img src={asset(scene.props.image)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: scene.props.position ?? 'top', transform: `scale(${zoom})`, transformOrigin: 'top center'}} />
  );
  const bw = landscape ? 1080 * u : vertical ? 960 * u : 900 * u;
  const bh = landscape ? 680 * u : vertical ? 1000 * u : 600 * u;
  const pw = (vertical ? 640 : landscape ? 410 : 380) * u;
  // a cursor over the picture: its box is the device's screen, and the picture fills it as object-fit: cover does
  const [iw, ih] = scene.props.mediaSize ?? [1, 1];
  const [sw, sh] = phone ? [pw - 32 * u, pw * 2.16 - 32 * u] : [bw - 4 * u, bh - 60 * u];
  const pointer = scene.props.cursor && scene.props.mediaSize ? (
    <CursorLayer scene={scene} points={scene.props.cursor} w={sw} h={sh} map={coverMap(iw, ih, sw, sh, scene.props.video ? 'top' : scene.props.position === 'center' ? 'center' : 'top', scene.props.video ? 1 : Number(zoom))} />
  ) : null;
  const device = phone ? (
    <div style={{width: pw, height: pw * 2.16, borderRadius: 64 * u, padding: 16 * u, background: '#0b0b0c', boxShadow: `0 ${30 * u}px ${80 * u}px ${mix(b.dark, '#000000', 0.5)}55`}}>
      <div style={{width: '100%', height: '100%', borderRadius: 50 * u, overflow: 'hidden', background: b.paper, position: 'relative'}}>{media}{pointer}</div>
    </div>
  ) : (
    <div style={{width: bw, height: bh, borderRadius: r, overflow: 'hidden', background: b.paper, border: `${2 * u}px solid ${mix(c.ink, c.bg, 0.85)}`, boxShadow: `0 ${30 * u}px ${80 * u}px #00000030`, display: 'flex', flexDirection: 'column'}}>
      <div style={{height: 56 * u, flex: 'none', display: 'flex', alignItems: 'center', gap: 12 * u, padding: `0 ${22 * u}px`, background: mix(b.ink, b.paper, 0.93)}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 16 * u, height: 16 * u, borderRadius: 99, background: mix(b.ink, b.paper, 0.7)}} />)}
        {scene.props.url && <div style={{...font(b.text), marginLeft: 20 * u, flex: 1, height: 34 * u, borderRadius: 99, background: b.paper, fontSize: ts(20 * u), color: mix(b.ink, b.paper, 0.45), display: 'flex', alignItems: 'center', paddingLeft: 20 * u}}>{scene.props.url}</div>}
      </div>
      <div style={{flex: 1, overflow: 'hidden', position: 'relative'}}>{media}{pointer}</div>
    </div>
  );
  // A phone is too tall to stack under a caption in a square frame, so it sits beside it there too.
  const side = phone && !vertical;
  const caption = <Words text={scene.props.caption} at={cue(scene) + 4} size={(landscape ? 76 : 72) * u} color={c.ink} accent={b.accent} align={side ? 'left' : 'center'} />;
  const dev = <div style={{transform: `translateY(${(1 - p) * 160 * u}px) scale(${0.92 + 0.08 * p})`, opacity: Math.min(1, p * 2)}}>{device}</div>;
  return side ? (
    <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: (landscape ? 100 : 70) * u, padding: 80 * u}}>
      <div style={{flex: 1, minWidth: 0, maxWidth: 900 * u}}>{caption}</div>
      {dev}
    </AbsoluteFill>
  ) : (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 56 * u, padding: 70 * u}}>
      <div style={{maxWidth: 960 * u}}>{caption}</div>
      {dev}
    </AbsoluteFill>
  );
};

// features: a title and up to four items that pop in, one per phrase.  props: {title*, items: string[]}
export const Features: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.3 : 1;
  const t = usePop(cue(scene, 0));
  const items: string[] = scene.props.items ?? [];
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 90 : 110) * u, gap: 56 * k * u}}>
      <div style={{...font(b.display), ...rise(t, u), fontSize: ts(92 * k * u), lineHeight: 1.05, letterSpacing: -1.6 * u, color: c.ink}}>
        <Emph text={scene.props.title} color={b.accent} />
      </div>
      <div style={{display: 'flex', flexDirection: 'column', gap: 30 * k * u}}>
        {items.map((it, i) => <Item key={i} text={it} at={cue(scene, i + 1)} c={c} k={k} />)}
      </div>
    </AbsoluteFill>
  );
};
const Item: React.FC<{text: string; at: number; c: C; k: number}> = ({text, at, c, k}) => {
  const b = useBrand();
  const {u} = useLayout();
  const p = usePop(at, 12);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 28 * u, opacity: Math.min(1, p * 1.5), transform: `translateX(${(1 - p) * -60 * u}px)`}}>
      <div style={{width: 64 * k * u, height: 64 * k * u, flex: 'none', borderRadius: 99, background: b.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: `scale(${p})`}}>
        <svg viewBox="0 0 24 24" width={34 * k * u} height={34 * k * u}><path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={b.dark} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </div>
      <div style={{...font(b.text), fontSize: ts(54 * k * u), lineHeight: 1.15, color: c.ink, fontWeight: 600}}><Emph text={text} color={b.accent} /></div>
    </div>
  );
};

// stat: one big number that counts up, and a label.  props: {value* (e.g. "12,000+" or "0"), label*}
export const Stat: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.2 : 1;
  const frame = useCurrentFrame();
  const raw: string = String(scene.props.value);
  const n = parseFloat(raw.replace(/[^0-9.]/g, ''));
  const t = interpolate(frame, [cue(scene), cue(scene) + 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const dec = (raw.match(/[0-9]\.([0-9]+)/)?.[1] ?? '').length;
  const now = n * (1 - Math.pow(1 - t, 3));
  const shown = isFinite(n) && n > 0 ? raw.replace(/[0-9][0-9,.]*/, now.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec})) : raw;
  const l = usePop(cue(scene, 1));
  const look = useLook();
  if (look.text === 'type')
    // a terminal prints the number, it doesn't count up: typed, left-aligned, with the label as a comment
    return (
      <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 90 : 110) * u, gap: 12 * u}}>
        <div style={{...font(b.display), fontSize: ts(170 * k * u), lineHeight: 1.1, whiteSpace: 'nowrap'}}><span style={{color: c.quiet}}>{'> '}</span><Typed text={raw} at={cue(scene)} color={b.accent} accent={b.accent} /></div>
        <div style={{...font(b.text), fontSize: ts(56 * k * u), lineHeight: 1.3}}><Typed text={`# ${String(scene.props.label).replace(/\*/g, '')}`} at={cue(scene, 1)} color={c.quiet} accent={c.quiet} /></div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 24 * u, padding: 90 * u}}>
      <div style={{...font(b.display), fontSize: ts(300 * k * u), lineHeight: 1, letterSpacing: -8 * u, color: b.accent, opacity: Math.min(1, t * 3)}}>{shown}</div>
      <div style={{...font(b.text), ...rise(l, u, 24), fontSize: ts(52 * k * u), color: c.ink, textAlign: 'center', maxWidth: 860 * u, lineHeight: 1.2, fontWeight: 600}}><Emph text={scene.props.label} color={b.accent} /></div>
    </AbsoluteFill>
  );
};

// steps: numbered steps in a row (landscape) or a column, one per phrase.  props: {title?, steps: string[]}
export const Steps: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, landscape} = useLayout();
  const t = usePop(cue(scene, 0));
  const steps: string[] = scene.props.steps ?? [];
  const off = scene.props.title ? 1 : 0;
  return (
    <AbsoluteFill style={{justifyContent: 'center', alignItems: 'center', padding: 100 * u, gap: 56 * u}}>
      {scene.props.title && <div style={{...font(b.display), ...rise(t, u), fontSize: ts(80 * u), color: c.ink, letterSpacing: -1.5 * u, textAlign: 'center'}}><Emph text={scene.props.title} color={b.accent} /></div>}
      <div style={{display: 'flex', flexDirection: landscape ? 'row' : 'column', gap: 30 * u, width: '100%'}}>
        {steps.map((s, i) => <Step key={i} n={i + 1} text={s} at={cue(scene, i + off)} c={c} />)}
      </div>
    </AbsoluteFill>
  );
};
const Step: React.FC<{n: number; text: string; at: number; c: C}> = ({n, text, at, c}) => {
  const b = useBrand();
  const {u} = useLayout();
  const p = usePop(at, 13);
  return (
    <div style={{flex: 1, ...rise(p, u, 50), background: c.card, borderRadius: (b.radius ?? 20) * u, padding: `${34 * u}px ${36 * u}px`, display: 'flex', alignItems: 'center', gap: 28 * u}}>
      <div style={{...font(b.display), fontSize: ts(72 * u), color: b.accent, lineHeight: 1}}>{n}</div>
      <div style={{...font(b.text), fontSize: ts(44 * u), color: c.ink, fontWeight: 600, lineHeight: 1.15}}><Emph text={text} color={b.accent} /></div>
    </div>
  );
};

// end: mark, name, a button that gets pressed, the URL.  props: {button*, url?}
export const End: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.25 : 1;
  const frame = useCurrentFrame();
  const n = usePop(cue(scene, 0) + 4);
  const btn = usePop(cue(scene, 0) + 12);
  const press = cue(scene, 1) + 6;
  const down = interpolate(frame, [press, press + 4, press + 10], [1, 0.93, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const url = useFade(press + 8);
  const fg = c.bg === b.paper ? b.paper : b.dark;
  const fill = c.bg === b.paper ? b.primary : b.accent;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 44 * u, padding: 90 * u}}>
      <Mark src={c.mark} size={200 * k * u} at={cue(scene, 0)} />
      <div style={{...font(b.display), ...rise(n, u), fontSize: ts(104 * k * u), color: c.ink, letterSpacing: -2 * u, lineHeight: 1}}>{b.name}</div>
      <div style={{...font(b.text), transform: `scale(${btn * down})`, background: fill, color: fg, fontSize: ts(46 * k * u), fontWeight: 700, padding: `${26 * k * u}px ${56 * k * u}px`, borderRadius: 999}}>{scene.props.button}</div>
      {(scene.props.url ?? b.url) && <div style={{...font(b.text), opacity: url, fontSize: ts(40 * k * u), color: c.quiet}}>{scene.props.url ?? b.url}</div>}
    </AbsoluteFill>
  );
};



// kinetic: huge words that slam in, one per phrase, each on its own colour.  props: {words*: string[], colors?: ('dark'|'paper'|'brand'|'accent')[], stack?: boolean}
// With stack, earlier words stay (dimmed) and the new one lands under them; without it each word replaces the last.
export const Kinetic: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const look = useLook();
  const {u, vertical} = useLayout();
  const frame = useCurrentFrame();
  const words: string[] = scene.props.words ?? [];
  const n = Math.max(0, words.reduce((m, _w, i) => (frame >= cue(scene, i) ? i : m), 0));
  const pal: Record<string, {bg: string; ink: string; hot: string}> = {
    dark: {bg: b.dark, ink: b.paper, hot: b.accent},
    paper: {bg: b.paper, ink: b.ink, hot: b.accent},
    brand: {bg: b.primary, ink: b.paper, hot: b.accent},
    accent: {bg: b.accent, ink: b.dark, hot: b.paper},
  };
  const col = pal[scene.props.colors?.[scene.props.stack ? 0 : n] ?? scene.bg] ?? pal.dark;
  // as big as it goes, but small enough that the longest line fits on one line (0.62 em a character
  // covers a mono face; proportional faces run narrower), so a beat never wraps mid-phrase
  const {width} = useVideoConfig();
  const longest = Math.max(1, ...words.map((w) => w.replace(/\*/g, '').length));
  const term = look.text === 'type'; // lines of a terminal: left-aligned behind a prompt, at a terminal's size
  const size = Math.min((term ? (vertical ? 120 : 110) : vertical ? 210 : 190) * u, (width - 160 * u) / ((longest + (term ? 2 : 0)) * 0.62 * (b.typeScale ?? 1)));
  const slam = (i: number) => {
    const p = usePop(cue(scene, i), 11);
    return {transform: `scale(${1.35 - 0.35 * p})`, opacity: Math.min(1, p * 2.2), filter: `blur(${Math.max(0, (1 - p) * 10 * u)}px)`};
  };
  const style = (i: number) => ({...font(b.display), fontSize: ts(size), lineHeight: term ? 1.25 : 0.98, letterSpacing: (term ? 0 : -0.035) * ts(size), color: col.ink, textAlign: (term ? 'left' : 'center') as 'left' | 'center', textWrap: (term ? 'nowrap' : 'balance') as any});
  const prompt = term ? <span style={{color: col.hot}}>{'> '}</span> : null;
  const pops = words.map((_, i) => slam(i));
  const flash = (n === 0 && !scene.props.flashFirst) || look.text === 'type' ? 0 : interpolate(frame - cue(scene, n), [0, 5], [0.35, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return (
    <AbsoluteFill style={{background: col.bg, alignItems: term ? 'flex-start' : 'center', justifyContent: 'center', padding: 80 * u}}>
      {scene.props.stack ? (
        <div style={{display: 'flex', flexDirection: 'column', alignItems: term ? 'flex-start' : 'center', gap: (term ? 0 : 10) * u}}>
          {/* every line is laid out from the first frame and only shown at its cue, so the stack never re-centres as it grows */}
          {words.map((w, i) => {
            const on = frame >= cue(scene, i);
            const typed = look.text === 'type';
            return <div key={i} style={{...style(i), ...(typed || !on ? {} : pops[i]), opacity: !on ? 0 : (typed ? 1 : (pops[i].opacity as number)) * (i < n ? 0.38 : 1)}}>{typed ? <>{prompt}<Typed text={w} at={cue(scene, i)} color={col.ink} accent={col.hot} /></> : <Emph text={w} color={col.hot} />}</div>;
          })}
        </div>
      ) : (
        look.text === 'type'
          ? <div key={n} style={style(n)}>{prompt}<Typed text={words[n] ?? ''} at={cue(scene, n)} color={col.ink} accent={col.hot} /></div>
          : <div key={n} style={{...style(n), ...pops[n]}}><Emph text={words[n] ?? ''} color={col.hot} /></div>
      )}
      <AbsoluteFill style={{background: col.hot, opacity: flash, pointerEvents: 'none'}} />
    </AbsoluteFill>
  );
};

// reframe: one frame snaps between shapes, a clip or image in each, one per phrase; a phrase after the last shape
// draws the shapes' outlines onto one centre (the three-cuts mark, if the brand has one like Reelwright's).
// props: {shapes*: [{aspect: '9:16'|'1:1'|'16:9'|number, video?, image?, label?}], assemble?: boolean}
const ratio = (a: any) => (typeof a === 'number' ? a : (([w, h]) => w / h)(String(a).split(':').map(Number)));
export const Reframe: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, width, height, vertical} = useLayout();
  const frame = useCurrentFrame();
  const shapes: any[] = scene.props.shapes ?? [];
  const k = shapes.length;
  // shape i eases in from cue i; s is a fractional shape index
  let s = 0;
  for (let i = 1; i < k; i++) s += usePop(cue(scene, i), 15) * 1;
  const lo = Math.min(k - 1, Math.floor(s)), hi = Math.min(k - 1, lo + 1), f = s - lo;
  const area = {w: width * (vertical ? 0.84 : 0.74), h: height * (vertical ? 0.6 : 0.62)};
  const fit = (r: number) => { const w = Math.min(area.w, area.h * r); return {w, h: w / r}; };
  const A = fit(ratio(shapes[lo]?.aspect ?? 1)), B = fit(ratio(shapes[hi]?.aspect ?? 1));
  const box = {w: A.w + (B.w - A.w) * f, h: A.h + (B.h - A.h) * f};
  // assembly
  const asm = scene.props.assemble !== false && k > 0 ? usePop(cue(scene, k), 16) : 0;
  const L = Math.min(width, height) * 0.42; // long side of the mark's frames
  const line = c.bg === b.paper ? b.primary : b.paper;
  const stroke = (16 / 208) * L;
  const intro = usePop(cue(scene, 0), 13);
  const label = shapes[Math.round(s)]?.label;
  const labelKey = Math.round(s);
  const lp = usePop(cue(scene, Math.min(labelKey, k - 1)) + 2, 12);
  const outline = (w: number, h: number, color: string, p: number, delay = 0) => {
    const q = Math.max(0, Math.min(1, p * 1.6 - delay));
    return <div style={{position: 'absolute', left: '50%', top: '50%', width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, border: `${stroke}px solid ${color}`, borderRadius: (10 / 208) * L, opacity: q, transform: `scale(${0.6 + 0.4 * q})`}} />;
  };
  const mediaOp = 1 - Math.min(1, asm * 2);
  const frameW = box.w + (L - box.w) * asm; // the screen frame becomes the mark's wide frame
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center'}}>
      <div style={{position: 'relative', width: frameW, height: box.h + ((L * 9) / 16 - box.h) * asm, transform: `scale(${0.85 + 0.15 * intro})`, opacity: Math.min(1, intro * 2)}}>
        <div style={{position: 'absolute', inset: 0, borderRadius: (b.radius ?? 20) * u * (1 - asm), overflow: 'hidden', background: c.card, opacity: mediaOp, boxShadow: `0 ${30 * u}px ${90 * u}px #00000055`}}>
          {shapes.map((sh, i) => {
            const op = Math.max(0, 1 - Math.abs(s - i) * 1.6);
            if (op <= 0) return null;
            const st = {position: 'absolute' as const, inset: 0, width: '100%', height: '100%', objectFit: 'cover' as const, opacity: op};
            return sh.video ? <OffthreadVideo key={i} src={asset(sh.video)} muted style={st} /> : sh.image ? <Img key={i} src={asset(sh.image)} style={st} /> : null;
          })}
        </div>
        {/* the frame's own edge, in the accent while it plays */}
        <div style={{position: 'absolute', inset: -stroke * 0.5, border: `${stroke * 0.5}px solid ${b.accent}`, borderRadius: (b.radius ?? 20) * u * (1 - asm) + stroke * 0.5, opacity: mediaOp * intro}} />
      </div>
      {asm > 0 && (
        <AbsoluteFill>
          {outline(L * (9 / 16), L, line, asm, 0)}
          {outline(L, L * (9 / 16), line, asm, 0.2)}
          {outline((149 / 208) * L, (149 / 208) * L, b.accent, asm, 0.45)}
        </AbsoluteFill>
      )}
      {label && (
        <div style={{position: 'absolute', bottom: (vertical ? 170 : 70) * u, left: 0, right: 0, textAlign: 'center', ...font(b.display), fontSize: ts((vertical ? 96 : 76) * u), letterSpacing: -1.5 * u, color: c.ink, opacity: Math.min(1, lp * 1.5) * mediaOp, transform: `translateY(${(1 - lp) * 30 * u}px)`}}>
          <Emph text={label} color={b.accent} />
          <span style={{...font(b.text), fontSize: ts((vertical ? 44 : 36) * u), color: b.accent, marginLeft: 22 * u, fontWeight: 700}}>{String(shapes[labelKey]?.aspect ?? '')}</span>
        </div>
      )}
      {scene.props.caption && (
        <div style={{position: 'absolute', bottom: (vertical ? 170 : 70) * u, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: Math.min(1, asm * 1.5)}}>
          <Words text={scene.props.caption} at={cue(scene, k) + 8} size={(vertical ? 96 : 76) * u} color={c.ink} accent={b.accent} />
        </div>
      )}
    </AbsoluteFill>
  );
};

export const SCENES = {title: Title, statement: Statement, screen: Screen, features: Features, stat: Stat, steps: Steps, end: End, kinetic: Kinetic, reframe: Reframe};
