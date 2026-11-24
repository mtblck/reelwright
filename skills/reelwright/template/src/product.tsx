import React from 'react';
import {AbsoluteFill, Easing, Img, interpolate, useCurrentFrame} from 'remotion';
import type {Scene} from './types';
import {asset, mix, sceneColors, useBrand, useLayout, usePop} from './ui';
import {Words} from './scenes';
import {useTilt} from './looks';

// Scenes and overlays for showing a product from one screenshot: a camera that pushes into the part
// being talked about, and a cursor that clicks through the UI. Both take points and rectangles as
// fractions of the picture (0 to 1 from its top left), so they don't depend on the frame size.

type C = ReturnType<typeof sceneColors>;
type P = {scene: Scene; c: C};
type Pt = [number, number] | null;
const cue = (s: Scene, i = 0) => s.cues[Math.min(i, s.cues.length - 1)] ?? 0;
const MOVE = 22; // frames the camera takes to reach a new focus
const GLIDE = 18; // frames the cursor takes to reach a target
export const CLICK_AT = 20; // frames after its phrase starts that the cursor clicks (build.mjs adds the sound)
const SHARP = 1.25; // the most a picture's pixel may be blown up: past this, small text goes soft
const ease = Easing.inOut(Easing.cubic);

// the cursor, gliding between targets and clicking each one with a ripple. `map` turns a point on the
// picture into a position in the layer, so the cursor stays on its target while the picture moves.
export const CursorLayer: React.FC<{scene: Scene; points: Pt[]; map: (x: number, y: number) => [number, number]; w: number; h: number}> = ({scene, points, map, w, h}) => {
  const b = useBrand();
  const {u} = useLayout();
  const frame = useCurrentFrame();
  const stops = points.map((pt, k) => (pt && k < scene.cues.length ? {pt, at: cue(scene, k)} : null)).filter(Boolean) as {pt: [number, number]; at: number}[];
  if (!stops.length || frame < stops[0].at) return null;
  // where it is: the last stop it has set out for, eased from the one before (the first comes in from the lower right)
  let k = 0;
  stops.forEach((s, i) => { if (frame >= s.at) k = i; });
  const to = map(...stops[k].pt);
  const from = k ? map(...stops[k - 1].pt) : [w * 0.9, h * 1.08];
  const t = interpolate(frame - stops[k].at, [0, GLIDE], [0, 1], {extrapolateRight: 'clamp', easing: ease});
  const x = from[0] + (to[0] - from[0]) * t;
  const y = from[1] + (to[1] - from[1]) * t;
  const since = frame - stops[k].at - CLICK_AT; // frames since the click
  const press = since >= 0 && since < 5 ? 0.86 : 1;
  const ring = since >= 0 && since < 20 ? since / 20 : -1;
  const size = 46 * u;
  return (
    <AbsoluteFill style={{pointerEvents: 'none', overflow: 'hidden'}}>
      {ring >= 0 && (
        <div style={{position: 'absolute', left: x, top: y, width: 0, height: 0}}>
          <div style={{position: 'absolute', left: -60 * u * ring, top: -60 * u * ring, width: 120 * u * ring, height: 120 * u * ring, borderRadius: 999, border: `${5 * u * (1 - ring)}px solid ${b.accent}`, background: `${b.accent}${Math.round((1 - ring) * 0x30).toString(16).padStart(2, '0')}`}} />
        </div>
      )}
      <svg width={size} height={size} viewBox="0 0 24 24" style={{position: 'absolute', left: x - size * 0.2, top: y - size * 0.12, transform: `scale(${press})`, transformOrigin: '20% 12%', filter: `drop-shadow(0 ${3 * u}px ${6 * u}px #00000055)`}}>
        <path d="M5 2.5 L5 19.5 L9.3 15.4 L12.3 21.8 L15.2 20.5 L12.2 14.2 L18.2 14.2 Z" fill="#ffffff" stroke={mix(b.ink, '#000000', 0.5)} strokeWidth={1.4} strokeLinejoin="round" />
      </svg>
    </AbsoluteFill>
  );
};

