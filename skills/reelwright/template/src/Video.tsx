import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame} from 'remotion';
import type {Props} from './types';
import {BrandContext, asset, readable, sceneColors, setFallback, setOverlay, setTypeScale, useFonts} from './ui';
import {OVERLAP, Transitioned} from './transitions';
import {SCENES} from './scenes';
import {DEV_SCENES} from './devscenes';
import {PRODUCT_SCENES} from './product';
import {PROOF_SCENES} from './proof';
import {LookContext, lookOf} from './looks';
import {Captions} from './captions';
import {MATCH_LEN, MatchLayer} from './match';
import {Check} from './check';

export const Video: React.FC<Props> = (p) => {
  useFonts(p.brand);
  setTypeScale(p.brand.typeScale);
  setFallback(p.brand.fallback);
  setOverlay(!!p.overlay);
  const frame = useCurrentFrame();
  // music ducks to a third while the voice speaks, with a short ramp either side
  const duck = (f: number) => {
    const near = p.speech.some(([s, e]) => f >= s - 6 && f <= e + 6);
    return near ? 0.33 : 1;
  };
  // the music fades over its last 1.5 s, or stops dead where a tape stop ends it; either way it's silent after `until`
  const until = p.music?.until ?? p.durationInFrames;
  const musicEnd = (f: number) => (f >= until ? 0 : p.music?.stop ? 1 : interpolate(f, [until - 45, until], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}));
  const look = lookOf(p.look);
  // quiet: the GIF's pass, without the look's layers: GIFs can't compress grain, and dithering a vignette adds more noise (see render.mjs)
  // overlay: render.mjs overlay, for dropping into another edit: no backgrounds and none of the look's layers,
  // only what sits on them (text, devices, cards, the mark), over transparency
  const bare = p.quiet || p.overlay;
  const Wrap = (!bare && look.Wrap) || React.Fragment;
  // a match cut dips through the scenes' colours, which overlay leaves out: it fades instead
  const scenes = p.overlay ? p.scenes.map((s) => (s.enter === 'match' ? {...s, enter: 'fade'} : s)) : p.scenes;
  return (
    <BrandContext.Provider value={p.brand}>
      <LookContext.Provider value={look}>
      <AbsoluteFill style={{background: p.overlay ? 'transparent' : p.brand.paper}}>
        <Wrap>
        {scenes.map((s, i) => {
          const Comp = ({...SCENES, ...DEV_SCENES, ...PRODUCT_SCENES, ...PROOF_SCENES} as any)[s.type];
          const c = sceneColors(p.brand, s.bg);
          // the accent, lightened only as far as it takes to read at 3:1 on this scene's background (WCAG for large text and shapes)
          const accent = readable(p.brand.accent, c.bg, p.brand.paper);
          const brand = accent === p.brand.accent ? p.brand : {...p.brand, accent};
          return (
            <Sequence key={i} from={s.start} durationInFrames={s.dur + (i < scenes.length - 1 ? OVERLAP : 0)} name={`${i + 1} ${s.type}`}>
              <Transitioned scene={s} next={scenes[i + 1]}>
                <BrandContext.Provider value={brand}>
                <AbsoluteFill data-scene={i} style={{background: p.overlay ? undefined : c.bg, textTransform: look.upper ? 'uppercase' : undefined}}>{look.Back && !p.overlay && <look.Back index={i} bg={c.bg} brand={brand} />}{Comp ? <Comp scene={s} c={c} /> : null}{look.Front && !p.overlay && <look.Front index={i} bg={c.bg} brand={brand} />}</AbsoluteFill>
                </BrandContext.Provider>
              </Transitioned>
            </Sequence>
          );
        })}
        {scenes.map((s, i) => (i > 0 && s.enter === 'match' ? (
          <Sequence key={`m${i}`} from={s.start} durationInFrames={MATCH_LEN} name={`match ${i} to ${i + 1}`}>
            <MatchLayer from={i - 1} to={i} fromBg={sceneColors(p.brand, p.scenes[i - 1].bg).bg} toBg={sceneColors(p.brand, s.bg).bg} />
          </Sequence>
        ) : null))}
        </Wrap>
        {p.captions && <Captions captions={p.captions} />}
        {look.Over && !bare && <look.Over />}
        {p.check && <Check />}
        {p.voice && <Audio src={asset(p.voice)} />}
        {p.music && <Audio src={asset(p.music.src)} volume={(f) => p.music!.volume * duck(f) * musicEnd(f)} />}
        {p.sfx.map((s, i) => (
          <Sequence key={`sfx${i}`} from={s.at} durationInFrames={90}>
            <Audio src={asset(s.src)} volume={s.volume ?? 0.5} />
          </Sequence>
        ))}
      </AbsoluteFill>
      </LookContext.Provider>
    </BrandContext.Provider>
  );
};
