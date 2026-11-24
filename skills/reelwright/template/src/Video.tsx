import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, useCurrentFrame} from 'remotion';
import type {Props} from './types';
import {BrandContext, asset, sceneColors, useFonts} from './ui';
import {OVERLAP, Transitioned} from './transitions';
import {SCENES} from './scenes';

export const Video: React.FC<Props> = (p) => {
  useFonts(p.brand);
  const frame = useCurrentFrame();
  // music ducks to a third while the voice speaks, with a short ramp either side
  const duck = (f: number) => {
    const near = p.speech.some(([s, e]) => f >= s - 6 && f <= e + 6);
    return near ? 0.33 : 1;
  };
  return (
    <BrandContext.Provider value={p.brand}>
      <AbsoluteFill style={{background: p.brand.paper}}>
        {p.scenes.map((s, i) => {
          const Comp = (SCENES as any)[s.type];
          const c = sceneColors(p.brand, s.bg);
          return (
            <Sequence key={i} from={s.start} durationInFrames={s.dur + (i < p.scenes.length - 1 ? OVERLAP : 0)} name={`${i + 1} ${s.type}`}>
              <Transitioned scene={s} next={p.scenes[i + 1]}>
                <AbsoluteFill style={{background: c.bg}}>{Comp ? <Comp scene={s} c={c} /> : null}</AbsoluteFill>
              </Transitioned>
            </Sequence>
          );
        })}
        {p.voice && <Audio src={asset(p.voice)} />}
        {p.music && <Audio src={asset(p.music.src)} volume={(f) => p.music!.volume * duck(f) * interpolate(f, [p.durationInFrames - 45, p.durationInFrames], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})} />}
        {p.sfx.map((s, i) => (
          <Sequence key={`sfx${i}`} from={s.at} durationInFrames={90}>
            <Audio src={asset(s.src)} volume={s.volume ?? 0.5} />
          </Sequence>
        ))}
      </AbsoluteFill>
    </BrandContext.Provider>
  );
};
