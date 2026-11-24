import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Scene} from './types';
import {font, mix, sceneColors, ts, useBrand, useLayout, usePop} from './ui';
import {Typed, Words} from './scenes';
import {useTilt} from './looks';

// Scenes for projects with no app to film: a terminal session and a code snippet, each in a window.
// Both read real material: a terminal transcript recorded by scripts/term.mjs, and code from a file in
// the repo (build.mjs reads `file` into `code`). Text is set in the brand's mono face (build.mjs loads
// JetBrains Mono when a story uses these scenes).

type C = ReturnType<typeof sceneColors>;
type P = {scene: Scene; c: C};
const cue = (s: Scene, i = 0) => s.cues[Math.min(i, s.cues.length - 1)] ?? 0;
const MONO = 0.6; // a mono face's advance, in em
const MAX_LINES = 14;

const useWindow = () => {
  const {u, vertical, landscape} = useLayout();
  const {width} = useVideoConfig();
  const w = Math.min(width - 2 * (vertical ? 60 : 80) * u, (landscape ? 1440 : vertical ? 980 : 940) * u);
  return {u, vertical, landscape, w, pad: 36 * u};
};

// a dark window with three dots and a title, rising in at a cue
const Window: React.FC<{title?: string; at: number; w: number; children: React.ReactNode}> = ({title, at, w, children}) => {
  const b = useBrand();
  const {u} = useLayout();
  const p = usePop(at, 16);
  const tilt = useTilt();
  const bg = mix(b.dark, '#000000', 0.35);
  return (
    <div data-match style={{width: w, borderRadius: 18 * u, overflow: 'hidden', background: bg, border: `${2 * u}px solid ${mix(b.paper, bg, 0.85)}`, boxShadow: `0 ${30 * u}px ${80 * u}px #00000040`, transform: `translateY(${(1 - p) * 120 * u}px) scale(${0.94 + 0.06 * p}) ${tilt}`, opacity: Math.min(1, p * 2)}}>
      <div style={{height: 52 * u, display: 'flex', alignItems: 'center', gap: 11 * u, padding: `0 ${22 * u}px`, background: mix(b.paper, bg, 0.92)}}>
        {[0, 1, 2].map((i) => <div key={i} style={{width: 15 * u, height: 15 * u, borderRadius: 99, background: mix(b.paper, bg, 0.7)}} />)}
        {title && <div style={{...font(b.mono ?? b.text), flex: 1, textAlign: 'center', marginRight: 60 * u, fontSize: ts(20 * u), color: mix(b.paper, bg, 0.45)}}>{title}</div>}
      </div>
      {children}
    </div>
  );
};

// a caption above the window, like screen's, when the scene has one
const Layout: React.FC<{caption?: string; at: number; ink: string; children: React.ReactNode}> = ({caption, at, ink, children}) => {
  const b = useBrand();
  const {u, landscape} = useLayout();
  return (
    <AbsoluteFill style={{alignItems: 'center', justifyContent: 'center', gap: 48 * u, padding: 60 * u}}>
      {caption && <div style={{maxWidth: 1000 * u}}><Words text={caption} at={at} size={(landscape ? 64 : 62) * u} color={ink} accent={b.accent} /></div>}
      {children}
    </AbsoluteFill>
  );
};

// the font size that fits the longest line in the window, up to a comfortable reading size, but never
// under `least`: lines too long for that are cut with an ellipsis, as a narrow terminal would show them
const fit = (lines: string[], inner: number, base: number, least: number) => {
  const size = Math.max(least, Math.min(base, inner / (Math.max(20, ...lines.map((l) => l.length)) * MONO)));
  return {size, cols: Math.floor(inner / (size * MONO))};
};
const clip = (l: string, cols: number) => (l.length > cols ? `${l.slice(0, cols - 1)}…` : l);

