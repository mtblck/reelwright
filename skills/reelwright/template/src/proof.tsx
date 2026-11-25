import React from 'react';
import {AbsoluteFill, Easing, Img, OffthreadVideo, interpolate, useCurrentFrame} from 'remotion';
import type {Scene} from './types';
import {Emph, asset, countUp, font, mix, rise, sceneColors, ts, useBrand, useLayout, usePop} from './ui';
import {Typed, Words} from './scenes';
import {useLook} from './looks';

// Scenes that prove a claim: a before and after, a real quote, an old-way/new-way table, the logos of
// what it works with, and a diagram of how it works. Quotes, names and numbers must be real (story.md).

type C = ReturnType<typeof sceneColors>;
type P = {scene: Scene; c: C};
const cue = (s: Scene, i = 0) => s.cues[Math.min(i, s.cues.length - 1)] ?? 0;
const isVideo = (f?: string) => /\.(mp4|webm|mov|m4v)$/i.test(f ?? '');
const Media: React.FC<{src: string; position?: string}> = ({src, position = 'top'}) =>
  isVideo(src) ? (
    <OffthreadVideo src={asset(src)} muted style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position}} />
  ) : (
    <Img src={asset(src)} style={{width: '100%', height: '100%', objectFit: 'cover', objectPosition: position}} />
  );

const Caption: React.FC<{scene: Scene; c: C; max: number}> = ({scene, c, max}) => {
  const b = useBrand();
  const {u, landscape} = useLayout();
  return scene.props.caption ? <div style={{maxWidth: max}}><Words text={scene.props.caption} at={cue(scene) + 4} size={(landscape ? 64 : 62) * u} color={c.ink} accent={b.accent} /></div> : null;
};

