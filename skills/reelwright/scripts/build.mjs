// story.json (+ brand.json) -> voice per phrase -> timeline -> <run>/props.json and <run>/public/*
// Usage: node build.mjs <run_dir> [--length 6|15]
// --length builds a short cut of the same story by dropping scenes (see `keep` in story.md), into
// <run>/props-<n>s.json beside the full one; render.mjs --length <n> renders it.
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
const STING = 1.7; // seconds a stinger adds after the end card: 0.4 of dark, then the stinger
const GAP = 0.45; // after a scene's last phrase, before the next cut
const TAIL = 1.4; // extra hold on the last scene
const WAYS = ['cut', 'slide', 'fade', 'zoom', 'splice', 'push', 'mask', 'whip', 'glitch', 'match']; // the keys of TRANSITIONS in template/src/transitions.tsx
// names and default ways in of LOOKS in template/src/looks.tsx; `mono` swaps the brand's fonts for a mono face, set smaller (it runs wider)
const LOOKS = {clean: {enter: 'slide'}, film: {enter: 'splice'}, terminal: {enter: 'cut', mono: {family: 'JetBrains Mono', display: 800, text: 400, scale: 0.72}}, poster: {enter: 'cut', scale: 1.12}, blueprint: {enter: 'fade'}, paper: {enter: 'slide'}, sketch: {enter: 'fade'}, isometric: {enter: 'zoom'}};
const MIN = {title: 2.2, statement: 2, screen: 3, features: 3, stat: 2.4, steps: 3, end: 2.6, kinetic: 1.2, reframe: 3, terminal: 3.5, code: 3.5, 'zoom-pan': 3.5, 'before-after': 3.5, quote: 3, compare: 3, 'logo-wall': 2.6, diagram: 3};

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
// a short cut: scenes whose `keep` is at least this length (6 keeps a scene in the 6 s and 15 s cuts, 15 only in
// the 15 s one). With no `keep` anywhere: the first and last scenes, plus the title for 15 s.
const length = process.argv.includes('--length') ? Number(process.argv[process.argv.indexOf('--length') + 1]) : 0;
const suffix = length ? `-${length}s` : '';
if (length) {
  const all = story.scenes;
  const hinted = all.some((s) => s.keep != null);
  story.scenes = all.filter((s, i) => (hinted ? Number(s.keep) > 0 && Number(s.keep) <= length : i === 0 || i === all.length - 1 || (length >= 15 && s.type === 'title')));
  if (story.scenes.at(-1) !== all.at(-1) && all.at(-1).type === 'end' && !story.scenes.includes(all.at(-1))) story.scenes.push(all.at(-1)); // always end on the card
  if (!story.scenes.length) throw new Error(`no scenes to keep in a ${length} s cut`);
  // the first scene opens on a cut; a stinger doesn't fit a bumper
  story.scenes = story.scenes.map((s, i) => ({...s, ...(i === 0 ? {enter: 'cut'} : {}), ...(s.stinger && length < 15 ? {stinger: undefined} : {})}));
}
const look = story.look ?? 'clean';
if (!LOOKS[look]) throw new Error(`look "${look}" is not one of ${Object.keys(LOOKS).join(', ')}`);
const pub = path.join(run, 'public');
fs.mkdirSync(pub, {recursive: true});

