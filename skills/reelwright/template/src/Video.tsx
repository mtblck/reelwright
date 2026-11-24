import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame} from 'remotion';
import type {Props} from './types';
import {BrandContext, asset, sceneColors, setTypeScale, useFonts} from './ui';
import {OVERLAP, Transitioned} from './transitions';
import {SCENES} from './scenes';
import {DEV_SCENES} from './devscenes';
import {PRODUCT_SCENES} from './product';
import {PROOF_SCENES} from './proof';
import {LookContext, lookOf} from './looks';
import {Captions} from './captions';

export const Video: React.FC<Props> = (p) => {
  useFonts(p.brand);
  setTypeScale(p.brand.typeScale);
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
  const Wrap = (!p.quiet && look.Wrap) || React.Fragment;
  return (
    <BrandContext.Provider value={p.brand}>
      <LookContext.Provider value={look}>
      <AbsoluteFill style={{background: p.brand.paper}}>
        <Wrap>
        {p.scenes.map((s, i) => {
          const Comp = ({...SCENES, ...DEV_SCENES, ...PRODUCT_SCENES, ...PROOF_SCENES} as any)[s.type];
          const c = sceneColors(p.brand, s.bg);
          return (
            <Sequence key={i} from={s.start} durationInFrames={s.dur + (i < p.scenes.length - 1 ? OVERLAP : 0)} name={`${i + 1} ${s.type}`}>
              <Transitioned scene={s} next={p.scenes[i + 1]}>
                <AbsoluteFill style={{background: c.bg, textTransform: look.upper ? 'uppercase' : undefined}}>{look.Back && <look.Back index={i} bg={c.bg} brand={p.brand} />}{Comp ? <Comp scene={s} c={c} /> : null}{look.Front && <look.Front index={i} bg={c.bg} brand={p.brand} />}</AbsoluteFill>
              </Transitioned>
            </Sequence>
          );
        })}
        </Wrap>
        {p.captions && <Captions captions={p.captions} />}
        {look.Over && !p.quiet && <look.Over />}
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
