import React, {createContext, useContext} from 'react';
import {AbsoluteFill, useCurrentFrame, useVideoConfig} from 'remotion';

// A look re-skins the whole video without touching the story: a layer over every frame, a wrapper
// round all the scenes, and the way in a scene uses when the story doesn't name one. It stays on the
// brand's colours and fonts. story.json picks one with `"look": "film"`; `clean` is the default.
// build.mjs reads the same names and default ways in from LOOKS there: keep the two in step.

export type Look = {
  enter: string; // default way in after the first scene (a key of TRANSITIONS)
  Wrap?: React.FC<{children: React.ReactNode}>; // round every scene, e.g. to move the whole picture
  Over?: React.FC; // drawn over everything, e.g. grain (left out of the GIF's pass)
  text?: 'rise' | 'type'; // how words reveal: rise (default) or type on behind a cursor
};

// a repeatable 0..1 value for a frame and a channel, so a look draws the same on every render
const hash = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// film: the picture weaves a little in the gate, flickers, and sits under grain and a soft vignette
const FilmWrap: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  // weave and flicker hold for 4 frames and move in whole pixels: the encoder can then match each frame
  // to the last instead of re-coding a resampled picture every frame (that tripled the file size).
  // The slight scale keeps the frame's edges out of view as it moves.
  const step = Math.floor(frame / 4);
  const dx = Math.round((hash(step) - 0.5) * 3 * u);
  const dy = Math.round((hash(step + 999) - 0.5) * 4 * u);
  const flicker = 1 + (hash(step + 5000) - 0.5) * 0.03;
  return <AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) scale(1.006)`, filter: `brightness(${flicker})`}}>{children}</AbsoluteFill>;
};
const FilmOver: React.FC = () => {
  const frame = useCurrentFrame();
  // a new grain plate every 4 frames, from six on a loop: it still reads as moving grain, and the
  // encoder only pays for a new pattern 7.5 times a second instead of 30
  const seed = Math.floor(frame / 4) % 6;
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 60%, rgba(0,0,0,0.22) 100%)'}} />
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, mixBlendMode: 'overlay', opacity: 0.14}}>
        <filter id={`grain${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="1" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#grain${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};

// terminal: scanlines and a dark edge, like a CRT. build.mjs sets the brand's fonts to a mono face, and
// words type on behind a block cursor (Typed in scenes.tsx) with a soft phosphor glow.
const TerminalOver: React.FC = () => {
  const {width, height} = useVideoConfig();
  const u = Math.min(width, height) / 1080;
  const pitch = Math.max(3, Math.round(4 * u));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) ${pitch - 1}px, rgba(0,0,0,0.13) ${pitch - 1}px, rgba(0,0,0,0.13) ${pitch}px)`}} />
      <AbsoluteFill style={{background: 'radial-gradient(ellipse at center, rgba(0,0,0,0) 65%, rgba(0,0,0,0.18) 100%)'}} />
    </AbsoluteFill>
  );
};

export const LOOKS: Record<string, Look> = {
  clean: {enter: 'slide'},
  film: {enter: 'splice', Wrap: FilmWrap, Over: FilmOver},
  terminal: {enter: 'cut', Over: TerminalOver, text: 'type'},
};

export const LookContext = createContext<Look>({enter: 'slide'});
export const useLook = () => useContext(LookContext);

export const lookOf = (name?: string) => LOOKS[name ?? 'clean'] ?? LOOKS.clean;