// --- brand: from a brand-kit brand.json when there is one, else from the live site (brand.mjs writes
// <run>/site-brand.json), overridden by story.brand ---
function loadBrand() {
  let b = {};
  let dir = run;
  const site = path.join(run, 'site-brand.json');
  if (!story.brandJson && fs.existsSync(site)) {
    const {source, notes, ...k} = JSON.parse(fs.readFileSync(site, 'utf8'));
    for (const f of ['mark', 'markDark', 'logo', 'logoDark']) if (k[f]) k[f] = copy(path.resolve(run, k[f]), 'brand');
    b = k;
  }
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
  for (const f of ['mark', 'markDark', 'logo', 'logoDark']) if (o[f]) o[f] = copy(path.resolve(run, o[f]), 'brand');
  b = {...b, ...o, display: {...b.display, ...o.display}, text: {...b.text, ...o.text}};
  for (const f of ['name', 'paper', 'ink', 'primary', 'accent', 'dark']) if (!b[f]) throw new Error(`brand.${f} is missing: set story.brandJson, run brand.mjs on the site, or set story.brand.${f}`);
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
const mono = LOOKS[look].mono;
if (mono) { brand.display = {family: mono.family, weight: mono.display}; brand.text = {family: mono.family, weight: mono.text}; brand.typeScale = mono.scale; }
if (LOOKS[look].scale) brand.typeScale = LOOKS[look].scale;

// --- fonts: fetched once with curl into the cache and served from public/fonts, so the render
// needs no network and no trust in whatever proxy sits in front of it ---
// terminal and code scenes set their text in a mono face
if (story.scenes.some((s) => s.type === 'terminal' || s.type === 'code')) brand.mono ??= mono ? brand.display : {family: 'JetBrains Mono', weight: 700};
brand.fontCss = fonts([brand.display, brand.text, ...(brand.mono ? [brand.mono] : [])]);
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
// a kinetic scene with `accelerate` speaks each beat a little faster than the last
const quick = (i, j) => (story.scenes[i].accelerate ? 1 + 0.08 * j : 1);
const lines = phrases.flatMap((ps, i) => ps.map((t, j) => ({id: `s${i}p${j}`, text: spoken(t), ...(quick(i, j) > 1 ? {speed: (v.speed ?? 1) * quick(i, j)} : {})})));
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
const MOOD_BPM = {bright: 112, calm: 88, tech: 120, lofi: 80, cinematic: 72, minimal: 100}; // keep in step with MOODS in music.mjs
const bpm = !m || story.beatSync === false ? 0 : m.file ? Number(m.bpm ?? 0) : Number(m.bpm ?? MOOD_BPM[m.mood] ?? 112);
const beat = bpm ? 60 / bpm : 0;
const SNAP_GAP = 0.2; // seconds a cut must stay clear of the scene's last word
const f = (s) => Math.round(s * FPS);
let t = 0;
const scenes = [];
const placed = []; // [file, startSeconds]
const speech = [];
const lines4captions = []; // phrases to caption: written text, start in seconds, its clip
const lines4subs = []; // every phrase, for the subtitle files (a scene's captions: false only hides the burned-in ones)
story.scenes.forEach((s, i) => {
  const cues = [];
  let at = LEAD;
  phrases[i].forEach((_, j) => {
    const c = clips[`s${i}p${j}`];
    cues.push(f(at));
    placed.push([c.file, t + at]);
    speech.push([f(t + at), f(t + at + c.seconds)]);
    if (s.captions !== false) lines4captions.push({text: phrases[i][j], at: t + at, clip: c});
    lines4subs.push({text: phrases[i][j], at: t + at, clip: c});
    at += c.seconds + (s.accelerate ? PAUSE * Math.pow(0.5, j) : PAUSE); // accelerate: each gap half the last
  });
  if (!cues.length) cues.push(f(0.2));
  const talkEnd = phrases[i].length ? at - PAUSE : 0; // end of the scene's last word
  const last = i === story.scenes.length - 1;
  const min = (MIN[s.type] ?? 2) + (s.hold ?? 0);
  let len = phrases[i].length ? at - PAUSE + GAP : 2;
  len = Math.max(len, min) + (last ? TAIL : 0);
  // a stinger after the end card: the card holds to its bar line, then a beat of dark and the stinger
  const sting = last && s.type === 'end' && s.stinger ? STING : 0;
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
  if (sting) { s.stingAt = f(len); len += sting; }
  const {type, say, enter, bg, hold, captions: _c, accelerate: _a, ...props} = s;
  // enter is a name ("push") or a name with options ({"type": "push", "direction": "up"})
  const {type: way = i === 0 ? 'cut' : LOOKS[look].enter, ...enterOpts} = typeof enter === 'object' && enter ? enter : {type: enter ?? undefined};
  if (!WAYS.includes(way)) throw new Error(`scene ${i + 1}: enter "${way}" is not one of ${WAYS.join(', ')}`);
  scenes.push({type, start: f(t), dur: f(len), enter: way, ...(Object.keys(enterOpts).length ? {enterOpts} : {}), bg: bg ?? 'paper', cues, props});
  t += len;
});
if (scenes.filter((s) => s.enter === 'glitch').length > 1) console.warn('note: more than one glitch; it lands hardest once per video');
for (const [a, b] of scenes.slice(0, -1).map((s, i) => [s, scenes[i + 1]])) a.dur = b.start - a.start;
const total = scenes.at(-1).start + scenes.at(-1).dur;

// media used by scenes -> public/
// terminal: a transcript recorded by term.mjs; code: lines read from a file in the repo
for (const s of scenes) {
  if (s.type === 'terminal' && s.props.transcript) Object.assign(s.props, JSON.parse(fs.readFileSync(path.resolve(run, s.props.transcript), 'utf8')), {...s.props, transcript: undefined});
  if (s.type === 'code' && s.props.file) {
    const all = fs.readFileSync(path.resolve(run, s.props.file), 'utf8').split('\n');
    const [a, z] = s.props.lines ?? [1, all.length];
    s.props.code = all.slice(a - 1, z).join('\n');
    s.props.lines = [a, z];
    s.props.title ??= path.basename(s.props.file);
  }
}
// a picture's or clip's size in pixels, so zoom-pan can cap its zoom and a cursor can find its targets
const probe = (file) => { try { const [w, h] = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim().split(',').map(Number); return w && h ? [w, h] : undefined; } catch { return undefined; } };
// cursor and zoom-pan targets can name a box capture.mjs recorded ("Export button") instead of giving numbers:
// <device>-<shot>.png has its boxes in <device>-boxes.json under that shot, as fractions of the picture
function named(o, src) {
  const wants = (a) => (a ?? []).some((v) => typeof v === 'string');
  if (!wants(o.cursor) && !wants(o.focus)) return;
  const m = path.basename(src).match(/^(.+?)-(.+)\.png$/i);
  const file = m && path.join(path.dirname(src), `${m[1]}-boxes.json`);
  const boxes = file && fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8'))[m[2]] ?? {} : {};
  const get = (n) => { if (!boxes[n]) throw new Error(`no box "${n}" for ${path.basename(src)}: record it with a box step before that shot (have: ${Object.keys(boxes).join(', ') || 'none'})`); return boxes[n]; };
  if (o.cursor) o.cursor = o.cursor.map((v) => (typeof v === 'string' ? (([x, y, w, h]) => [Math.round((x + w / 2) * 1e4) / 1e4, Math.round((y + h / 2) * 1e4) / 1e4])(get(v)) : v));
  if (o.focus) o.focus = o.focus.map((v) => (typeof v === 'string' ? get(v) : v));
}
const local = (o) => { if (o.image && !/^https?:/.test(o.image)) named(o, path.resolve(run, o.image)); for (const k of ['before', 'after', 'avatar']) if (o[k] && !/^https?:/.test(o[k])) o[k] = copy(path.resolve(run, o[k]), 'media'); for (const k of ['image', 'video']) if (o[k] && !/^https?:/.test(o[k])) { const src = path.resolve(run, o[k]); o.mediaSize ??= probe(src); o[k] = copy(src, 'media'); } };
for (const s of scenes) { local(s.props); (s.props.shapes ?? []).forEach(local); (s.props.logos ?? []).forEach(local); }

// one voice track, every clip at its place
let voice = null;
if (placed.length) {
  const ins = placed.flatMap(([file]) => ['-i', file]);
  const fc = placed.map(([, st], k) => `[${k}]aresample=48000,adelay=${Math.round(st * 1000)}:all=1[a${k}]`).join(';')
    + ';' + placed.map((_, k) => `[a${k}]`).join('') + `amix=inputs=${placed.length}:normalize=0,apad=whole_dur=${(total / FPS).toFixed(3)}[v]`;
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...ins, '-filter_complex', fc, '-map', '[v]', '-ac', '1', '-ar', '48000', path.join(pub, `voice${suffix}.wav`)]);
  voice = `voice${suffix}.wav`;
}

