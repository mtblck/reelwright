// story.json (+ brand.json) -> voice per phrase -> timeline -> <run>/props.json and <run>/public/*
// Usage: node build.mjs <run_dir>
// Reads <run>/story.json. Voice clips are cached in ~/.cache/reelwright/voice, so re-running after a
// visual-only edit is instant; changing a line re-voices only that line.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const FPS = 30;
const LEAD = 0.25; // seconds from a scene's cut to its first word
const PAUSE = 0.3; // between phrases inside a scene
const GAP = 0.45; // after a scene's last phrase, before the next cut
const TAIL = 1.4; // extra hold on the last scene
const WAYS = ['cut', 'slide', 'fade', 'zoom', 'splice', 'push', 'mask']; // the keys of TRANSITIONS in template/src/transitions.tsx
const MIN = {title: 2.2, statement: 2, screen: 3, features: 3, stat: 2.4, steps: 3, end: 2.6, kinetic: 1.2, reframe: 3};

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const run = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || !fs.existsSync(path.join(run, 'story.json'))) {
  console.error('usage: node build.mjs <run_dir>   (needs <run_dir>/story.json)');
  process.exit(1);
}
const env = Object.fromEntries(
  execFileSync('bash', [path.join(SKILL, 'scripts/setup.sh')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
    .trim().split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const story = JSON.parse(fs.readFileSync(path.join(run, 'story.json'), 'utf8'));
const pub = path.join(run, 'public');
fs.mkdirSync(pub, {recursive: true});

// --- brand: from a brand-kit brand.json when there is one, overridden by story.brand ---
function loadBrand() {
  let b = {};
  let dir = run;
  if (story.brandJson) {
    const file = path.resolve(run, story.brandJson);
    dir = path.dirname(file);
    const k = JSON.parse(fs.readFileSync(file, 'utf8'));
    const role = (r) => k.colors?.find((c) => c.role === r)?.hex;
    const logo = (f) => (f ? copy(path.resolve(dir, f), 'brand') : undefined);
    b = {
      name: k.name, tagline: k.tagline, url: k.website,
      ink: role('ink') ?? role('primary'), primary: role('primary'), accent: role('accent'),
      paper: role('paper') ?? '#ffffff', dark: role('dark') ?? role('primary'), support: role('support'),
      display: {family: k.type?.display?.family, weight: k.type?.display?.weight ?? 700},
      text: {family: k.type?.text?.family ?? k.type?.display?.family, weight: k.type?.text?.weight ?? 400},
      mark: logo(k.logos?.mark?.file), markDark: logo(k.logos?.mark?.dark ?? k.logos?.mark?.file),
    };
  }
  const o = story.brand ?? {};
  for (const f of ['mark', 'markDark']) if (o[f]) o[f] = copy(path.resolve(run, o[f]), 'brand');
  b = {...b, ...o, display: {...b.display, ...o.display}, text: {...b.text, ...o.text}};
  for (const f of ['name', 'paper', 'ink', 'primary', 'accent', 'dark']) if (!b[f]) throw new Error(`brand.${f} is missing: set story.brandJson or story.brand.${f}`);
  if (!b.display?.family) b.display = {family: 'Inter', weight: 800};
  if (!b.text?.family) b.text = {family: 'Inter', weight: 400};
  return b;
}
// copy a file into <run>/public/<sub>/ and return its public path
function copy(src, sub) {
  if (!fs.existsSync(src)) throw new Error(`not found: ${src}`);
  const rel = path.join(sub, path.basename(src));
  fs.mkdirSync(path.join(pub, sub), {recursive: true});
  if (path.resolve(src) !== path.join(pub, rel)) fs.copyFileSync(src, path.join(pub, rel));
  return rel;
}
const brand = loadBrand();

// --- fonts: fetched once with curl into the cache and served from public/fonts, so the render
// needs no network and no trust in whatever proxy sits in front of it ---
brand.fontCss = fonts([brand.display, brand.text]);
function fonts(list) {
  const fams = [...new Map(list.map((f) => [f.family, f])).values()];
  const q = fams.map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@400;${f.weight === 400 ? 700 : f.weight}`).join('&');
  const cache = path.join(path.dirname(env.KOKORO_MODEL), '..', 'fonts');
  const dir = path.join(pub, 'fonts');
  fs.mkdirSync(cache, {recursive: true});
  fs.mkdirSync(dir, {recursive: true});
  const ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140 Safari/537.36'; // asks for woff2
  let css;
  try {
    css = execFileSync('curl', ['-fsSL', '--retry', '2', '-A', ua, `https://fonts.googleapis.com/css2?${q}&display=block`], {encoding: 'utf8'});
  } catch {
    console.error(`! could not fetch ${fams.map((f) => f.family).join(', ')} from Google Fonts: falling back to system fonts`);
    return undefined;
  }
  css = css.replace(/url\((https:[^)]+)\)/g, (_, url) => {
    const name = url.split('/').slice(-2).join('-').replace(/[^\w.-]/g, '_');
    const hit = path.join(cache, name);
    if (!fs.existsSync(hit)) execFileSync('curl', ['-fsSL', '--retry', '2', '-o', hit, url]);
    fs.copyFileSync(hit, path.join(dir, name));
    return `url(${name})`;
  });
  fs.writeFileSync(path.join(dir, 'fonts.css'), css);
  return 'fonts/fonts.css';
}

// --- voice: one clip per phrase ---
const v = story.voice ?? {};
const pron = v.pronounce ?? {};
const spoken = (t) => Object.entries(pron).reduce((s, [a, b]) => s.replace(new RegExp(`\\b${a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi'), b), t.replace(/\*/g, ''));
const phrases = story.scenes.map((s) => (Array.isArray(s.say) ? s.say : s.say ? [s.say] : []));
const lines = phrases.flatMap((ps, i) => ps.map((t, j) => ({id: `s${i}p${j}`, text: spoken(t)})));
const voiceDir = path.join(path.dirname(env.KOKORO_MODEL), '..', 'voice');
const spec = path.join(run, '.lines.json');
fs.writeFileSync(spec, JSON.stringify({voice: v.voice ?? 'af_heart', speed: v.speed ?? 1, lines}));
const clips = lines.length
  ? JSON.parse(execFileSync(env.PYTHON, ['-I', path.join(SKILL, 'scripts/voice.py'), spec, voiceDir, env.KOKORO_MODEL, env.KOKORO_VOICES], {encoding: 'utf8', maxBuffer: 1 << 24}).trim().split('\n').pop())
  : {};
fs.rmSync(spec);

// --- timeline ---
// Beat sync: with a generated bed (or a file whose bpm the story gives), every cut lands on a beat of
// the music and the video ends on a bar line, so the last chord rings out with the end card. A cut moves
// to the nearest beat, or the one after when the nearest would clip the scene's last word or its minimum
// length. Only whole scenes move, so each phrase keeps its place against its reveal.
const m = story.music === false ? null : {mood: 'bright', volume: 0.22, ...story.music};
const MOOD_BPM = {bright: 112, calm: 88, tech: 120}; // keep in step with MOODS in music.mjs
const bpm = !m || story.beatSync === false ? 0 : m.file ? Number(m.bpm ?? 0) : Number(m.bpm ?? MOOD_BPM[m.mood] ?? 112);
const beat = bpm ? 60 / bpm : 0;
const SNAP_GAP = 0.2; // seconds a cut must stay clear of the scene's last word
const f = (s) => Math.round(s * FPS);
let t = 0;
const scenes = [];
const placed = []; // [file, startSeconds]
const speech = [];
story.scenes.forEach((s, i) => {
  const cues = [];
  let at = LEAD;
  phrases[i].forEach((_, j) => {
    const c = clips[`s${i}p${j}`];
    cues.push(f(at));
    placed.push([c.file, t + at]);
    speech.push([f(t + at), f(t + at + c.seconds)]);
    at += c.seconds + PAUSE;
  });
  if (!cues.length) cues.push(f(0.2));
  const talkEnd = phrases[i].length ? at - PAUSE : 0; // end of the scene's last word
  const last = i === story.scenes.length - 1;
  const min = (MIN[s.type] ?? 2) + (s.hold ?? 0);
  let len = phrases[i].length ? at - PAUSE + GAP : 2;
  len = Math.max(len, min) + (last ? TAIL : 0);
  if (beat && !last) {
    let end = Math.round((t + len) / beat) * beat;
    if (end - t < Math.max(talkEnd + SNAP_GAP, min)) end += beat;
    len = end - t;
  } else if (beat) {
    const bar = beat * 4;
    let end = Math.round((t + len) / bar) * bar;
    if (end - t < Math.max(talkEnd + 1, min)) end += bar;
    len = end - t;
  }
  const {type, say, enter, bg, hold, ...props} = s;
  // enter is a name ("push") or a name with options ({"type": "push", "direction": "up"})
  const {type: way = i === 0 ? 'cut' : 'slide', ...enterOpts} = typeof enter === 'object' && enter ? enter : {type: enter ?? undefined};
  if (!WAYS.includes(way)) throw new Error(`scene ${i + 1}: enter "${way}" is not one of ${WAYS.join(', ')}`);
  scenes.push({type, start: f(t), dur: f(len), enter: way, ...(Object.keys(enterOpts).length ? {enterOpts} : {}), bg: bg ?? 'paper', cues, props});
  t += len;
});
for (const [a, b] of scenes.slice(0, -1).map((s, i) => [s, scenes[i + 1]])) a.dur = b.start - a.start;
const total = scenes.at(-1).start + scenes.at(-1).dur;

// media used by scenes -> public/
const local = (o) => { for (const k of ['image', 'video']) if (o[k] && !/^https?:/.test(o[k])) o[k] = copy(path.resolve(run, o[k]), 'media'); };
for (const s of scenes) { local(s.props); (s.props.shapes ?? []).forEach(local); }

// one voice track, every clip at its place
let voice = null;
if (placed.length) {
  const ins = placed.flatMap(([file]) => ['-i', file]);
  const fc = placed.map(([, st], k) => `[${k}]aresample=48000,adelay=${Math.round(st * 1000)}:all=1[a${k}]`).join(';')
    + ';' + placed.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${placed.length}:normalize=0,apad=whole_dur=${(total / FPS).toFixed(3)}[v]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', fc, '-map', '[v]', '-ac', '1', '-ar', '48000', path.join(pub, 'voice.wav')]);
  voice = 'voice.wav';
}

// sound effects: a whoosh on moving cuts, ticks on list reveals, a click and chime on the end button
const SFX = path.join(SKILL, 'assets/sfx');
const sfx = [];
const add = (name, at, volume) => {
  if (story.sfx === false || !fs.existsSync(path.join(SFX, `${name}.wav`))) return;
  sfx.push({src: copy(path.join(SFX, `${name}.wav`), 'sfx'), at: Math.max(0, at), volume});
};
for (const s of scenes) {
  if (['slide', 'zoom', 'splice', 'push'].includes(s.enter)) add('whoosh', s.start - 4, 0.175);
  if (s.enter === 'mask') add('rise', s.start - 8, 0.3);
  if (s.type === 'reframe') { s.cues.slice(1, (s.props.shapes ?? []).length).forEach((c) => add('whoosh', s.start + c - 3, 0.15)); if (s.cues.length > (s.props.shapes ?? []).length) add('rise', s.start + s.cues[(s.props.shapes ?? []).length] - 6, 0.4); }
  if (s.type === 'features') s.cues.slice(1).forEach((c) => add('tick', s.start + c, 0.45));
  if (s.type === 'steps') s.cues.slice(s.props.title ? 1 : 0).forEach((c) => add('tick', s.start + c, 0.45));
  if (s.type === 'stat') add('rise', s.start + s.cues[0], 0.4);
  if (s.type === 'end') { add('click', s.start + (s.cues[1] ?? s.cues[0]) + 7, 0.6); add('chime', s.start + (s.cues[1] ?? s.cues[0]) + 10, 0.4); }
}

// music: a bed written to the video's length by music.mjs (CC0), or a file the story names
let music = null;
if (m) {
  let src;
  if (m.file) src = copy(path.resolve(run, m.file), 'music');
  else {
    fs.mkdirSync(path.join(pub, 'music'), {recursive: true});
    src = path.join('music', 'bed.wav');
    const extra = ['--mood', m.mood, ...(m.bpm ? ['--bpm', String(m.bpm)] : []), ...(m.key ? ['--key', m.key] : []), '--seed', String(m.seed ?? 7)];
    execFileSync('node', [path.join(SKILL, 'scripts/music.mjs'), path.join(pub, src), '--seconds', (total / FPS).toFixed(2), ...extra], {stdio: 'ignore'});
  }
  music = {src, volume: m.volume};
}

const props = {brand, scenes, voice, music, speech, sfx, durationInFrames: total};
fs.writeFileSync(path.join(run, 'props.json'), JSON.stringify(props, null, 1));
console.log(`${total} frames = ${(total / FPS).toFixed(1)} s${music ? `, music ${m.file ? path.basename(music.src) : `${m.mood} bed`}` : ', no music'}${beat ? `, cuts on the beat at ${bpm} bpm` : ''}`);
for (const [i, s] of scenes.entries()) console.log(`  f${String(s.start).padStart(4)}-${String(s.start + s.dur).padStart(4)}  ${s.type.padEnd(9)} ${phrases[i].join(' | ')}`);
