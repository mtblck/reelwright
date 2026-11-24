import React, {createContext, useContext, useEffect, useState} from 'react';
import {continueRender, delayRender, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig, Easing} from 'remotion';
import type {Brand, Scene} from './types';

export const BrandContext = createContext<Brand | null>(null);
export const useBrand = () => useContext(BrandContext)!;

export const asset = (p?: string) => (!p ? '' : /^(https?:|data:)/.test(p) ? p : staticFile(p));

// Layout: one unit = 1/1080 of the short side, so a design works at 1080x1080, 1080x1920 and 1920x1080.
export const useLayout = () => {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const shape = height > width * 1.2 ? 'vertical' : width > height * 1.2 ? 'landscape' : 'square';
  return {width, height, u, shape, vertical: shape === 'vertical', landscape: shape === 'landscape'};
};

export const sceneColors = (b: Brand, bg: Scene['bg']) =>
  bg === 'dark'
    ? {bg: b.dark, ink: b.paper, quiet: mix(b.paper, b.dark, 0.35), card: mix(b.paper, b.dark, 0.9), mark: b.markDark || b.mark}
    : bg === 'brand'
      ? {bg: b.primary, ink: b.paper, quiet: mix(b.paper, b.primary, 0.3), card: mix(b.paper, b.primary, 0.88), mark: b.markDark || b.mark}
      : {bg: b.paper, ink: b.ink, quiet: mix(b.ink, b.paper, 0.4), card: mix(b.ink, b.paper, 0.94), mark: b.mark};

// a + (b - a) * t, on hex colours
export function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.replace('#', '').padEnd(6, '0').slice(i - 1, i + 1), 16));
  const [x, y] = [p(a), p(b)];
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

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

// "Fill your *calendar*" -> the starred words in the accent colour.
export const Emph: React.FC<{text: string; color: string}> = ({text, color}) => (
  <>{text.split(/(\*[^*]+\*)/).map((s, i) => (s.startsWith('*') && s.endsWith('*') ? <span key={i} style={{color}}>{s.slice(1, -1)}</span> : <React.Fragment key={i}>{s}</React.Fragment>))}</>
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
    l.onload = () => Promise.all([b.display, b.text].map((f) => document.fonts.load(`${f.weight} 40px "${f.family}"`))).then(done, done);
    l.onerror = done; // missing fonts: fall back to system fonts rather than hang
    document.head.appendChild(l);
  }, []);
};

export const font = (f: {family: string; weight: number}) => ({fontFamily: `"${f.family}", system-ui, sans-serif`, fontWeight: f.weight});