// sound effects: a whoosh on moving cuts, ticks on list reveals, a click and chime on the end button
const SFX = path.join(SKILL, 'assets/sfx');
const sfx = [];
const add = (name, at, volume) => {
  if (story.sfx === false || !fs.existsSync(path.join(SFX, `${name}.wav`))) return;
  sfx.push({src: copy(path.join(SFX, `${name}.wav`), 'sfx'), at: Math.max(0, at), volume});
};
for (const s of scenes) {
  if (['slide', 'zoom', 'splice', 'push', 'whip'].includes(s.enter)) add('whoosh', s.start - 4, 0.175);
  if (s.enter === 'glitch') add('glitch', s.start, 0.15);
  if (s.type === 'reframe') { s.cues.slice(1, (s.props.shapes ?? []).length).forEach((c) => add('whoosh', s.start + c - 3, 0.15)); if (s.cues.length > (s.props.shapes ?? []).length) add('rise', s.start + s.cues[(s.props.shapes ?? []).length] - 6, 0.4); }
  if (s.type === 'features') s.cues.slice(1).forEach((c) => add('tick', s.start + c, 0.45));
  if (s.type === 'steps') s.cues.slice(s.props.title ? 1 : 0).forEach((c) => add('tick', s.start + c, 0.45));
  if (s.type === 'stat') add('rise', s.start + s.cues[0], 0.4);
  // a cursor clicks each target 20 frames after its phrase starts (CLICK_AT in product.tsx)
  (s.props.cursor ?? []).forEach((pt, k) => { if (pt && k < s.cues.length) add('click', s.start + s.cues[k] + 20, 0.5); });
  // a sub drop under the title, a riser into a reframe (ending on its cut), a hit on a stinger
  if (s.type === 'title') add('hit', s.start + s.cues[0], 0.15);
  if (s.type === 'reframe') add('riser', s.start - 45, 0.15);
  if (s.props.stingAt) add('hit', s.start + s.props.stingAt + 12, 0.15);
  if (s.type === 'end') { add('click', s.start + (s.cues[1] ?? s.cues[0]) + 7, 0.6); add('chime', s.start + (s.cues[1] ?? s.cues[0]) + 10, 0.4); }
}

