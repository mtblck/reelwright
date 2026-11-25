// Look at a reference video or page someone likes, so the story can borrow its style (pace, colour use, ways in)
// without borrowing anything in it.
// Usage: node reference.mjs <video file | http(s) url> <run_dir>
// Writes <run>/reference/: sheet.png (one still per shot, with its start time), reference.json (shots, pace,
// tone, motion and a suggested mapping onto Reelwright's scenes, ways in and looks), and the downloaded video
// when given a link to one. A web page gives screenshots and no pace. Nothing here goes into the video:
// build.mjs refuses a story that points into reference/.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const [src, run] = process.argv.slice(2);
if (!src || !run) { console.error('usage: node reference.mjs <video file | http(s) url> <run_dir>'); process.exit(1); }
const dir = path.join(run, 'reference');
fs.mkdirSync(dir, {recursive: true});
// clear what an earlier run wrote, but not a download being measured again (reference/source.mp4)
for (const f of fs.readdirSync(dir)) if (/^(s\d+\.png|page-\d+\.png|sheet\.png|reference\.json|download)$/.test(f)) fs.rmSync(path.join(dir, f), {force: true});
// video sites send a player page, not the video: screenshots of it would be the site's look, not the reference's
const SITES = /(^|\.)(youtube\.com|youtu\.be|vimeo\.com|tiktok\.com|instagram\.com|facebook\.com|fb\.watch|x\.com|twitter\.com|loom\.com|dailymotion\.com|twitch\.tv|linkedin\.com)$/i;
if (/^https?:\/\//.test(src) && SITES.test(new URL(src).hostname)) {
  console.error(`! ${new URL(src).hostname} doesn't hand over the video file. Ask for the file itself (downloaded, or the original export) and give me its path.`);
  process.exit(1);
}
const MAX_BYTES = 300 * 1024 * 1024; // a reference is a short video; refuse anything feature length
const MAX_SECS = 180; // only the first three minutes are measured
const MAX_STILLS = 24;
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a], {stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 << 20}).toString();
const r1 = (n) => Math.round(n * 10) / 10;

// ---- get the reference ------------------------------------------------------------------------------------------
let file = null;
let page = null;
if (/^https?:\/\//.test(src)) {
  // curl, as build.mjs uses for fonts: it follows the session's proxy, stays on http(s) through redirects and stops at 300 MB
  const tmp = path.join(dir, 'download');
  let type, final;
  try {
    [type, final] = execFileSync('curl', ['-fsSL', '--retry', '2', '--proto', '=http,https', '--proto-redir', '=http,https', '--max-filesize', String(MAX_BYTES), '--max-time', '600', '-o', tmp, '-w', '%{content_type}\n%{url_effective}', src], {encoding: 'utf8'}).split('\n');
  } catch (e) {
    fs.rmSync(tmp, {force: true});
    console.error(e.status === 63 ? '! that video is over 300 MB; trim it or give me a shorter cut' : `! couldn't fetch ${src}: ${String(e.stderr ?? e.message).trim()}`);
    process.exit(1);
  }
  if (fs.statSync(tmp).size > MAX_BYTES) { fs.rmSync(tmp, {force: true}); console.error('! that video is over 300 MB; trim it or give me a shorter cut'); process.exit(1); }
  const ext = new URL(final || src).pathname.match(/\.(mp4|m4v|mov|webm|mkv)$/i)?.[1]?.toLowerCase();
  if (/^video\//.test(type) || ext) {
    for (const f of fs.readdirSync(dir)) if (/^source\./.test(f)) fs.rmSync(path.join(dir, f), {force: true});
    file = path.join(dir, `source.${ext ?? (type.includes('webm') ? 'webm' : type.includes('quicktime') ? 'mov' : 'mp4')}`);
    fs.renameSync(tmp, file);
  } else if (/html/.test(type)) {
    page = final || src;
    fs.rmSync(tmp, {force: true});
  } else {
    fs.rmSync(tmp, {force: true});
    console.error(`! ${src} is ${type || 'an unknown type'}, not a video or a web page. Video sites (YouTube, Vimeo) don't hand over the file: download it and give me the path.`);
    process.exit(1);
  }
} else {
  if (!fs.existsSync(src)) { console.error(`! no such file: ${src}`); process.exit(1); }
  file = path.resolve(src);
}

