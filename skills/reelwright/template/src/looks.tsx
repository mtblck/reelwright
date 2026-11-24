import React, {createContext, useContext} from 'react';
import {AbsoluteFill, Freeze, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Brand} from './types';

// A look re-skins the whole video without touching the story: a layer over every frame, a wrapper
// round all the scenes, and the way in a scene uses when the story doesn't name one. It stays on the
// brand's colours and fonts. story.json picks one with `"look": "film"`; `clean` is the default.
// build.mjs reads the same names and default ways in from LOOKS there: keep the two in step.

export type Look = {
  enter: string; // default way in after the first scene (a key of TRANSITIONS)
  Wrap?: React.FC<{children: React.ReactNode}>; // round every scene, e.g. to move the whole picture
  Over?: React.FC; // drawn over everything, e.g. grain (left out of the GIF's pass)
  text?: 'rise' | 'type'; // how words reveal: rise (default) or type on behind a cursor
  Back?: React.FC<{index: number; bg: string; brand: Brand}>; // drawn on each scene's background, under its content
  Front?: React.FC<{index: number; bg: string; brand: Brand}>; // drawn over each scene's content, moving with the scene
  marker?: boolean; // starred words get a marker scribbled under them
  tilt?: boolean; // devices and cards sit tilted in 3D, drifting a little for depth
  upper?: boolean; // display type in capitals
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

// a colour from the brand that reads on a scene's background, faintly
const faint = (bg: string, brand: Brand, k: number) => {
  const light = bg.toLowerCase() === brand.paper.toLowerCase();
  return light ? `${brand.ink}${Math.round(k * 255).toString(16).padStart(2, '0')}` : `${brand.paper}${Math.round(k * 255).toString(16).padStart(2, '0')}`;
};
const useU = () => { const {width, height} = useVideoConfig(); return {width, height, u: Math.min(width, height) / 1080}; };

// poster: capitals, bigger type, hard cuts, a slab of a clashing colour along an edge and the scene's
// number set huge and cropped off the corner
const PosterBack: React.FC<{index: number; bg: string; brand: Brand}> = ({index, bg, brand}) => {
  const {u, height} = useU();
  // a slab across the top or bottom edge (alternating), in a colour that clashes with the scene's but is
  // never the accent, so accent words stay readable
  const slab = bg.toLowerCase() === brand.primary.toLowerCase() ? brand.dark : brand.primary;
  const h = height * 0.06;
  return (
    <AbsoluteFill style={{overflow: 'hidden'}}>
      <div style={{position: 'absolute', left: 0, right: 0, [index % 2 ? 'bottom' : 'top']: 0, height: h, background: slab}} />
      <div style={{position: 'absolute', right: -40 * u, bottom: -170 * u, fontFamily: `"${brand.display.family}", sans-serif`, fontWeight: 900, fontSize: 620 * u, lineHeight: 1, letterSpacing: -30 * u, color: 'transparent', WebkitTextStroke: `${3 * u}px ${faint(bg, brand, 0.22)}`}}>{String(index + 1).padStart(2, '0')}</div>
    </AbsoluteFill>
  );
};

// blueprint: grid paper, crop marks in the corners and a dimension line along the top, drawn on as the scene opens
const BlueprintBack: React.FC<{index: number; bg: string; brand: Brand}> = ({bg, brand}) => {
  const frame = useCurrentFrame();
  const {u, width, height} = useU();
  const fine = faint(bg, brand, 0.07), bold = faint(bg, brand, 0.14), ink = faint(bg, brand, 0.55);
  const g = Math.round(36 * u);
  const draw = interpolate(frame, [2, 26], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const m = 46 * u, c = 34 * u, sw = Math.max(1.5, 2 * u);
  const marks = [[m, m, 1, 1], [width - m, m, -1, 1], [m, height - m, 1, -1], [width - m, height - m, -1, -1]];
  const y = m * 0.62, x0 = m + c + 30 * u, x1 = width - m - c - 30 * u, len = x1 - x0;
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{backgroundImage: `linear-gradient(${bold} ${sw}px, transparent ${sw}px), linear-gradient(90deg, ${bold} ${sw}px, transparent ${sw}px), linear-gradient(${fine} 1px, transparent 1px), linear-gradient(90deg, ${fine} 1px, transparent 1px)`, backgroundSize: `${g * 5}px ${g * 5}px, ${g * 5}px ${g * 5}px, ${g}px ${g}px, ${g}px ${g}px`, backgroundPosition: `${width / 2}px ${height / 2}px`}} />
      <svg width={width} height={height} style={{position: 'absolute', inset: 0}}>
        {marks.map(([x, y2, dx, dy], i) => <path key={i} d={`M${x} ${y2 + dy * c} L${x} ${y2} L${x + dx * c} ${y2}`} fill="none" stroke={ink} strokeWidth={sw * 1.4} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />)}
        <g stroke={ink} strokeWidth={sw}>
          <line x1={x0} y1={y} x2={x0 + len * draw} y2={y} />
          <line x1={x0} y1={y - 10 * u} x2={x0} y2={y + 10 * u} />
          {draw >= 1 && <line x1={x1} y1={y - 10 * u} x2={x1} y2={y + 10 * u} />}
        </g>
        {draw >= 1 && <text x={width / 2} y={y - 9 * u} textAnchor="middle" fill={ink} style={{fontFamily: `"${brand.text.family}", sans-serif`, fontSize: 20 * u, letterSpacing: 2 * u}}>{`${width} × ${height}`}</text>}
      </svg>
    </AbsoluteFill>
  );
};