// music: a bed written to the video's length by music.mjs (CC0), or a file the story names
let music = null;
const endScene = scenes.at(-1);
const until = endScene.props.stingAt ? endScene.start + endScene.props.stingAt : total;
if (m) {
  let src;
  if (m.file) src = copy(path.resolve(run, m.file), 'music');
  else {
    fs.mkdirSync(path.join(pub, 'music'), {recursive: true});
    src = path.join('music', `bed${suffix}.wav`);
    const extra = ['--mood', m.mood, ...(m.bpm ? ['--bpm', String(m.bpm)] : []), ...(m.key ? ['--key', m.key] : []), '--seed', String(m.seed ?? 7)];
    if (m.end === 'tapestop') extra.push('--stop', (until / FPS).toFixed(3));
    execFileSync('node', [path.join(SKILL, 'scripts/music.mjs'), path.join(pub, src), '--seconds', (until / FPS).toFixed(2), ...extra], {stdio: 'ignore'});
  }
  // until: the frame the music ends on (before a stinger); a tape stop ends it there instead of a fade
  music = {src, volume: m.volume, until, ...(m.end === 'tapestop' && !m.file ? {stop: true} : {})};
}

// --- captions: word timings for each phrase, then short lines of a few words ---
// Kokoro gives no word timings, so they are estimated: the phrase splits at its punctuation, each break
// lands on a silence found in the clip (voice.py), and the words between share the time by syllables.
const syllables = (w) => /^[A-Z]{2,}\W*$/.test(w) ? w.replace(/\W/g, '').length : /\d/.test(w) ? w.replace(/\D/g, '').length + 1 : Math.max(1, (w.toLowerCase().replace(/e\b/, '').match(/[aeiouy]+/g) ?? []).length);
function wordTimes(text, at, clip) {
  const words = text.replace(/\*/g, '').split(/\s+/).filter(Boolean);
  const breaks = words.slice(0, -1).map((w, k) => (/[,;:.!?—–]$/.test(w) ? k : -1)).filter((k) => k >= 0);
  let gaps = [...(clip.pauses ?? [])];
  if (gaps.length > breaks.length) gaps = gaps.sort((a, b) => (b[1] - b[0]) - (a[1] - a[0])).slice(0, breaks.length).sort((a, b) => a[0] - b[0]);
  const use = gaps.length === breaks.length;
  // segments of words with their time span
  const segs = [];
  let from = 0, w0 = 0;
  (use ? breaks : []).forEach((k, n) => { segs.push([w0, k + 1, from, gaps[n][0]]); w0 = k + 1; from = gaps[n][1]; });
  segs.push([w0, words.length, from, clip.seconds]);
  const out = [];
  for (const [a, b, s0, s1] of segs) {
    const ws = words.slice(a, b);
    const total = ws.reduce((n, w) => n + syllables(w) + 0.3, 0);
    let x = s0;
    for (const w of ws) { const d = ((syllables(w) + 0.3) / total) * (s1 - s0); out.push({t: w, from: f(at + x), to: f(at + x + d)}); x += d; }
  }
  return out;
}
const MAX_WORDS = 4, MAX_CHARS = 22;
const captionLines = [];
for (const ln of lines4captions) {
  const ws = wordTimes(ln.text, ln.at, ln.clip);
  // runs of words between punctuation (a lone word joins the next run), each cut into even lines
  const runs = [[]];
  ws.forEach((w, k) => { runs.at(-1).push(w); if (/[,;:.!?—–]$/.test(w.t) && runs.at(-1).length >= 2 && k < ws.length - 1) runs.push([]); });
  if (runs.length > 1 && runs.at(-1).length === 1 && runs.at(-2).length < MAX_WORDS) runs.at(-2).push(...runs.pop());
  for (const run of runs) {
    let n = Math.ceil(run.length / MAX_WORDS);
    const chars = run.map((w) => w.t).join(' ').length;
    n = Math.min(run.length, Math.max(n, Math.ceil(chars / MAX_CHARS)));
    for (let k = 0; k < n; k++) {
      const part = run.slice(Math.round((k * run.length) / n), Math.round(((k + 1) * run.length) / n));
      if (part.length) captionLines.push({from: part[0].from, to: part.at(-1).to, words: part});
    }
  }
}
// each line stays up until the next one, or a beat after its last word
captionLines.forEach((c, k) => { const next = captionLines[k + 1]; c.to = Math.min(c.to + 8, next ? next.from : Infinity); });
// on by default for the vertical and square cuts (mostly watched muted in feeds), off for landscape
const captions = story.captions === false ? null : {formats: story.captions === true ? ['vertical', 'square', 'landscape'] : Array.isArray(story.captions) ? story.captions : ['vertical', 'square'], lines: captionLines};

