import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Captions as C} from './types';
import {font, mix, ts, useBrand} from './ui';

// Burned-in captions: the line being spoken, a few words at a time, low in the frame. The word being
// said lights in the accent; words still to come are dimmed. Kept inside the platform safe zones: in the
// vertical cut, above the bottom quarter (TikTok, Reels and Shorts put the caption and buttons there) and
// clear of the right-hand button rail: the zones render.mjs stills --safe draws.
export const Captions: React.FC<{captions: C}> = ({captions}) => {
  const frame = useCurrentFrame();
  const b = useBrand();
  const {width, height, id} = useVideoConfig();
  if (!captions.formats.includes(id)) return null;
  const line = captions.lines.find((l) => frame >= l.from && frame < l.to);
  if (!line) return null;
  const u = Math.min(width, height) / 1080;
  const vertical = id === 'vertical';
  const size = ts((vertical ? 54 : id === 'square' || id === 'portrait' ? 46 : 44) * u);
  const bottom = height * (vertical ? 0.26 : 0.09);
  const p = interpolate(frame - line.from, [0, 4], [0, 1], {extrapolateRight: 'clamp'});
  const fade = interpolate(frame, [line.to - 3, line.to], [1, 0], {extrapolateLeft: 'clamp'});
  const bg = mix(b.dark, '#000000', 0.4);
  return (
    <AbsoluteFill data-captions style={{pointerEvents: 'none'}}>
      <div style={{position: 'absolute', left: 0, right: 0, bottom, display: 'flex', justifyContent: 'center', padding: `0 ${width * (vertical ? 0.18 : 0.1)}px`}}>
        <div style={{...font(b.display), fontSize: size, lineHeight: 1.25, textAlign: 'center', color: b.paper, background: `${bg}d9`, borderRadius: 14 * u, padding: `${0.22 * size}px ${0.5 * size}px`, opacity: Math.min(p * 2, 1) * fade, transform: `translateY(${(1 - p) * 10 * u}px) scale(${0.96 + 0.04 * p})`}}>
          {line.words.map((w, i) => {
            const now = frame >= w.from && frame < w.to;
            const said = frame >= w.to;
            return (
              <span key={i} style={{color: now ? b.accent : b.paper, opacity: now || said ? 1 : 0.6}}>
                {w.t.replace(/\*/g, '')}
                {i < line.words.length - 1 && !w.j ? ' ' : ''}
              </span>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
