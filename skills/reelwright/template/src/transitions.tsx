import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Brand, Scene} from './types';
import {asset, useBrand} from './ui';

// Every transition has two sides. When scene B follows scene A, B's `enter` names the transition:
// B runs its `in` side from its first frame, and A runs the same transition's `out` side over the same
// frames (A's Sequence runs `len` frames past B's start, under it). Both sides read one progress value,
// so they move in lockstep. A transition with no `out` leaves the outgoing scene still, as before.

export type Ctx = {width: number; height: number; brand: Brand; opts: Record<string, any>};
export type Side = (p: number, children: React.ReactNode, ctx: Ctx) => React.ReactNode;
export type Transition = {len: number; ease?: (t: number) => number; in?: Side; out?: Side};

// a translate along the transition's direction, k frames of travel (1 = one whole frame width or height)
const shift = ({width, height, opts}: Ctx, k: number) => {
  const d = opts.direction ?? 'left';
  return d === 'right' ? `translateX(${-k * width}px)` : d === 'up' ? `translateY(${k * height}px)` : d === 'down' ? `translateY(${-k * height}px)` : `translateX(${k * width}px)`;
};
const wrap = (style: React.CSSProperties, children: React.ReactNode) => <AbsoluteFill style={style}>{children}</AbsoluteFill>;

export const TRANSITIONS: Record<string, Transition> = {
  cut: {len: 0},
  slide: {len: 12, in: (p, c, {width}) => wrap({transform: `translateX(${(1 - p) * width}px)`}, c)},
  fade: {len: 12, in: (p, c) => wrap({opacity: p}, c)},
  zoom: {len: 12, in: (p, c) => wrap({opacity: p, transform: `scale(${1.08 - 0.08 * p})`}, c)},
  // push: the new scene shoves the old one off, both moving the same way.
  // opts.direction: 'left' (default: the new scene comes from the right), 'right', 'up', 'down'
  push: {
    len: 14,
    ease: Easing.inOut(Easing.cubic),
    in: (p, c, ctx) => wrap({transform: shift(ctx, 1 - p)}, c),
    out: (p, c, ctx) => wrap({transform: shift(ctx, -p)}, c),
  },
  // mask: the new scene opens up through a shape that grows from the centre until it fills the frame.
  // opts.shape: 'mark' (the brand's own mark, default; iris when there's no mark), 'frame' (an aspect
  // frame, opts.aspect '9:16' default, '1:1' or '16:9', edged in the accent) or 'iris' (a circle).
  // The old scene pushes in a little and darkens underneath.
  mask: {
    len: 18,
    ease: Easing.inOut(Easing.cubic),
    in: (p, c, ctx) => {
      const {width, height, brand, opts} = ctx;
      const short = Math.min(width, height);
      const shape = opts.shape === 'frame' || opts.shape === 'iris' ? opts.shape : brand.mark ? 'mark' : 'iris';
      if (shape === 'iris') return wrap({clipPath: `circle(${p * Math.hypot(width, height) / 2}px at 50% 50%)`}, c);
      if (shape === 'frame') {
        const [aw, ah] = String(opts.aspect ?? '9:16').split(':').map(Number);
        const a = aw / ah || 9 / 16;
        const k = p * Math.max(height, width / a) * 1.04; // the frame's height; at p = 1 it covers the whole video
        const [x, y] = [(width - k * a) / 2, (height - k) / 2];
        const edge = Math.max(2, short * 0.012) * (1 - p);
        return (
          <AbsoluteFill>
            <AbsoluteFill style={{clipPath: `inset(${y}px ${x}px ${y}px ${x}px)`}}>{c}</AbsoluteFill>
            {p < 1 && <div style={{position: 'absolute', left: x - edge, top: y - edge, width: k * a + 2 * edge, height: k + 2 * edge, border: `${edge}px solid ${brand.accent}`, boxSizing: 'border-box'}} />}
          </AbsoluteFill>
        );
      }
      // the mark: its opaque parts let the new scene through as it grows past the frame. A circle opens
      // from the centre behind it over the second half, so outline marks (strokes round an empty middle)
      // still finish on a full frame; under a solid mark the circle is never seen.
      const size = short * 0.35 * (Math.pow(40, p) - 1);
      const url = `url("${asset(brand.mark)}")`;
      const m = {maskImage: url, WebkitMaskImage: url, maskSize: `${size}px ${size}px`, WebkitMaskSize: `${size}px ${size}px`, maskPosition: 'center', WebkitMaskPosition: 'center', maskRepeat: 'no-repeat', WebkitMaskRepeat: 'no-repeat'} as React.CSSProperties;
      return (
        <AbsoluteFill>
          <AbsoluteFill style={m}>{c}</AbsoluteFill>
          {p > 0.4 && <AbsoluteFill style={{clipPath: `circle(${interpolate(p, [0.4, 1], [0, Math.hypot(width, height) / 2])}px at 50% 50%)`}}>{c}</AbsoluteFill>}
        </AbsoluteFill>
      );
    },
    out: (p, c) => wrap({transform: `scale(${1 + 0.06 * p})`, filter: `brightness(${1 - 0.25 * p})`}, c),
  },
  // a splice: the new scene wipes in behind a bar of the accent colour, like tape across a cut
  splice: {
    len: 10,
    ease: Easing.inOut(Easing.cubic),
    in: (p, c, {brand}) => {
      const bar = 0.06;
      return (
        <AbsoluteFill>
          <AbsoluteFill style={{clipPath: `inset(0 ${(1 - p) * 100}% 0 0)`}}>{c}</AbsoluteFill>
          {p < 1 && <AbsoluteFill style={{left: `${p * 100 - bar * 100 * (1 - p)}%`, width: `${bar * 100}%`, background: brand.accent}} />}
        </AbsoluteFill>
      );
    },
  },
  // match: the old scene's main shape becomes the new scene's (MatchLayer in match.tsx draws the move);
  // here the new scene just waits underneath until the shape has landed
  match: {len: 18, ease: (t) => t, in: (p, c) => wrap({opacity: p < 0.8 ? 0 : 1}, c)},
  // whip: a fast pan, both scenes smeared along the move by a directional blur that peaks mid-move.
  // opts.direction as push. The blur is an SVG filter, so the scene is drawn once per frame.
  whip: {
    len: 9,
    ease: Easing.inOut(Easing.quad),
    in: (p, c, ctx) => smear('in', p, ctx, wrap({transform: shift(ctx, 1 - p)}, c)),
    out: (p, c, ctx) => smear('out', p, ctx, wrap({transform: shift(ctx, -p)}, c)),
  },
  // glitch: a 4-frame hit. Two frames of the old scene, then two of the new one, with the colour
  // channels pulled apart and bands of the picture jolted sideways. Once per video at most.
  glitch: {
    len: 4,
    ease: (t) => t,
    in: (p, c, ctx) => (p < 0.5 ? null : p < 1 ? glitched('in', p, ctx, c) : c),
    out: (p, c, ctx) => (p < 0.5 ? glitched('out', p, ctx, c) : c),
  },
};