// before-after: two pictures or clips of the same view, and a slider that sweeps from one to the other.
// props: {before*, after*, labels? (["Before", "After"]), caption?, split? (stop the slider halfway)}
// reveals: 1 the before rises in; 2 the slider sweeps across to the after
export const BeforeAfter: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, width, vertical, landscape, tall} = useLayout();
  const frame = useCurrentFrame();
  const p = usePop(cue(scene), 16);
  const vw = width - 2 * (vertical ? 60 : landscape ? 200 : 70) * u;
  const vh = ((vertical ? 1300 : landscape ? 760 : 700 + tall * 0.8) * u) * (scene.props.caption ? 1 : 1.12);
  const at = scene.cues.length > 1 ? cue(scene, 1) : cue(scene) + 30;
  const end = scene.props.split ? 0.5 : 1;
  const x = interpolate(frame, [at, at + 34], [0, end], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.inOut(Easing.cubic)});
  const [l0, l1] = scene.props.labels ?? ['Before', 'After'];
  const handle = x > 0 && x < 1;
  const tag = (text: string, side: 'left' | 'right', on: number) => (
    <div style={{...font(b.text), position: 'absolute', top: 24 * u, [side]: 24 * u, fontSize: ts(30 * u), fontWeight: 700, padding: `${8 * u}px ${18 * u}px`, borderRadius: 99, background: side === 'right' ? b.accent : mix(b.dark, '#000000', 0.3), color: side === 'right' ? b.dark : b.paper, opacity: on}}>{text}</div>
  );
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 48 * u}}>
      <Caption scene={scene} c={c} max={vw} />
      <div data-match style={{width: vw, height: vh, position: 'relative', borderRadius: (b.radius ?? 20) * u, overflow: 'hidden', background: b.paper, boxShadow: `0 ${30 * u}px ${80 * u}px #00000030`, ...rise(p, u, 140)}}>
        <AbsoluteFill><Media src={scene.props.before} position={scene.props.position} /></AbsoluteFill>
        <AbsoluteFill style={{clipPath: `inset(0 0 0 ${(1 - x) * 100}%)`}}><Media src={scene.props.after} position={scene.props.position} /></AbsoluteFill>
        {tag(l0, 'left', interpolate(x, [0.7, 0.95], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))}
        {tag(l1, 'right', interpolate(x, [0.05, 0.3], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}))}
        {(handle || scene.props.split) && x > 0 && (
          <div style={{position: 'absolute', top: 0, bottom: 0, left: `${(1 - x) * 100}%`, width: 0}}>
            <div style={{position: 'absolute', top: 0, bottom: 0, left: -3 * u, width: 6 * u, background: b.paper, boxShadow: `0 0 ${16 * u}px #00000055`}} />
            <div style={{position: 'absolute', top: '50%', left: -32 * u, width: 64 * u, height: 64 * u, marginTop: -32 * u, borderRadius: 99, background: b.paper, boxShadow: `0 ${4 * u}px ${16 * u}px #00000055`, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
              <svg viewBox="0 0 24 24" width={34 * u} height={34 * u}><path d="M9 6l-5 6 5 6M15 6l5 6-5 6" fill="none" stroke={b.dark} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

// quote: a real comment, review or testimonial, and who said it.
// props: {text*, source* (a name or handle), detail? (where: "on GitHub", "issue #12"), avatar? (image)}
// reveals: 1 the quote; 2 the source
export const Quote: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.15 : 1;
  const q = usePop(cue(scene), 16);
  const s = usePop(scene.cues.length > 1 ? cue(scene, 1) : cue(scene) + 24);
  const text: string = scene.props.text ?? '';
  const size = (text.length > 110 ? 52 : text.length > 60 ? 62 : 76) * k * u;
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 90 : 130) * u, gap: 44 * u}}>
      <div style={{...font(b.display), fontSize: ts(220 * u), lineHeight: 0.6, height: 90 * u, color: b.accent, opacity: Math.min(1, q * 2)}}>“</div>
      <div style={{...font(b.display), ...rise(q, u, 30), fontSize: ts(size), lineHeight: 1.15, letterSpacing: -0.8 * u, color: c.ink, maxWidth: 1500 * u}}><Emph text={text} color={b.accent} /></div>
      <div style={{display: 'flex', alignItems: 'center', gap: 22 * u, ...rise(s, u, 20)}}>
        {scene.props.avatar && <Img src={asset(scene.props.avatar)} style={{width: 76 * u, height: 76 * u, borderRadius: 99, objectFit: 'cover'}} />}
        <div style={{...font(b.text), fontSize: ts(40 * k * u), lineHeight: 1.25}}>
          <div style={{color: c.ink, fontWeight: 700}}>{scene.props.source}</div>
          {scene.props.detail && <div style={{color: c.quiet}}>{scene.props.detail}</div>}
        </div>
      </div>
    </AbsoluteFill>
  );
};

// compare: the old way and the new way, row by row.
// props: {title?, headers? (["Before", "With <name>"]), rows* ([[old, new], ...], 2 to 4)}
// reveals: 1 the title and headers with the first row; then one row per phrase
export const Compare: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical} = useLayout();
  const k = vertical ? 1.1 : 1;
  const t = usePop(cue(scene));
  const rows: string[][] = scene.props.rows ?? [];
  const [h0, h1] = scene.props.headers ?? ['Before', `With ${b.name ?? 'it'}`];
  const cell = (on: number, good: boolean, text: string) => (
    <div style={{flex: 1, display: 'flex', alignItems: 'center', gap: 20 * u, padding: `${24 * k * u}px ${28 * u}px`, borderRadius: (b.radius ?? 20) * u, background: good ? mix(b.accent, c.bg, 0.86) : c.card, ...rise(on, u, 30)}}>
      <div style={{width: 46 * u, height: 46 * u, flex: 'none', borderRadius: 99, background: good ? b.accent : mix(c.ink, c.bg, 0.75), display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <svg viewBox="0 0 24 24" width={26 * u} height={26 * u}>{good ? <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke={b.dark} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /> : <path d="M7 7l10 10M17 7L7 17" fill="none" stroke={c.bg} strokeWidth="3" strokeLinecap="round" />}</svg>
      </div>
      <div style={{...font(b.text), fontSize: ts(40 * k * u), lineHeight: 1.2, fontWeight: good ? 700 : 500, color: good ? c.ink : c.quiet}}><Emph text={text} color={b.accent} /></div>
    </div>
  );
  return (
    <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 70 : 110) * u, gap: 26 * k * u}}>
      {scene.props.title && <div style={{...font(b.display), ...rise(t, u), fontSize: ts(80 * k * u), lineHeight: 1.05, letterSpacing: -1.5 * u, color: c.ink, marginBottom: 20 * u}}><Emph text={scene.props.title} color={b.accent} /></div>}
      <div style={{display: 'flex', gap: 20 * u, ...rise(t, u, 20)}}>
        {[h0, h1].map((h, i) => <div key={i} style={{...font(b.text), flex: 1, fontSize: ts(28 * k * u), fontWeight: 700, letterSpacing: 2 * u, textTransform: 'uppercase', color: i ? b.accent : c.quiet, paddingLeft: 28 * u}}>{h}</div>)}
      </div>
      {rows.map(([a, z], i) => <Row key={i} at={cue(scene, i)} render={(on) => <>{cell(on, false, a)}{cell(Math.max(0, on - 0.15) / 0.85, true, z)}</>} />)}
    </AbsoluteFill>
  );
};
const Row: React.FC<{at: number; render: (on: number) => React.ReactNode}> = ({at, render}) => {
  const {u} = useLayout();
  const p = usePop(at, 13);
  return <div style={{display: 'flex', gap: 20 * u}}>{render(p)}</div>;
};