// terminal: a command types on, its output prints, then one line lights up.
// props: {command*, output* (lines, or a string with newlines), highlight? (text in the line to light), caption?, title?, prompt? ('$')}
// reveals: 1 the command types; 2 the output prints; 3 the highlighted line lights up
export const Terminal: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const {u, vertical, landscape, w, pad} = useWindow();
  const command: string = scene.props.command ?? '';
  let output: string[] = Array.isArray(scene.props.output) ? scene.props.output : String(scene.props.output ?? '').split('\n');
  if (output.length > MAX_LINES) output = [...output.slice(0, MAX_LINES - 1), '…'];
  const prompt = `${scene.props.prompt ?? '$'} `;
  const hi = scene.props.highlight ? output.findIndex((l) => l.includes(scene.props.highlight)) : -1; // before lines are cut
  const f = fit([prompt + command, ...output], w - 2 * pad, (vertical ? 42 : landscape ? 32 : 34) * u, (vertical ? 30 : landscape ? 26 : 24) * u);
  const size = f.size; // already mono: a look's type scale (for wider faces) doesn't apply
  output = output.map((l) => clip(l, f.cols));
  const caption = scene.props.caption;
  const at = cue(scene) + (caption ? 10 : 6);
  const typedBy = at + Math.ceil(((command.length / 40) * 30));
  const outAt = Math.max(typedBy + 6, scene.cues.length > 1 ? cue(scene, 1) : 0);
  const hiAt = scene.cues.length > 2 ? cue(scene, 2) : outAt + output.length * 2 + 20;
  const lit = interpolate(frame, [hiAt, hiAt + 6], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const ink = mix(b.paper, b.dark, 0.08);
  const dim = mix(b.paper, b.dark, 0.4);
  return (
    <Layout caption={caption} at={cue(scene) + 2} ink={c.ink}>
      <Window title={scene.props.title ?? 'Terminal'} at={cue(scene)} w={w}>
        <div style={{...font(b.mono ?? b.text), fontVariantLigatures: 'none', fontWeight: 400, fontSize: size, lineHeight: 1.5, padding: pad, whiteSpace: 'pre', color: ink}}>
          <div><span style={{color: b.accent}}>{prompt}</span><Typed text={command} at={at} color={ink} accent={b.accent} /></div>
          {output.map((l, i) => {
            const on = frame >= outAt + i * 2;
            const isHi = i === hi;
            return (
              <div key={i} style={{opacity: on ? (hi >= 0 && !isHi ? 1 - 0.45 * lit : 1) : 0, color: isHi ? mix(ink, b.accent, lit) : dim, margin: `0 ${-pad / 2}px`, padding: `0 ${pad / 2}px`, borderRadius: 6 * u, background: isHi ? `${b.accent}${Math.round(lit * 0x26).toString(16).padStart(2, '0')}` : 'transparent'}}>{l || ' '}</div>
            );
          })}
        </div>
      </Window>
    </Layout>
  );
};