// a horizontal (or vertical) blur, strongest mid-move
function smear(side: string, p: number, {width, height, opts}: Ctx, node: React.ReactNode) {
  const vertical = opts.direction === 'up' || opts.direction === 'down';
  const b = Math.sin(Math.PI * p) * (vertical ? height : width) * 0.045;
  if (b < 0.5) return node;
  const id = `whip-${side}`;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={vertical ? `0 ${b}` : `${b} 0`} />
        </filter>
      </svg>
      <AbsoluteFill style={{filter: `url(#${id})`}}>{node}</AbsoluteFill>
    </AbsoluteFill>
  );
}

// red and blue pulled apart, and bands of the frame displaced sideways, different on each frame
function glitched(side: string, p: number, {width, height}: Ctx, c: React.ReactNode) {
  const short = Math.min(width, height);
  const k = Math.round(p * 4); // the frame within the hit: 0, 1 (old) and 2, 3 (new)
  const split = short * (k % 2 ? 0.012 : 0.02);
  const id = `glitch-${side}-${k}`;
  const ch = (r: number, g: number, b: number) => `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={id} x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          {/* bands: noise stretched flat across the frame, stepped, drives a sideways displacement */}
          <feTurbulence type="fractalNoise" baseFrequency={`0.00001 ${(6 + 5 * k) / height}`} numOctaves={1} seed={3 + k * 7} result="n" />
          <feComponentTransfer in="n" result="bands">
            <feFuncR type="discrete" tableValues="0.5 0.5 0.3 0.5 0.12 0.82 0.5 0.62 0.25 0.5 0.5" />
            <feFuncG type="linear" slope={0} intercept={0.5} />
          </feComponentTransfer>
          <feDisplacementMap in="SourceGraphic" in2="bands" scale={short * 0.16} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feColorMatrix in="d" type="matrix" values={ch(1, 0, 0)} result="r" />
          <feOffset in="r" dx={split} result="r2" />
          <feColorMatrix in="d" type="matrix" values={ch(0, 1, 0)} result="g" />
          <feColorMatrix in="d" type="matrix" values={ch(0, 0, 1)} result="b" />
          <feOffset in="b" dx={-split} result="b2" />
          <feBlend in="r2" in2="g" mode="screen" result="rg" />
          <feBlend in="rg" in2="b2" mode="screen" />
        </filter>
      </svg>
      {/* scaled up a little so the displaced bands never pull in the empty edge beyond the frame */}
      <AbsoluteFill style={{filter: `url(#${id})`, transform: 'scale(1.08)'}}>{c}</AbsoluteFill>
    </AbsoluteFill>
  );
}

// The longest transition: how far a scene's Sequence must run past the next scene's start.
export const OVERLAP = Math.max(...Object.values(TRANSITIONS).map((t) => t.len));

const progress = (frame: number, t: Transition) =>
  t.len ? interpolate(frame, [0, t.len], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: t.ease ?? Easing.out(Easing.cubic)}) : 1;

// Wraps one scene: its way in (its own `enter`) and its way out (the next scene's `enter`).
export const Transitioned: React.FC<{scene: Scene; next?: Scene; children: React.ReactNode}> = ({scene, next, children}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const brand = useBrand();
  let out: React.ReactNode = children;
  const tin = TRANSITIONS[scene.enter] ?? TRANSITIONS.cut;
  if (tin.in && frame < tin.len) out = tin.in(progress(frame, tin), out, {width, height, brand, opts: scene.enterOpts ?? {}});
  if (next) {
    const tout = TRANSITIONS[next.enter] ?? TRANSITIONS.cut;
    const local = frame - scene.dur; // frames since the next scene started
    if (tout.out && local >= 0) out = tout.out(progress(local, tout), out, {width, height, brand, opts: next.enterOpts ?? {}});
  }
  return <>{out}</>;
};
