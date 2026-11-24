import React from 'react';
import {AbsoluteFill, Easing, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Brand, Scene} from './types';
import {useBrand} from './ui';

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
};

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
