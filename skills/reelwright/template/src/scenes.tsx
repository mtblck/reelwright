import React from 'react';
import {AbsoluteFill, Img, OffthreadVideo, interpolate, useCurrentFrame} from 'remotion';
import type {Scene} from './types';
import {Emph, asset, font, mix, rise, sceneColors, useBrand, useFade, useLayout, usePop} from './ui';

type C = ReturnType<typeof sceneColors>;
type P = {scene: Scene; c: C};
const cue = (s: Scene, i = 0) => s.cues[Math.min(i, s.cues.length - 1)] ?? 0;

// Big words, a word at a time from the phrase's cue.
const Words: React.FC<{text: string; at: number; size: number; color: string; accent: string; align?: 'left' | 'center'; step?: number}> = ({text, at, size, color, accent, align = 'center', step = 3}) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const words = text.split(' ');
  let star = false;
  return (
    <div style={{...font(b.display), fontSize: size, lineHeight: 1.08, letterSpacing: -0.02 * size, color, textAlign: align, textWrap: 'balance' as any}}>
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
      <div style={{...font(b.display), ...rise(name, u), fontSize: 128 * k * u, letterSpacing: -2.5 * u, color: c.ink, lineHeight: 1}}>
        <Emph text={scene.props.name ?? b.name} color={b.accent} />
      </div>
      {(scene.props.tagline ?? b.tagline) && (
        <div style={{...font(b.text), ...rise(tag, u, 24), fontSize: 46 * k * u, color: c.quiet, textAlign: 'center', maxWidth: 760 * u, lineHeight: 1.25, textWrap: 'balance' as any}}>
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
      {scene.props.kicker && <div style={{...font(b.text), opacity: k, fontSize: 34 * u, letterSpacing: 4 * u, textTransform: 'uppercase', color: b.accent, fontWeight: 700}}>{scene.props.kicker}</div>}
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
  const pw = (vertical ? 640 : landscape ? 410 : 400) * u;
  const device = phone ? (
    <div style={{width: pw, height: pw * 2.16, borderRadius: 64 * u, padding: 16 * u, background: '#0b0b0c', boxShadow: `0 ${30 * u}px ${80 * u}px ${mix(b.dark, '#000000', 0.5)}55`}}>
      <div style={{width: '100%', height: '100%', borderRadius: 50 * u, overflow: 'hidden', background: b.paper}}>{media}</div>
    </div>
  ) : (
    <div style={{width: bw, height: bh, borderRadius: r, overflow: 'hidden', background: b.paper, border: `${2 * u}px solid ${mix(c.ink, c.bg, 0.85)}`, boxShadow: `0 ${30 * u}px ${80 * u}px #00000030`, display: 'flex', flexDirection: 'column'}}>
      <div style={{height: 56 * u, flex: 'none', display: 'flex', alignItems: 'center', gap: 12 * u, padding: `0 ${22 * u}px`, background: mix(b.ink, b.paper, 0.93)}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 16 * u, height: 16 * u, borderRadius: 99, background: mix(b.ink, b.paper, 0.7)}} />)}
        {scene.props.url && <div style={{...font(b.text), marginLeft: 20 * u, flex: 1, height: 34 * u, borderRadius: 99, background: b.paper, fontSize: 20 * u, color: mix(b.ink, b.paper, 0.45), display: 'flex', alignItems: 'center', paddingLeft: 20 * u}}>{scene.props.url}</div>}
      </div>
      <div style={{flex: 1, overflow: 'hidden'}}>{media}</div>
    </div>
  );
  const caption = <Words text={scene.props.caption} at={cue(scene) + 4} size={(landscape ? 76 : 72) * u} color={c.ink} accent={b.accent} align={landscape && phone ? 'left' : 'center'} />;
  const dev = <div style={{transform: `translateY(${(1 - p) * 160 * u}px) scale(${0.92 + 0.08 * p})`, opacity: Math.min(1, p * 2)}}>{device}</div>;
  return landscape && phone ? (
    <AbsoluteFill style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 100 * u, padding: 80 * u}}>
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
      <div style={{...font(b.display), ...rise(t, u), fontSize: 92 * k * u, lineHeight: 1.05, letterSpacing: -1.6 * u, color: c.ink}}>
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
      <div style={{...font(b.text), fontSize: 54 * k * u, lineHeight: 1.15, color: c.ink, fontWeight: 600}}><Emph text={text} color={b.accent} /></div>
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
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 24 * u, padding: 90 * u}}>
      <div style={{...font(b.display), fontSize: 300 * k * u, lineHeight: 1, letterSpacing: -8 * u, color: b.accent, opacity: Math.min(1, t * 3)}}>{shown}</div>
      <div style={{...font(b.text), ...rise(l, u, 24), fontSize: 52 * k * u, color: c.ink, textAlign: 'center', maxWidth: 860 * u, lineHeight: 1.2, fontWeight: 600}}><Emph text={scene.props.label} color={b.accent} /></div>
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
      {scene.props.title && <div style={{...font(b.display), ...rise(t, u), fontSize: 80 * u, color: c.ink, letterSpacing: -1.5 * u, textAlign: 'center'}}><Emph text={scene.props.title} color={b.accent} /></div>}
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
      <div style={{...font(b.display), fontSize: 72 * u, color: b.accent, lineHeight: 1}}>{n}</div>
      <div style={{...font(b.text), fontSize: 44 * u, color: c.ink, fontWeight: 600, lineHeight: 1.15}}><Emph text={text} color={b.accent} /></div>
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
      <div style={{...font(b.display), ...rise(n, u), fontSize: 104 * k * u, color: c.ink, letterSpacing: -2 * u, lineHeight: 1}}>{b.name}</div>
      <div style={{...font(b.text), transform: `scale(${btn * down})`, background: fill, color: fg, fontSize: 46 * k * u, fontWeight: 700, padding: `${26 * k * u}px ${56 * k * u}px`, borderRadius: 999}}>{scene.props.button}</div>
      {(scene.props.url ?? b.url) && <div style={{...font(b.text), opacity: url, fontSize: 40 * k * u, color: c.quiet}}>{scene.props.url ?? b.url}</div>}
    </AbsoluteFill>
  );
};

export const SCENES = {title: Title, statement: Statement, screen: Screen, features: Features, stat: Stat, steps: Steps, end: End};