// logo-wall: what it works with. props: {title?, logos* ([{image?, name}], 4 to 12; a logo with no image
// shows its name)}. reveals: 1 the title (if any) and the first group; the logos come in one group per phrase
export const LogoWall: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical, landscape} = useLayout();
  const t = usePop(cue(scene));
  const logos: {image?: string; name: string}[] = scene.props.logos ?? [];
  // as even as the rows can be: 6 logos in a square are 3 + 3, not 4 + 2
  const most = vertical ? 3 : landscape ? 6 : 4;
  const cols = Math.ceil(logos.length / Math.ceil(logos.length / most));
  const groups = Math.max(1, Math.min(scene.cues.length, logos.length));
  const tile = (vertical ? 270 : landscape ? 230 : 210) * u;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: 80 * u, gap: 60 * u}}>
      {scene.props.title && <div style={{...font(b.display), ...rise(t, u), fontSize: ts(76 * u), lineHeight: 1.05, letterSpacing: -1.4 * u, color: c.ink, textAlign: 'center', maxWidth: 1400 * u}}><Emph text={scene.props.title} color={b.accent} /></div>}
      <div style={{display: 'grid', gridTemplateColumns: `repeat(${cols}, ${tile}px)`, gap: 26 * u, justifyContent: 'center'}}>
        {logos.map((l, i) => <Logo key={i} logo={l} size={tile} c={c} at={cue(scene, Math.floor((i * groups) / logos.length)) + (i % cols) * 3} />)}
      </div>
    </AbsoluteFill>
  );
};
const Logo: React.FC<{logo: {image?: string; name: string}; size: number; c: C; at: number}> = ({logo, size, c, at}) => {
  const b = useBrand();
  const {u} = useLayout();
  const p = usePop(at, 12);
  return (
    <div style={{width: size, height: size * 0.62, borderRadius: (b.radius ?? 20) * u, background: c.card, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 26 * u, boxSizing: 'border-box', opacity: Math.min(1, p * 1.6), transform: `scale(${0.8 + 0.2 * p})`}}>
      {logo.image ? <Img src={asset(logo.image)} style={{maxWidth: '100%', maxHeight: '100%', objectFit: 'contain'}} /> : <div style={{...font(b.display), fontSize: ts(34 * u), color: c.ink, textAlign: 'center', lineHeight: 1.1}}>{logo.name}</div>}
    </div>
  );
};

