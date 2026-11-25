import React, {createContext, useContext, useEffect, useState} from 'react';
import {continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Brand, Scene} from './types';
import {useLook} from './looks';

export const BrandContext = createContext<Brand | null>(null);
export const useBrand = () => useContext(BrandContext)!;

export const asset = (p?: string) => (!p ? '' : /^(https?:|data:)/.test(p) ? p : staticFile(p));

// Layout: one unit = 1/1080 of the short side, so a design works at 1080x1080, 1080x1920 and 1920x1080.
// 1080x1350 (portrait, 4:5) lays out as square; `tall` is the extra height it has, for scenes that can use it.
export const useLayout = () => {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const shape = height > width * 1.5 ? 'vertical' : width > height * 1.2 ? 'landscape' : 'square';
  const tall = shape === 'square' ? Math.max(0, height - width) / u : 0;
  return {width, height, u, shape, tall, vertical: shape === 'vertical', landscape: shape === 'landscape'};
};

export const sceneColors = (b: Brand, bg: Scene['bg']) =>
  bg === 'dark'
    ? {bg: b.dark, ink: b.paper, quiet: mix(b.paper, b.dark, 0.35), card: mix(b.paper, b.dark, 0.9), mark: b.markDark || b.mark, logo: b.logoDark}
    : bg === 'brand'
      ? {bg: b.primary, ink: b.paper, quiet: mix(b.paper, b.primary, 0.3), card: mix(b.paper, b.primary, 0.88), mark: b.markDark || b.mark, logo: b.logoDark}
      : {bg: b.paper, ink: b.ink, quiet: mix(b.ink, b.paper, 0.4), card: mix(b.ink, b.paper, 0.94), mark: b.mark, logo: b.logo};

// a + (b - a) * t, on hex colours
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

// WCAG contrast between two hex colours (1 to 21)
const lum = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
export const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
// fg lightened towards light, only as far as it takes to reach min:1 against bg; fg as it is when it already
// does, or when no amount of lightening gets there (a light or mid-tone bg). Only lightened: dark text sits on
// accent fills (badges, the hot node), and a lighter fill keeps that text readable.
export const readable = (fg: string, bg: string, light: string, min = 3) => {
  if (contrast(fg, bg) >= min || contrast(light, bg) < min) return fg;
  for (let t = 0.05; t < 1; t += 0.05) { const c = mix(fg, light, t); if (contrast(c, bg) >= min) return c; }
  return light;
};

// Springs and fades that start at a frame (a cue).
export const usePop = (at: number, damping = 14) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return spring({frame: frame - at, fps, config: {damping, mass: 0.7}});
};
export const useFade = (at: number, len = 8) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [at, at + len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic)});
};
export const rise = (p: number, u: number, d = 40) => ({opacity: Math.min(1, p * 1.4), transform: `translateY(${(1 - p) * d * u}px)`});

// "12,000+" at t (0..1) -> "8,437+": the first number in a value counts up to it, the rest of the text stays.
// t is used as given (ease it first). A value with no number above zero is shown as it is.
export const NUM = /[0-9][0-9,]*(?:\.([0-9]+))?/;
export const countUp = (raw: string, t: number) => {
  const m = raw.match(NUM);
  const n = m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
  if (!m || !isFinite(n) || n <= 0) return raw;
  const dec = (m[1] ?? '').length;
  const now = n * Math.min(1, Math.max(0, t));
  return raw.replace(m[0], now.toLocaleString('en-US', {minimumFractionDigits: dec, maximumFractionDigits: dec}));
};

// "Fill your *calendar*" -> the starred words in the accent colour.
export const Emph: React.FC<{text: string; color: string}> = ({text, color}) => {
  const marker = useLook().marker;
  return <>{text.split(/(\*[^*]+\*)/).map((s, i) => (s.startsWith('*') && s.endsWith('*') ? <span key={i} style={{color}}>{marker ? <Scribble color={color}>{s.slice(1, -1)}</Scribble> : s.slice(1, -1)}</span> : <React.Fragment key={i}>{s}</React.Fragment>))}</>;
};

// a marker line scribbled under a word (the sketch look); p draws it on from the left
export const Scribble: React.FC<{color: string; p?: number; children: React.ReactNode}> = ({color, p = 1, children}) => (
  <span style={{position: 'relative', display: 'inline-block'}}>
    {children}
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" style={{position: 'absolute', left: '-3%', width: '106%', bottom: '-0.2em', height: '0.34em', overflow: 'visible'}}>
      <path d="M2 12 C 22 6, 48 16, 98 7 M5 18 C 36 11, 66 19, 95 13" fill="none" stroke={color} strokeWidth={0.09} strokeLinecap="round" style={{strokeWidth: '0.09em'}} vectorEffect="non-scaling-stroke" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - p} opacity={0.85} />
    </svg>
  </span>
);

// Fonts: build.mjs saves the brand's Google Fonts into public/fonts; wait for them before the first frame.
export const useFonts = (b: Brand) => {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    if (!b.fontCss) return void continueRender(handle);
    const l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = staticFile(b.fontCss);
    const done = () => continueRender(handle);
    // a fallback face loads only for the letters it covers: ask for one of its own
    const SAMPLE: Record<string, string> = {'Noto Sans JP': 'あ', 'Noto Sans SC': '中', 'Noto Sans KR': '한', 'Noto Sans Devanagari': 'क'};
    const extra = () => (b.fallback ?? []).flatMap((fam) => [400, 700].map((w) => document.fonts.load(`${w} 40px "${fam}"`, SAMPLE[fam] ?? 'a')));
    l.onload = () => Promise.all([...[b.display, b.text].map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`)), ...extra()]).then(done, done);
    l.onerror = done; // missing fonts: fall back to system fonts rather than hang
    document.head.appendChild(l);
  }, []);
};

// A font size times brand.typeScale (set by a look whose face runs wider, e.g. terminal's mono).
// Video sets it once per frame before any scene renders, so sizes need no hook.
let typeScale = 1;
export const setTypeScale = (k = 1) => { typeScale = k; };
export const ts = (px: number) => px * typeScale;

let fallback = '';
export const setFallback = (fams: string[] = []) => { fallback = fams.map((f) => `"${f}", `).join(''); };
export const font = (f: {family: string; weight: number}) => ({fontFamily: `"${f.family}", ${fallback}system-ui, sans-serif`, fontWeight: f.weight});