// ---- a web page: screenshots down the page, desktop and phone -------------------------------------------------------
if (page) {
  const roots = [];
  try { roots.push(execFileSync('npm', ['root', '-g'], {encoding: 'utf8'}).trim()); } catch {}
  let pw = null;
  for (const r of roots) { try { pw = createRequire(path.join(r, 'x.js'))('playwright'); break; } catch {} }
  try { pw ??= createRequire(import.meta.url)('playwright'); } catch {}
  if (!pw) { console.error('! Playwright not found. Install it once with: npm i -g playwright && npx playwright install chromium'); process.exit(1); }
  const browser = await pw.chromium.launch();
  const shots = [];
  for (const [name, vp] of [['desktop', {width: 1440, height: 900}], ['phone', {width: 390, height: 844}]]) {
    const p = await (await browser.newContext({viewport: vp})).newPage();
    await p.goto(page, {waitUntil: 'load', timeout: 60000});
    await p.waitForTimeout(1500);
    const h = await p.evaluate(() => document.documentElement.scrollHeight);
    const stops = name === 'desktop' ? 4 : 2;
    for (let i = 0; i < stops; i++) {
      await p.evaluate((y) => window.scrollTo(0, y), Math.round((Math.max(0, h - vp.height) * i) / Math.max(1, stops - 1)));
      await p.waitForTimeout(700);
      const n = String(shots.length + 1).padStart(3, '0');
      const full = path.join(dir, `page-${n}.png`);
      await p.screenshot({path: full});
      ff('-i', full, '-vf', 'scale=480:270:force_original_aspect_ratio=decrease,pad=480:270:(ow-iw)/2:(oh-ih)/2:0xdddddd', path.join(dir, `s${n}.png`));
      shots.push({still: `page-${n}.png`, view: name});
    }
  }
  await browser.close();
  ff('-pattern_type', 'glob', '-i', path.join(dir, 's*.png'), '-vf', 'tile=3x2:padding=8:color=white', '-frames:v', '1', path.join(dir, 'sheet.png'));
  const out = {source: src, kind: 'page', shots, note: 'A page has no pace: read the sheet for type, colour use, layout and texture. For cut rhythm, ask for a video.'};
  fs.writeFileSync(path.join(dir, 'reference.json'), JSON.stringify(out, null, 1));
  console.log(`reference: a web page, ${shots.length} screenshots\n  ${path.join(dir, 'sheet.png')} (each one full size in page-*.png)\n  ${out.note}`);
  process.exit(0);
}

// ---- a video: shots, pace, tone, motion -----------------------------------------------------------------------------
let info;
try {
  info = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=format_name,duration:stream=codec_type,width,height,avg_frame_rate,duration', '-of', 'json', file], {encoding: 'utf8'}));
} catch { console.error(`! ffmpeg can't read ${src} as a video`); process.exit(1); }
// a playlist or concat list can point at other files; only take a plain video
if (/hls|concat|m3u|dash|image2/.test(info.format?.format_name ?? '')) { console.error('! that is a playlist, not a video file; give me the video itself'); process.exit(1); }
const vs = (info.streams ?? []).find((s) => s.codec_type === 'video');
if (!vs) { console.error(`! ${src} has no video in it`); process.exit(1); }
// recordings from a browser often carry no length; the frames tell it then
let duration = [info.format.duration, vs.duration].map(Number).find((d) => d > 0) ?? Infinity;
const [fn, fd] = vs.avg_frame_rate.split('/').map(Number);
const fps = fd ? fn / fd : 30;
let span = Math.min(duration, MAX_SECS);

// every frame's change from the last (0 to 1), and its brightness and saturation, at a small size
const lines = ff('-t', String(span), '-i', file, '-an', '-vf', 'scale=320:-2,format=yuv420p,signalstats,select=gte(scene\\,0),metadata=print:file=-', '-f', 'null', '-');
const frames = [];
for (const l of lines.split('\n')) {
  const t = l.match(/pts_time:([\d.]+)/);
  if (t) { frames.push({t: Number(t[1]), score: 0, y: 0, sat: 0}); continue; }
  const f = frames[frames.length - 1];
  const m = l.match(/^lavfi\.(scene_score|signalstats\.YAVG|signalstats\.SATAVG)=([\d.]+)/);
  if (f && m) f[{scene_score: 'score', 'signalstats.YAVG': 'y', 'signalstats.SATAVG': 'sat'}[m[1]]] = Number(m[2]);
}
if (frames.length < 2) { console.error(`! couldn't read frames from ${src}`); process.exit(1); }
span = Math.min(span, frames[frames.length - 1].t + 1 / fps); // the picture can end before the sound
const capped = duration > MAX_SECS && span >= MAX_SECS - 0.5;
if (!capped) duration = span;