// subtitle cues for .srt/.vtt: each phrase as written (no pronounce respellings, no stars), split at
// punctuation into cues of at most two 42-character lines
const subtitles = [];
for (const ln of lines4subs) {
  const ws = wordTimes(ln.text, ln.at, ln.clip);
  let cue = [];
  const flush = () => { if (cue.length) subtitles.push({from: cue[0].from, to: cue.at(-1).to, text: cue.map((w) => w.t).join(' ')}); cue = []; };
  ws.forEach((w) => {
    if (cue.length && [...cue, w].map((x) => x.t).join(' ').length > 84) flush();
    cue.push(w);
    if (/[.!?]$/.test(w.t) && cue.map((x) => x.t).join(' ').length > 30) flush();
  });
  flush();
}
// each cue stays up a little past its last word, but never into the next one
subtitles.forEach((c, k) => { const next = subtitles[k + 1]; c.to = Math.max(c.from + 1, Math.min(c.to + 12, next ? next.from - 1 : total)); });
// chapters, one per scene (a scene's `chapter` names it), joined until each runs 10 s, as YouTube asks
const sceneName = (s, i) => {
  if (story.scenes[i].chapter) return story.scenes[i].chapter;
  const first = ((s.type === 'title' && (s.props.name ?? brand.name)) || phrases[i][0] || s.type).replace(/\*/g, '').replace(/[.!?,;:]+$/, '').trim();
  const k = first.lastIndexOf(' ', 40);
  return first.length > 40 ? first.slice(0, k > 10 ? k : 40) + '…' : first;
};
const chapters = [];
scenes.forEach((s, i) => {
  const prev = chapters.at(-1);
  if (prev && (s.start - prev.at < 10 * FPS)) return; // the previous chapter is still too short: this scene joins it
  chapters.push({at: chapters.length ? s.start : 0, title: sceneName(s, i)});
});
if (chapters.length > 1 && total - chapters.at(-1).at < 10 * FPS) chapters.pop();

const props = {brand, look, scenes, voice, music, speech, sfx, captions, subtitles, chapters, durationInFrames: total};
fs.writeFileSync(path.join(run, `props${suffix}.json`), JSON.stringify(props, null, 1));
if (length && total / FPS > length * 1.25) console.warn(`note: the ${length} s cut runs ${(total / FPS).toFixed(1)} s; mark fewer scenes with keep, or shorter ones`);
console.log(`${suffix ? `${length} s cut: ` : ''}${total} frames = ${(total / FPS).toFixed(1)} s, ${look} look${music ? `, music ${m.file ? path.basename(music.src) : `${m.mood} bed`}` : ', no music'}${beat ? `, cuts on the beat at ${bpm} bpm` : ''}`);
for (const [i, s] of scenes.entries()) console.log(`  f${String(s.start).padStart(4)}-${String(s.start + s.dur).padStart(4)}  ${s.type.padEnd(9)} ${phrases[i].join(' | ')}`);