// A small highlighter, enough for a snippet on screen: comments, strings, numbers, keywords, calls.
const KEYWORDS = new Set('const let var function return if else for while do switch case break continue new class extends import export from as default async await try catch finally throw typeof instanceof in of def lambda pass yield with elif not and or is None True False null undefined true false this self fn pub mut impl struct enum match use mod type interface package func go defer echo then fi done'.split(' '));
const TOKEN = /(\/\/.*$|#(?![!{]).*$|\/\*.*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_.]*\b)|([A-Za-z_$][\w$]*)(?=\s*\()|([A-Za-z_$][\w$]*)|(\s+)|(.)/gm;
type Tok = {t: string; k: 'comment' | 'string' | 'number' | 'call' | 'keyword' | 'plain'};
const tokens = (line: string): Tok[] => {
  const out: Tok[] = [];
  for (const m of line.matchAll(TOKEN)) {
    const [t, com, str, num, call, word] = m;
    out.push({t, k: com ? 'comment' : str ? 'string' : num ? 'number' : call ? 'call' : word && KEYWORDS.has(word) ? 'keyword' : 'plain'});
  }
  return out;
};

// code: a snippet from the repo; its lines print, then each phrase lights a range of them.
// props: {code* (or file + lines: [from, to], read by build.mjs), highlights? ([[from, to], ...] 1-based, one per
// phrase after the first), caption?, title? (the file name)}. Lines starting "+ " or "- " show as a diff.
// reveals: 1 the window rises and the lines print; 2, 3...: each highlight in turn (the other lines dim)
export const Code: React.FC<P> = ({scene, c}) => {
  const b = useBrand();
  const frame = useCurrentFrame();
  const {u, vertical, landscape, w, pad} = useWindow();
  let lines: string[] = String(scene.props.code ?? '').replace(/\t/g, '  ').replace(/\n+$/, '').split('\n');
  if (lines.length > MAX_LINES) lines = [...lines.slice(0, MAX_LINES - 1), '…'];
  const first = Number(scene.props.lines?.[0] ?? 1); // the number of the first line shown
  const gutter = String(first + lines.length - 1).length + 2;
  const f = fit(lines.map((l) => ' '.repeat(gutter + 1) + l), w - 1.5 * pad, (vertical ? 40 : landscape ? 30 : 32) * u, (vertical ? 28 : landscape ? 24 : 22) * u);
  const size = f.size; // already mono: a look's type scale (for wider faces) doesn't apply
  lines = lines.map((l) => clip(l, f.cols - gutter - 1));
  const caption = scene.props.caption;
  const at = cue(scene) + (caption ? 10 : 6);
  const hl: number[][] = scene.props.highlights ?? [];
  // the highlight that's on now: the last one whose cue has passed
  let cur = -1;
  hl.forEach((_, i) => { if (frame >= cue(scene, i + 1) && scene.cues.length > i + 1) cur = i; });
  const since = cur >= 0 ? frame - cue(scene, cur + 1) : 0;
  const lit = cur >= 0 ? interpolate(since, [0, 6], [0, 1], {extrapolateRight: 'clamp'}) : 0;
  const [h0, h1] = cur >= 0 ? [hl[cur][0], hl[cur][1] ?? hl[cur][0]] : [0, -1];
  const bg = mix(b.dark, '#000000', 0.35);
  const col: Record<Tok['k'], string> = {
    plain: mix(b.paper, bg, 0.1),
    comment: mix(b.paper, bg, 0.55),
    string: mix(b.support ?? b.paper, b.accent, 0.25),
    number: mix(b.accent, b.paper, 0.35),
    keyword: b.accent,
    call: b.paper,
  };
  return (
    <Layout caption={caption} at={cue(scene) + 2} ink={c.ink}>
      <Window title={scene.props.title} at={cue(scene)} w={w}>
        <div style={{...font(b.mono ?? b.text), fontVariantLigatures: 'none', fontSize: size, lineHeight: 1.55, padding: `${pad}px ${pad}px ${pad}px ${pad / 2}px`, whiteSpace: 'pre'}}>
          {lines.map((l, i) => {
            const n = first + i;
            const on = frame >= at + i * 2;
            const inHi = n >= h0 && n <= h1;
            const diff = l.startsWith('+ ') ? 'add' : l.startsWith('- ') ? 'del' : null;
            const tint = diff === 'add' ? '#3fb95033' : diff === 'del' ? '#f8514933' : inHi ? `${b.accent}${Math.round(lit * 0x22).toString(16).padStart(2, '0')}` : 'transparent';
            return (
              <div key={i} style={{display: 'flex', opacity: on ? (cur >= 0 && !inHi ? 1 - 0.55 * lit : 1) : 0, background: tint, borderRadius: 6 * u}}>
                <span style={{width: `${gutter}ch`, flex: 'none', textAlign: 'right', paddingRight: '1.4ch', color: inHi ? b.accent : mix(b.paper, bg, 0.7)}}>{n}</span>
                <span>{tokens(l).map((t, j) => <span key={j} style={{color: col[t.k], fontWeight: t.k === 'keyword' || t.k === 'call' ? 700 : 400}}>{t.t}</span>)}</span>
              </div>
            );
          })}
        </div>
      </Window>
    </Layout>
  );
};

export const DEV_SCENES = {terminal: Terminal, code: Code};