// a hard cut is a big jump between two frames; two within a quarter second are one cut with a flash in it.
// A move (slide, push, wipe, dissolve) spreads its change over several frames, so it shows up as a jump only
// between frames a fifth of a second apart: a second, coarser pass finds those.
const CUT = 0.3;
const hard = [];
for (let i = 1; i < frames.length; i++) if (frames[i].score >= CUT && (!hard.length || frames[i].t - hard[hard.length - 1] > 0.25)) hard.push(frames[i].t);
const coarse = [];
let at = null;
for (const l of ff('-t', String(span), '-i', file, '-an', '-vf', 'fps=5,scale=320:-2,select=gte(scene\\,0),metadata=print:file=-', '-f', 'null', '-').split('\n')) {
  const t = l.match(/pts_time:([\d.]+)/);
  if (t) { at = Number(t[1]); continue; }
  const m = l.match(/^lavfi\.scene_score=([\d.]+)/);
  if (m && Number(m[1]) >= CUT && at != null) coarse.push(at);
}
const soft = coarse.filter((t) => !hard.some((h) => Math.abs(h - t) <= 0.4)).filter((t, i, a) => !i || t - a[i - 1] > 0.4);
const cuts = [...hard.map((t) => ({t, hard: true})), ...soft.map((t) => ({t: Math.max(0, t - 0.2), hard: false}))].sort((a, b) => a.t - b.t).filter((c) => c.t > 0.1 && c.t < span - 0.1);
const bounds = [0, ...cuts.map((c) => c.t), span];
const shots = [];
for (let i = 0; i < bounds.length - 1; i++) {
  const [a, b] = [bounds[i], bounds[i + 1]];
  const inside = frames.filter((f) => f.t > a + 0.05 && f.t < b - 0.05);
  const avg = (k) => (inside.length ? inside.reduce((s, f) => s + f[k], 0) / inside.length : 0);
  shots.push({start: r1(a), way: i ? (cuts[i - 1].hard ? 'cut' : 'move') : null, length: Math.round((b - a) * 100) / 100, brightness: Math.round(avg('y')), saturation: Math.round(avg('sat')), motion: Math.round(avg('score') * 1000) / 1000});
}