// paper: everything moves at 12 frames a second, the way stop motion does, with a little shake on
// each held frame; cut-paper grain over the picture and a torn paper edge round the frame
const PaperWrap: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const {u} = useU();
  const held = Math.floor(frame / 2.5);
  const at = Math.round(held * 2.5);
  const r = (hash(held) - 0.5) * 0.5;
  const dx = Math.round((hash(held + 99) - 0.5) * 3 * u), dy = Math.round((hash(held + 199) - 0.5) * 3 * u);
  return <AbsoluteFill style={{transform: `translate(${dx}px, ${dy}px) rotate(${r}deg) scale(1.02)`}}><Freeze frame={at}>{children}</Freeze></AbsoluteFill>;
};
const PaperOver: React.FC = () => {
  const {u, width, height} = useU();
  // a torn edge: a jagged line just inside each side, the same on every frame
  const edge = (len: number, depth: number, seed: number) => {
    const n = Math.ceil(len / (14 * u));
    return Array.from({length: n + 1}, (_, i) => [i * (len / n), depth * (0.35 + 0.65 * hash(seed + i))]);
  };
  const d = 22 * u;
  const top = edge(width, d, 1), bottom = edge(width, d, 500), left = edge(height, d, 900), right = edge(height, d, 1300);
  const path = [
    `M0 0 L${width} 0 L${width} ${height} L0 ${height} Z`,
    `M${left[0][1]} ${top[0][1]} ` + top.map(([x, y]) => `L${x} ${y}`).join(' ') + ' ' + right.map(([y, x]) => `L${width - x} ${y}`).join(' ') + ' ' + [...bottom].reverse().map(([x, y]) => `L${x} ${height - y}`).join(' ') + ' ' + [...left].reverse().map(([y, x]) => `L${x} ${y}`).join(' ') + ' Z',
  ].join(' ');
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <svg width="100%" height="100%" style={{position: 'absolute', inset: 0, mixBlendMode: 'multiply', opacity: 0.18}}>
        <filter id="paper-grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves={2} seed={4} /><feColorMatrix type="saturate" values="0" /></filter>
        <rect width="100%" height="100%" filter="url(#paper-grain)" />
      </svg>
      <svg width={width} height={height} style={{position: 'absolute', inset: 0, filter: `drop-shadow(0 0 ${4 * u}px #00000040)`}}>
        <path d={path} fill="#f7f3ea" fillRule="evenodd" />
      </svg>
    </AbsoluteFill>
  );
};

// sketch: every line boils (wobbles a little, a new wobble every 4 frames, as hand-drawn animation does)
// and starred words get a marker scribbled under them
const SketchWrap: React.FC<{children: React.ReactNode}> = ({children}) => {
  const frame = useCurrentFrame();
  const {u} = useU();
  const k = Math.floor(frame / 4) % 3;
  return (
    <AbsoluteFill>
      <svg width={0} height={0} style={{position: 'absolute'}}>
        <filter id={`boil${k}`}><feTurbulence type="turbulence" baseFrequency="0.02" numOctaves={2} seed={k * 11 + 3} result="t" /><feDisplacementMap in="SourceGraphic" in2="t" scale={4 * u} xChannelSelector="R" yChannelSelector="G" /></filter>
      </svg>
      <AbsoluteFill style={{filter: `url(#boil${k})`}}>{children}</AbsoluteFill>
    </AbsoluteFill>
  );
};

export const LOOKS: Record<string, Look> = {
  clean: {enter: 'slide'},
  film: {enter: 'splice', Wrap: FilmWrap, Over: FilmOver},
  terminal: {enter: 'cut', Over: TerminalOver, text: 'type'},
  poster: {enter: 'cut', Back: PosterBack, upper: true},
  blueprint: {enter: 'fade', Back: BlueprintBack},
  paper: {enter: 'slide', Wrap: PaperWrap, Over: PaperOver},
  sketch: {enter: 'fade', Wrap: SketchWrap, marker: true},
  isometric: {enter: 'zoom', tilt: true},
};

export const LookContext = createContext<Look>({enter: 'slide'});
export const useLook = () => useContext(LookContext);

// the isometric look's tilt for a device or card: turned in 3D and drifting a little across the scene,
// cards further down a list sitting a step further back (depth). '' when the look doesn't tilt.
export const useTilt = (depth = 0) => {
  const look = useLook();
  const frame = useCurrentFrame();
  if (!look.tilt) return '';
  const drift = Math.sin(frame / 50) * 3;
  return `perspective(2600px) rotateX(${16 + drift * 0.3}deg) rotateY(${-20 + drift}deg) rotateZ(${3}deg) translateZ(${-depth * 30}px)`;
};

export const lookOf = (name?: string) => LOOKS[name ?? 'clean'] ?? LOOKS.clean;