// where a picture shown with object-fit: cover lands in a w x h box, as a point mapper.
// pos is object-position: 'top' (default) or 'center'; zoom scales from the top centre, as Screen does.
export const coverMap = (iw: number, ih: number, w: number, h: number, pos = 'top', zoom = 1) => {
  const k = Math.max(w / iw, h / ih);
  const ox = (w - iw * k) / 2;
  const oy = pos === 'center' ? (h - ih * k) / 2 : 0;
  return (x: number, y: number): [number, number] => {
    const [px, py] = [ox + x * iw * k, oy + y * ih * k];
    return [w / 2 + (px - w / 2) * zoom, py * zoom];
  };
};

// zoom-pan: one screenshot, and a camera that moves to a new part of it on each phrase.
// props: {image*, focus ([[x, y, w, h] | null, ...] fractions of the picture, one per phrase; null shows the
// whole picture), caption?, cursor? ([[x, y] | null, ...], one per phrase)}.
// reveals: 1 the picture rises in, then the camera moves to each focus in turn
export const ZoomPan: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const {u, width, height, vertical, landscape} = useLayout();
  const frame = useCurrentFrame();
  const p = usePop(cue(scene), 16);
  const [iw, ih] = scene.props.mediaSize ?? [1600, 1000];
  const caption = scene.props.caption;
  // the viewport: as big as the frame allows under the caption
  const vw = width - 2 * (vertical ? 60 : landscape ? 160 : 70) * u;
  const vh = (vertical ? (caption ? 1300 : 1500) : landscape ? (caption ? 780 : 900) : caption ? 720 : 860) * u;
  // a camera is the picture rectangle in view, as centre and width (its height follows the viewport's shape)
  const asp = vh / vw;
  const full = Math.min(iw, ih / asp);
  const least = vw / SHARP;
  const shot = (f: number[] | null | undefined) => {
    if (!f) return {x: iw / 2, y: (full * asp) / 2, w: full};
    const [fx, fy, fw, fh] = f;
    const w = Math.min(full, Math.max(least, fw * iw * 1.18, (fh * ih * 1.18) / asp));
    const clamp = (v: number, half: number, max: number) => Math.min(max - half, Math.max(half, v));
    return {x: clamp((fx + fw / 2) * iw, w / 2, iw), y: clamp((fy + fh / 2) * ih, (w * asp) / 2, ih), w};
  };
  const foci: (number[] | null)[] = scene.props.focus ?? [];
  let cam = shot(null);
  foci.forEach((f, k) => {
    if (k >= scene.cues.length) return;
    const t = interpolate(frame, [cue(scene, k), cue(scene, k) + MOVE], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: ease});
    if (t <= 0) return;
    const to = shot(f);
    cam = {x: cam.x + (to.x - cam.x) * t, y: cam.y + (to.y - cam.y) * t, w: cam.w + (to.w - cam.w) * t};
  });
  const s = vw / cam.w;
  const map = (x: number, y: number): [number, number] => [vw / 2 + (x * iw - cam.x) * s, vh / 2 + (y * ih - cam.y) * s];
  const r = (b.radius ?? 20) * u;
  const tilt = useTilt();
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 48 * u}}>
      {caption && <div style={{maxWidth: vw}}><Words text={caption} at={cue(scene) + 4} size={(landscape ? 64 : 62) * u} color={c.ink} accent={b.accent} /></div>}
      <div data-match style={{width: vw, height: vh, position: 'relative', borderRadius: r, overflow: 'hidden', background: b.paper, border: `${2 * u}px solid ${mix(c.ink, c.bg, 0.85)}`, boxShadow: `0 ${30 * u}px ${80 * u}px #00000030`, transform: `translateY(${(1 - p) * 140 * u}px) scale(${0.94 + 0.06 * p}) ${tilt}`, opacity: Math.min(1, p * 2)}}>
        <Img src={asset(scene.props.image)} style={{position: 'absolute', left: 0, top: 0, width: iw, height: ih, maxWidth: 'none', transformOrigin: '0 0', transform: `translate(${vw / 2 - cam.x * s}px, ${vh / 2 - cam.y * s}px) scale(${s})`}} />
        {scene.props.cursor && <CursorLayer scene={scene} points={scene.props.cursor} map={map} w={vw} h={vh} />}
      </div>
    </AbsoluteFill>
  );
};

export const PRODUCT_SCENES = {'zoom-pan': ZoomPan};