// dips through black
let dips = 0;
try {
  const bd = execFileSync('ffmpeg', ['-v', 'info', '-t', String(span), '-i', file, '-an', '-vf', 'blackdetect=d=0.04:pix_th=0.1', '-f', 'null', '-'], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']});
  dips = (bd.match(/black_start/g) ?? []).length;
} catch (e) { dips = (String(e.stderr ?? '').match(/black_start/g) ?? []).length; }

// one still from the middle of each shot (spread evenly when there are more than fit), labelled with its time
const pick = shots.length <= MAX_STILLS ? shots : Array.from({length: MAX_STILLS}, (_, i) => shots[Math.round((i * (shots.length - 1)) / (MAX_STILLS - 1))]);
let labels = true;
pick.forEach((s, i) => {
  const f = path.join(dir, `s${String(i + 1).padStart(3, '0')}.png`);
  const at = String(Math.max(0, s.start + s.length / 2 - 0.5 / fps));
  const [fit, pad] = ['scale=480:270:force_original_aspect_ratio=decrease', ',pad=480:270:(ow-iw)/2:(oh-ih)/2:0xdddddd'];
  const label = `,drawtext=text='${s.start.toFixed(1)} s':fontcolor=white:fontsize=18:x=8:y=8:box=1:boxcolor=black@0.6:boxborderw=4`;
  try { ff('-ss', at, '-i', file, '-frames:v', '1', '-vf', fit + (labels ? label : '') + pad, f); } catch { labels = false; ff('-ss', at, '-i', file, '-frames:v', '1', '-vf', fit + pad, f); }
  s.still = path.basename(f);
});
const cols = Math.min(6, pick.length);
ff('-pattern_type', 'glob', '-i', path.join(dir, 's*.png'), '-vf', `tile=${cols}x${Math.ceil(pick.length / cols)}:padding=8:color=white`, '-frames:v', '1', path.join(dir, 'sheet.png'));

// ---- what it adds up to ---------------------------------------------------------------------------------------------
const lens = shots.map((s) => s.length).sort((a, b) => a - b);
const median = lens[Math.floor(lens.length / 2)];
const weighted = (k) => shots.reduce((s, x) => s + x[k] * x.length, 0) / span;
const bright = weighted('brightness'); // 16 (black) to 235 (white) in video range
const sat = weighted('saturation');
const motion = weighted('motion');
const pace = shots.length < 2 ? 'one shot' : median < 1 ? 'fast' : median <= 2.5 ? 'medium' : 'slow';
const tone = bright < 85 ? 'dark' : bright > 165 ? 'light' : 'mixed';
const colour = sat < 12 ? 'muted' : sat > 45 ? 'saturated' : 'moderate';
const moves = cuts.filter((c) => !c.hard).length / Math.max(1, cuts.length);
const ways = !cuts.length ? null : moves > 0.6 ? 'moves' : moves < 0.25 ? 'cuts' : 'both';
const moving = motion < 0.004 ? 'still' : motion > 0.02 ? 'busy' : 'gentle';
const suggest = {
  pace: {fast: 'Short phrases (two to four words) so reveals land every second or so; kinetic scenes with stack and accelerate; ways in cut, whip and glitch; the Hype template.',
    medium: 'The usual one idea per scene; ways in slide and push; the App launch or Feature demo template.',
    slow: 'Fewer, longer scenes with "hold"; ways in fade, zoom and match; zoom-pan over one screen; a calm music mood.',
    'one shot': 'One continuous shot: a screen or zoom-pan scene carries it, with words laid over it; ways in fade.'}[pace],
  bg: {dark: 'Mostly "bg": "dark", with paper for one or two beats.', light: 'Mostly "bg": "paper", with dark for one or two beats.', mixed: 'Alternate dark and paper, as usual.'}[tone],
  colour: {muted: 'Keep colour for the starred words; "brand" backgrounds at most once; the film look suits a muted grade.', saturated: 'Lean on the brand colour: a "brand" background for the hook or end, and the accent on starred words.', moderate: 'Brand colour as usual.'}[colour],
  motion: {still: 'Stillness: statement, title and stat scenes, the poster look, little camera movement.', busy: 'Constant movement: screen clips and zoom-pan with a cursor, push and whip between scenes.', gentle: 'Gentle movement: zoom-pan and the default motion.'}[moving],
  ways: {cuts: 'Hard cuts between shots: the cut way in, or glitch for a jolt.', moves: 'Shots slide, push or dissolve into each other: slide, push, whip, zoom or fade, more than cut.', both: 'A mix of hard cuts and moves: cut inside a section, slide or push between sections.'}[ways] ?? null,
  dips: dips >= 2 ? 'It dips through black between sections: use the fade way in at those turns.' : null,
};
const out = {source: src, kind: 'video', duration: isFinite(duration) ? r1(duration) : null, measured: r1(span), size: [vs.width, vs.height], fps: r1(fps),
  cuts: cuts.length, hardCuts: cuts.filter((c) => c.hard).length, ways, cutsPerMinute: r1((cuts.length / span) * 60), shotLength: {median: r1(median), shortest: r1(lens[0]), longest: r1(lens[lens.length - 1])},
  pace, tone, colour, motion: moving, dips, suggest, shots};
fs.writeFileSync(path.join(dir, 'reference.json'), JSON.stringify(out, null, 1));

console.log(`reference: ${isFinite(duration) ? `${r1(duration)} s` : 'over 3 minutes'}, ${vs.width}x${vs.height}${capped ? ` (first ${MAX_SECS} s measured)` : ''}`);
console.log(`  ${shots.length} shots, ${out.cutsPerMinute} changes a minute (${out.hardCuts} hard cut${out.hardCuts === 1 ? '' : 's'}), median ${out.shotLength.median} s (${out.shotLength.shortest} to ${out.shotLength.longest} s): ${pace}`);
console.log(`  tone ${tone} (brightness ${Math.round(bright)}), colour ${colour} (saturation ${Math.round(sat)}), motion ${moving}${dips ? `, ${dips} dips to black` : ''}`);
for (const v of Object.values(suggest)) if (v) console.log(`  - ${v}`);
console.log(`  ${path.join(dir, 'sheet.png')}${labels ? '' : ' (no time labels: ffmpeg has no font)'}`);