// diagram: how it works, as boxes joined by arrows: what goes in, the tool, what comes out.
// props: {nodes* ([{label, sub?}] or strings, 2 to 4), focus? (index of the node drawn in the accent;
// default the middle one), caption?}. reveals: 1 the first node; then each phrase draws an arrow and the next node
export const Diagram: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, vertical, landscape} = useLayout();
  const nodes: {label: string; sub?: string}[] = (scene.props.nodes ?? []).map((n: any) => (typeof n === 'string' ? {label: n} : n));
  const focus = scene.props.focus ?? Math.floor(nodes.length / 2);
  const across = !vertical;
  const n = nodes.length;
  const gap = (across ? (landscape ? 110 : 80) : 90) * u; // an arrow's length
  const room = (landscape ? 1600 : 940) * u; // the row's width
  const box = across ? {w: (room - (n - 1) * (gap + 32 * u)) / n, h: (landscape ? 240 : 220) * u} : {w: 720 * u, h: 170 * u};
  const size = across && !landscape ? 40 : 50;
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 70 * u, padding: 70 * u}}>
      <Caption scene={scene} c={c} max={1500 * u} />
      <div style={{display: 'flex', flexDirection: across ? 'row' : 'column', alignItems: 'center', gap: 16 * u}}>
        {nodes.map((nd, i) => (
          <React.Fragment key={i}>
            {i > 0 && <Arrow at={cue(scene, i)} across={across} len={gap} c={c} />}
            <Node at={cue(scene, i) + (i ? 10 : 0)} w={box.w} h={box.h} label={nd.label} sub={nd.sub} hot={i === focus} c={c} size={size} />
          </React.Fragment>
        ))}
      </div>
    </AbsoluteFill>
  );
};
const Node: React.FC<{at: number; w: number; h: number; label: string; sub?: string; hot: boolean; c: C; size: number}> = ({at, w, h, label, sub, hot, c, size}) => {
  const b = useBrand();
  const {u} = useLayout();
  const p = usePop(at, 13);
  return (
    <div style={{width: w, minHeight: h, borderRadius: (b.radius ?? 20) * u, background: hot ? b.accent : c.card, border: `${3 * u}px solid ${hot ? b.accent : mix(c.ink, c.bg, 0.8)}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 * u, boxSizing: 'border-box', textAlign: 'center', opacity: Math.min(1, p * 1.6), transform: `scale(${0.85 + 0.15 * p})`}}>
      <div style={{...font(b.display), fontSize: ts(size * u), lineHeight: 1.05, color: hot ? b.dark : c.ink}}>{label}</div>
      {sub && <div style={{...font(b.text), fontSize: ts(28 * u), lineHeight: 1.25, marginTop: 10 * u, color: hot ? mix(b.dark, b.accent, 0.25) : c.quiet}}>{sub}</div>}
    </div>
  );
};
// an arrow that draws itself from one node to the next
const Arrow: React.FC<{at: number; across: boolean; len: number; c: C}> = ({at, across, len, c}) => {
  const {u} = useLayout();
  const frame = useCurrentFrame();
  const t = interpolate(frame, [at, at + 12], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const head = interpolate(frame, [at + 8, at + 14], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const L = len - 16 * u;
  const sw = 5 * u;
  return (
    <svg width={across ? len : 40 * u} height={across ? 40 * u : len} style={{flex: 'none', overflow: 'visible'}}>
      <g transform={across ? `translate(${8 * u}, ${20 * u})` : `translate(${20 * u}, ${8 * u}) rotate(90)`}>
        <line x1={0} y1={0} x2={L} y2={0} stroke={c.ink} strokeWidth={sw} strokeLinecap="round" strokeDasharray={L} strokeDashoffset={(1 - t) * L} />
        <path d={`M${L - 14 * u} ${-13 * u} L${L} 0 L${L - 14 * u} ${13 * u}`} fill="none" stroke={c.ink} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" opacity={head} />
      </g>
    </svg>
  );
};

// chart: numbers that grow, as bars or a line: a benchmark, growth over time, a before and after.
// props: {data* ([{label, value}], 2 to 8; value a number or text with one in it: 1.3, "1.3 s", "12,000+"),
// kind? ('bar' default, or 'line'), title?, highlight? (index in the accent; default the largest), source?}
// reveals: 1 the title and the first group; the bars or points come in one group per phrase
type Datum = {label: string; value: string | number};
const num = (v: string | number) => {
  const n = parseFloat(String(v).replace(/,/g, '').match(/[0-9]*\.?[0-9]+/)?.[0] ?? '');
  return isFinite(n) ? n : 0;
};
export const Chart: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, width, height, vertical, landscape, tall} = useLayout();
  const frame = useCurrentFrame();
  const look = useLook();
  const data: Datum[] = (scene.props.data ?? []).slice(0, 8);
  const n = Math.max(1, data.length);
  const vals = data.map((d) => num(d.value));
  const max = Math.max(...vals, 0) || 1;
  const hot: number = scene.props.highlight ?? vals.lastIndexOf(Math.max(...vals));
  // one group per phrase, as even as they can be; inside a group each bar or point follows the last by 5 frames
  const groups = Math.max(1, Math.min(scene.cues.length, n));
  const at = (i: number) => {
    const g = Math.floor((i * groups) / n);
    return cue(scene, g) + (i - Math.ceil((g * n) / groups)) * 5;
  };
  const grow = (i: number, delay = 0) => interpolate(frame, [at(i) + delay, at(i) + delay + 22], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
  const t = usePop(cue(scene));
  const title: string | undefined = scene.props.title;
  const muted = mix(c.ink, c.bg, 0.72);

  if (look.text === 'type' && scene.props.kind !== 'line') {
    // a terminal prints bars of block characters, each growing to its length, the value after it
    const cols = vertical ? 12 : landscape ? 28 : 16;
    const labels = data.map((d) => String(d.label).slice(0, 14));
    const L = Math.max(...labels.map((l) => l.length));
    return (
      <AbsoluteFill style={{justifyContent: 'center', padding: (vertical ? 80 : 110) * u, gap: 18 * u}}>
        {title && <div style={{...font(b.display), fontSize: ts(56 * u), lineHeight: 1.3, marginBottom: 20 * u}}><Typed text={`# ${title.replace(/\*/g, '')}`} at={cue(scene)} color={c.quiet} accent={c.quiet} /></div>}
        {data.map((d, i) => {
          const g = grow(i);
          return (
            <div key={i} style={{...font(b.display), fontSize: ts((vertical ? 50 : 60) * u), lineHeight: 1.25, whiteSpace: 'pre', opacity: g > 0 ? 1 : 0}}>
              <span style={{color: c.quiet}}>{labels[i].padEnd(L)} </span>
              <span style={{color: i === hot ? b.accent : c.ink}}>{'█'.repeat(Math.round((cols * vals[i] * g) / max))}</span>
              <span style={{color: i === hot ? b.accent : c.ink}}> {countUp(String(d.value), g)}</span>
            </div>
          );
        })}
        {scene.props.source && <div style={{...font(b.text), fontSize: ts(40 * u), lineHeight: 1.3, marginTop: 20 * u, color: c.quiet, opacity: Math.min(1, t * 1.4)}}>{`# ${scene.props.source}`}</div>}
      </AbsoluteFill>
    );
  }

  const pad = (vertical ? 70 : landscape ? 150 : 90) * u;
  const W = Math.min(width - 2 * pad, (landscape ? 1500 : 940) * u);
  const H = (vertical ? 760 : landscape ? 480 : 400 + tall * 0.8) * u;
  // burned-in captions sit low in the frame (a quarter up in the vertical cut): keep the chart above them
  const under = Math.max(pad, height * (vertical ? 0.3 : 0.15));
  const slot = W / n;
  const vs = (n <= 4 ? 46 : n <= 6 ? 40 : 34) * (vertical ? 1.1 : 1) * u; // value size
  const top = H - vs * 1.7; // the tallest bar or point, with room for its value over it
  const x = (i: number) => slot * (i + 0.5);
  const y = (i: number) => H - (vals[i] / max) * top;
  const value = (i: number, bottom: number, g: number) => (
    <div style={{...font(b.display), position: 'absolute', left: x(i), bottom, transform: 'translateX(-50%)', whiteSpace: 'nowrap', fontSize: ts(vs), lineHeight: 1, color: c.ink, opacity: Math.min(1, g * 3)}}>{countUp(String(data[i].value), g)}</div>
  );

  let plot: React.ReactNode;
  if (scene.props.kind === 'line') {
    const seg = data.map((_, i) => (i ? Math.hypot(x(i) - x(i - 1), y(i) - y(i - 1)) : 0));
    const total = seg.reduce((a, s) => a + s, 0) || 1;
    const drawn = seg.reduce((a, s, i) => a + s * (i ? grow(i) : 0), 0);
    // the shaded area follows the head of the line
    let head = x(0);
    for (let i = 1; i < n; i++) if (grow(i) > 0) head = x(i - 1) + (x(i) - x(i - 1)) * grow(i);
    const d = data.map((_, i) => `${i ? 'L' : 'M'}${x(i)} ${y(i)}`).join(' ');
    plot = (
      <>
        <svg width={W} height={H} style={{position: 'absolute', inset: 0, overflow: 'visible'}}>
          <defs><clipPath id={`area-${scene.start}`}><rect x={0} y={0} width={head} height={H} /></clipPath></defs>
          <path d={`${d} L${x(n - 1)} ${H} L${x(0)} ${H} Z`} fill={c.ink} opacity={0.07} clipPath={`url(#area-${scene.start})`} />
          <path d={d} fill="none" stroke={c.ink} strokeWidth={6 * u} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={total} strokeDashoffset={total - drawn} />
          {data.map((_, i) => {
            const p = grow(i, i ? 10 : 0);
            return <circle key={i} cx={x(i)} cy={y(i)} r={(i === hot ? 17 : 11) * u * p} fill={i === hot ? b.accent : c.bg} stroke={i === hot ? b.accent : c.ink} strokeWidth={5 * u} opacity={p > 0 ? 1 : 0} />;
          })}
        </svg>
        {data.map((_, i) => <React.Fragment key={i}>{value(i, H - y(i) + 30 * u, grow(i, i ? 10 : 0))}</React.Fragment>)}
      </>
    );
  } else {
    const bw = Math.min(slot * 0.62, 220 * u);
    const r = Math.min(bw / 4, (b.radius ?? 20) * u * 0.6);
    plot = data.map((_, i) => {
      const g = grow(i);
      const h = (vals[i] / max) * top * g;
      return (
        <React.Fragment key={i}>
          <div style={{position: 'absolute', bottom: 0, left: x(i) - bw / 2, width: bw, height: h, borderRadius: `${r}px ${r}px 0 0`, background: i === hot ? b.accent : muted}} />
          {value(i, h + 14 * u, g)}
        </React.Fragment>
      );
    });
  }

  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', padding: `${pad}px ${pad}px ${under}px`, gap: 50 * u}}>
      {title && <div style={{...font(b.display), ...rise(t, u), fontSize: ts(76 * u), lineHeight: 1.05, letterSpacing: -1.4 * u, color: c.ink, textAlign: 'center', maxWidth: 1400 * u}}><Emph text={title} color={b.accent} /></div>}
      <div style={{width: W}}>
        <div style={{position: 'relative', width: W, height: H}}>
          {plot}
          <div style={{position: 'absolute', left: 0, right: 0, bottom: -1.5 * u, height: 3 * u, background: muted, opacity: Math.min(1, t * 1.4)}} />
        </div>
        <div style={{display: 'flex', marginTop: 20 * u}}>
          {data.map((d, i) => (
            <div key={i} style={{...font(b.text), width: slot, padding: `0 ${6 * u}px`, boxSizing: 'border-box', textAlign: 'center', fontSize: ts((n <= 4 ? 34 : 28) * (vertical ? 1.1 : 1) * u), lineHeight: 1.2, fontWeight: i === hot ? 700 : 500, color: i === hot ? c.ink : c.quiet, opacity: Math.min(1, grow(i) * 3)}}>{d.label}</div>
          ))}
        </div>
      </div>
      {scene.props.source && <div style={{...font(b.text), fontSize: ts(28 * u), color: c.quiet, opacity: Math.min(1, t * 1.4)}}>{scene.props.source}</div>}
    </AbsoluteFill>
  );
};

export const PROOF_SCENES = {'before-after': BeforeAfter, quote: Quote, compare: Compare, 'logo-wall': LogoWall, diagram: Diagram, chart: Chart};
