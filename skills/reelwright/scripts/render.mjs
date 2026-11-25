// Render a built run (after build.mjs).
// Usage:
//   node render.mjs <run_dir> stills [--format square] [--safe tiktok|reels|shorts]     one frame per scene -> <run>/stills/sheet.png
//     --safe shades where that app's buttons and text cover a vertical video (approximate, 1080 x 1920)
//   node render.mjs <run_dir> loop [--format landscape] [--seconds 5] [--scene n | --from <s>]   a silent seamless loop
//     -> <name>-loop.mp4, .webm and .gif (under 5 MB), for a README or landing page
//   node render.mjs <run_dir> check [--formats square,vertical]     text too small, low contrast, off the frame, in a
//     vertical app's buttons, or not on screen long enough to read; and black, short or broken frames in the MP4s
//     already rendered. Exits 1 when something must be fixed.
//   node render.mjs <run_dir> [--formats square,vertical,portrait,landscape] [--no-gif] [--length 6|15]
// --length renders a short cut that build.mjs --length made: <name>-<n>s-<format>.mp4.
// Writes <run>/<name>-<format>.mp4 at -14 LUFS, <name>-poster.png and <name>.gif (from the first format),
// <name>-<format>.srt and .vtt (subtitles), <name>-chapters.txt with the landscape cut,
// and qa-<format>.png (one frame a second) for checking.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {fileURLToPath, pathToFileURL} from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const run = path.resolve(args[0] ?? '');
const length = args.includes('--length') ? Number(args[args.indexOf('--length') + 1]) : 0;
const suffix = length ? `-${length}s` : '';
const propsFile = path.join(run, `props${suffix}.json`);
if (!args[0] || !fs.existsSync(propsFile)) {
  console.error('usage: node render.mjs <run_dir> [stills|check|loop] [--formats square,vertical,portrait,landscape] [--no-gif]   (run build.mjs first, with the same --length)');
  process.exit(1);
}
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
// the compositions in template/src/Root.tsx, checked before the slow bundle step
const FORMATS = ['square', 'vertical', 'portrait', 'landscape'];
for (const f of [...String(opt('--formats', '')).split(','), opt('--format', '')].map((x) => x.trim()).filter(Boolean)) if (!FORMATS.includes(f)) { console.error(`no format "${f}": use ${FORMATS.join(', ')}`); process.exit(1); }
const env = Object.fromEntries(
  execFileSync('bash', [path.join(SKILL, 'scripts/setup.sh')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
    .trim().split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const props = JSON.parse(fs.readFileSync(propsFile, 'utf8'));
const slug = (props.brand.name || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + suffix;
const pub = path.join(run, 'public');
// bundle once, then every still and render reuses it
const bundle = path.join(run, '.bundle');
fs.rmSync(bundle, {recursive: true, force: true});
execFileSync('npx', ['remotion', 'bundle', 'src/index.ts', `--out-dir=${bundle}`, `--public-dir=${pub}`, '--log=error'], {cwd: env.TEMPLATE, stdio: ['ignore', 'ignore', 'inherit']});
process.on('exit', () => fs.rmSync(bundle, {recursive: true, force: true}));
const remotion = (cmd, comp, out, extra = []) =>
  execFileSync('npx', ['remotion', cmd, bundle, comp, out, `--props=${propsFile}`, '--log=error',
    ...(env.BROWSER ? [`--browser-executable=${env.BROWSER}`] : []), ...extra], {cwd: env.TEMPLATE, stdio: ['ignore', 'inherit', 'inherit']});
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);
// the parts of a vertical video an app covers with its own buttons, captions and tabs, in pixels at
// 1080 x 1920: [top, bottom, left, right]. Approximate, and they shift between app versions.
const SAFE = {tiktok: [150, 480, 60, 140], reels: [250, 420, 60, 120], shorts: [140, 400, 60, 190]};
// the frame where every reveal in a scene has happened: just before the cut, and never past it
const settled = (s) => Math.min(s.start + Math.min(s.dur - 1, Math.max(s.cues.at(-1) + 24, s.dur - 10)), props.durationInFrames - 1);
// The smallest text each cut can carry, in pixels at 1080 on the short side: a phone held upright needs the most.
const MIN_PX = {vertical: 30, portrait: 26, square: 26, landscape: 22};
const where = (fr) => { const i = props.scenes.findLastIndex((s) => s.start <= fr); return i < 0 ? '' : `scene ${i + 1} (${props.scenes[i].type})`; };
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const blend = (fg, bg, a) => [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));


if (args[1] === 'stills') {
  const fmt = opt('--format', 'square');
  const dir = path.join(run, 'stills');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  const frames = props.scenes.map(settled);
  for (const [i, fr] of frames.entries()) remotion('still', fmt, path.join(dir, `s${String(i + 1).padStart(2, '0')}.png`), [`--frame=${fr}`]);
  const safe = opt('--safe');
  if (safe) {
    if (!SAFE[safe]) throw new Error(`--safe is one of ${Object.keys(SAFE).join(', ')}`);
    if (fmt !== 'vertical') throw new Error('--safe is for the vertical cut: use --format vertical');
    const [t, b, l, r] = SAFE[safe];
    const shade = 'color=red@0.28:t=fill';
    const vf = [`drawbox=x=0:y=0:w=iw:h=${t}:${shade}`, `drawbox=x=0:y=ih-${b}:w=iw:h=${b}:${shade}`, `drawbox=x=0:y=${t}:w=${l}:h=ih-${t + b}:${shade}`, `drawbox=x=iw-${r}:y=${t}:w=${r}:h=ih-${t + b}:${shade}`].join(',');
    for (const f of fs.readdirSync(dir).filter((f) => /^s\d+\.png$/.test(f))) { const p = path.join(dir, f); ff('-i', p, '-vf', vf, `${p}.tmp.png`); fs.renameSync(`${p}.tmp.png`, p); }
  }
  const cols = Math.min(3, frames.length);
  ff('-pattern_type', 'glob', '-i', path.join(dir, 's*.png'), '-vf', `scale=480:-1,tile=${cols}x${Math.ceil(frames.length / cols)}:padding=8:color=white`, '-frames:v', '1', path.join(dir, 'sheet.png'));
  console.log(path.join(dir, 'sheet.png'));
  console.log(`next: node render.mjs ${args[0]} check --formats ${fmt} lists text that's too small, faint or off the frame`);
  process.exit(0);
}

if (args[1] === 'check') {
  const fmts = String(opt('--formats', opt('--format', 'square,vertical'))).split(',').map((s) => s.trim()).filter(Boolean);
  const found = [...(await lint(fmts))];
  for (const fmt of fmts) {
    const mp4 = path.join(run, `${slug}-${fmt}.mp4`);
    if (!fs.existsSync(mp4)) continue;
    // an MP4 from before the last build is of an older timeline: render again to check it
    if (fs.statSync(mp4).mtimeMs < fs.statSync(propsFile).mtimeMs) found.push({level: 'warn', fmt, at: '', msg: `${path.basename(mp4)} is older than the last build: not checked`});
    else found.push(...checkVideo(mp4, fmt));
  }
  process.exit(report(found) ? 1 : 0);
}

if (args[1] === 'loop') {
  // A silent loop for a README or a landing page: a few seconds from the middle of the video whose end
  // runs back into its start. The window is rendered with X frames to spare; the first X frames of the loop
  // cross-fade from those spare frames into the window's start, so its last frame leads straight into its first.
  const fmt = opt('--format', 'landscape');
  const X = 12;
  let L = Math.round(Math.min(8, Math.max(2, Number(opt('--seconds', 5)))) * 30);
  let from;
  if (args.includes('--from')) from = Math.round(Number(opt('--from')) * 30);
  else {
    // default: inside one scene, so the loop never crosses a cut: --scene n (from 1), or the longest scene
    // between the opening and the end card. It starts once the scene's way in is over, and is cut short to fit.
    const mids = props.scenes.length > 2 ? props.scenes.slice(1, -1) : props.scenes;
    const sc = args.includes('--scene') ? props.scenes[Number(opt('--scene')) - 1] : mids.reduce((a, b) => (b.dur > a.dur ? b : a));
    if (!sc) throw new Error(`--scene is 1 to ${props.scenes.length}`);
    from = sc.start + 20; // past the longest way in
    L = Math.max(60, Math.min(L, sc.dur - 20 - X));
  }
  const to = Math.min(props.durationInFrames - 1, from + L + X - 1);
  if (to - from + 1 < L + X) throw new Error(`--from leaves less than ${(L / 30).toFixed(1)} s to loop`);
  const base = path.join(run, `${slug}-loop`);
  const clip = (file, p, extra = []) => {
    const pf = path.join(run, '.props-loop.json');
    fs.writeFileSync(pf, JSON.stringify(p));
    execFileSync('npx', ['remotion', 'render', bundle, fmt, file, `--props=${pf}`, `--frames=${from}-${to}`, '--muted', '--crf=16', '--log=error',
      ...(env.BROWSER ? [`--browser-executable=${env.BROWSER}`] : []), ...extra], {cwd: env.TEMPLATE, stdio: ['ignore', 'inherit', 'inherit']});
    fs.rmSync(pf);
  };
  // head = window frames 0..X, body = X..L, tail = the spare frames L..L+X. tail fades into head, then body.
  const seam = `[0:v]split=3[h][b][t];[h]trim=start_frame=0:end_frame=${X},setpts=PTS-STARTPTS[h1];[b]trim=start_frame=${X}:end_frame=${L},setpts=PTS-STARTPTS[b1];` +
    `[t]trim=start_frame=${L}:end_frame=${L + X},setpts=PTS-STARTPTS[t1];[h1][t1]blend=all_expr='A*(N/${X})+B*(1-N/${X})'[x];[x][b1]concat=n=2:v=1[v]`;
  const raw = path.join(run, '.loop-raw.mp4');
  clip(raw, props);
  const seamless = path.join(run, '.loop.mkv');
  ff('-i', raw, '-filter_complex', seam, '-map', '[v]', '-c:v', 'ffv1', seamless);
  ff('-i', seamless, '-c:v', 'libx264', '-crf', '20', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-an', `${base}.mp4`);
  ff('-i', seamless, '-c:v', 'libvpx-vp9', '-crf', '34', '-b:v', '0', '-row-mt', '1', '-an', `${base}.webm`);
  // the GIF, at 12 fps: from a quiet half-size pass when the look has grain, as for the full video's GIF
  let gsrc = seamless;
  if (props.look && props.look !== 'clean') {
    const q = path.join(run, '.loop-quiet.mp4');
    clip(q, {...props, quiet: true}, ['--scale=0.5']);
    gsrc = path.join(run, '.loop-quiet.mkv');
    ff('-i', q, '-filter_complex', seam, '-map', '[v]', '-c:v', 'ffv1', gsrc);
    fs.rmSync(q);
  }
  const gw = fmt === 'landscape' ? 720 : 540;
  const gif = `${base}.gif`;
  for (const [w, colors] of [[gw, 128], [Math.round(gw * 0.8), 96], [Math.round(gw * 0.66), 64]]) {
    ff('-i', gsrc, '-filter_complex', `fps=12,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`, '-loop', '0', gif);
    if (fs.statSync(gif).size < 5e6) break; // GitHub shows GIFs up to 10 MB, but under 5 MB loads quickly
  }
  for (const f of [raw, seamless, gsrc]) fs.rmSync(f, {force: true});
  for (const ext of ['mp4', 'webm', 'gif']) console.log(`${base}.${ext}  (${(fs.statSync(`${base}.${ext}`).size / 1e6).toFixed(1)} MB)`);
  process.exit(0);
}

const formats = opt('--formats', 'square,vertical').split(',').map((s) => s.trim()).filter(Boolean);
const outs = [];
const checked = [];
for (const fmt of formats) {
  const raw = path.join(run, `.raw-${fmt}.mp4`);
  const out = path.join(run, `${slug}-${fmt}.mp4`);
  console.log(`> ${fmt}`);
  remotion('render', fmt, raw, ['--crf=18']);
  outs.push({fmt, raw, out});
}
for (const {fmt, raw, out} of outs) {
  const stats = measure(raw);
  const af = stats ? `loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=${stats.input_i}:measured_TP=${stats.input_tp}:measured_LRA=${stats.input_lra}:measured_thresh=${stats.input_thresh}:offset=${stats.target_offset}:linear=true` : 'loudnorm=I=-14:TP=-1.5:LRA=11';
  ff('-i', raw, '-c:v', 'copy', '-af', af, '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', out);
  fs.rmSync(raw);
  const secs = props.durationInFrames / 30;
  ff('-i', out, '-vf', `fps=1,scale=${fmt === 'landscape' ? 384 : 270}:-1,tile=6x${Math.ceil(secs / 6)}:padding=4:color=white`, '-frames:v', '1', path.join(run, `qa${suffix}-${fmt}.png`));
  console.log(`${out}  (${secs.toFixed(1)} s)`);
  checked.push(...checkVideo(out, fmt));
  subs(out.replace(/\.mp4$/, ''));
}
// chapter marks for the landscape cut (the one that goes to YouTube), to paste into its description
if (formats.includes('landscape') && !length && props.chapters?.length >= 3) {
  const file = path.join(run, `${slug}-chapters.txt`);
  const mmss = (fr) => { const t = Math.round(fr / 30); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  fs.writeFileSync(file, props.chapters.map((c) => `${mmss(c.at)} ${c.title}`).join('\n') + '\n');
  console.log(file);
} else if (formats.includes('landscape') && !length) console.log('no chapters: YouTube shows them only with 3 or more of 10 s each, and this video is too short');
// poster and GIF from the first format
const first = outs[0];
if (first) {
  const end = props.scenes.at(-1);
  ff('-ss', ((end.start + end.dur - 20) / 30).toFixed(2), '-i', first.out, '-frames:v', '1', path.join(run, `${slug}-poster.png`));
  if (!args.includes('--no-gif')) {
    const gif = path.join(run, `${slug}.gif`);
    const w = first.fmt === 'landscape' ? 720 : 540;
    // A look with grain (anything but clean) makes a GIF 3 to 5 times too big: GIFs can't compress noise.
    // Render its source again at half size, quiet (without the look's layers) and muted, and make the GIF from that.
    let src = first.out;
    if (props.look && props.look !== 'clean') {
      const qp = path.join(run, '.props-quiet.json');
      src = path.join(run, '.gif-source.mp4');
      fs.writeFileSync(qp, JSON.stringify({...props, quiet: true}));
      execFileSync('npx', ['remotion', 'render', bundle, first.fmt, src, `--props=${qp}`, '--scale=0.5', '--muted', '--log=error',
        ...(env.BROWSER ? [`--browser-executable=${env.BROWSER}`] : [])], {cwd: env.TEMPLATE, stdio: ['ignore', 'inherit', 'inherit']});
      fs.rmSync(qp);
    }
    ff('-i', src, '-filter_complex', `fps=12,scale=${w}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle`, gif);
    if (src !== first.out) fs.rmSync(src);
    console.log(`${gif}  (${(fs.statSync(gif).size / 1e6).toFixed(1)} MB)`);
  }
}

// a broken render fails loudly, after everything else is written
if (report(checked)) process.exit(1);

// ---- checks -------------------------------------------------------------------------------------------
// render each scene's settled frame with props.check set; check.tsx reports every piece of text on it
async function lint(fmts) {
  const req = createRequire(path.join(env.TEMPLATE, 'package.json'));
  const R = await import(pathToFileURL(req.resolve('@remotion/renderer')).href);
  const inputProps = {...props, check: true};
  const out = [];
  const words = new Map(); // scene -> words on screen, from the first cut
  const tmp = path.join(run, '.check.png');
  for (const fmt of fmts) {
    const composition = await R.selectComposition({serveUrl: bundle, id: fmt, inputProps, browserExecutable: env.BROWSER || null, logLevel: 'error'});
    const {width: w, height: h} = composition;
    const u = Math.min(w, h) / 1080;
    const seen = new Set();
    for (const [i, s] of props.scenes.entries()) {
      let items = [];
      await R.renderStill({composition, serveUrl: bundle, frame: settled(s), output: tmp, inputProps, browserExecutable: env.BROWSER || null, logLevel: 'error',
        onBrowserLog: (l) => { if (l.text.startsWith('RW-CHECK ')) items = JSON.parse(l.text.slice(9)); }});
      const at = `scene ${i + 1} (${s.type})`;
      const add = (level, msg, key) => { if (!seen.has(key)) { seen.add(key); out.push({level, fmt, at, msg}); } };
      for (const it of items) {
        if (it.scene != null && it.scene !== i && !it.caption) continue; // the next scene coming in, or the last going
        const [x, y, bw, bh] = it.box;
        if (it.op < 0.05 || bw < 1 || bh < 1 || x > w || y > h || x + bw < 0 || y + bh < 0) continue;
        const q = `"${it.show.length > 40 ? it.show.slice(0, 40) + '…' : it.show}"`;
        if (it.op >= 0.5 && (x < -4 || y < -4 || x + bw > w + 4 || y + bh > h + 4)) add('fail', `${q} runs off the frame`, `off${it.text}${i}`);
        const min = MIN_PX[fmt] * u;
        if (it.op >= 0.5 && it.px < min - 0.5) add('fail', `${q} is ${Math.round(it.px / u)} px; the ${fmt} cut needs ${MIN_PX[fmt]} or more`, `px${it.text}${i}`);
        // faded on purpose (a dimmed line, a word still to come) or over a picture: not measured
        if (it.bg && it.op >= 0.9) {
          const need = it.px >= 40 * u ? 3 : 4.5;
          const r = ratio(blend(it.color, it.bg, it.color[3] * it.op), it.bg);
          if (r < need) add('fail', `${q} has contrast ${r.toFixed(1)}:1 against its background; it needs ${need}:1 at this size`, `cr${it.text}${i}`);
        }
        if (fmt === 'vertical') {
          const k = w / 1080;
          // the bars top and bottom run the full width; the button rails at the sides only down the lower half
          const low = y + bh > h * 0.45;
          const apps = Object.entries(SAFE).filter(([, [t, b, l, r]]) => y < t * k || y + bh > h - b * k || (low && (x < l * k || x + bw > w - r * k))).map(([a]) => a);
          if (apps.length && it.op >= 0.5) add('warn', `${q} sits where ${apps.join(', ')} put their buttons or caption`, `safe${it.text}${i}`);
        }
        if (it.op >= 0.5 && !it.caption && !words.has(`${i}:${fmt}`)) words.set(`${i}:${fmt}`, 0);
        if (it.op >= 0.5 && !it.caption) words.set(`${i}:${fmt}`, words.get(`${i}:${fmt}`) + it.text.split(/\s+/).length);
      }
    }
  }
  fs.rmSync(tmp, {force: true});
  // reading time: a second, then about 4 words a second (the voice reads along), from the first reveal to the cut
  for (const [i, s] of props.scenes.entries()) {
    const n = Math.max(...fmts.map((f) => words.get(`${i}:${f}`) ?? 0));
    const on = (s.dur - (s.cues[0] ?? 0)) / 30;
    const need = 1 + n / 4;
    if (n && on < need) out.push({level: 'warn', fmt: 'all', at: `scene ${i + 1} (${s.type})`, msg: `${n} words on screen for ${on.toFixed(1)} s; give it about ${need.toFixed(1)} s ("hold": ${(need - on).toFixed(1)}) or fewer words`});
  }
  return out;
}

// a rendered MP4: it decodes cleanly, has every frame, has no black frames and no one-frame flashes
function checkVideo(file, fmt) {
  const out = [];
  const name = path.basename(file);
  const add = (level, at, msg) => out.push({level, fmt, at, msg: `${name}: ${msg}`});
  const dec = spawnSync('ffmpeg', ['-v', 'error', '-i', file, '-map', '0:v', '-f', 'null', '-'], {encoding: 'utf8'});
  if (dec.status !== 0 || dec.stderr.trim()) add('fail', '', `doesn't decode cleanly: ${(dec.stderr.trim().split('\n')[0] || `ffmpeg exited ${dec.status}`)}`);
  const n = parseInt(spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-count_packets', '-show_entries', 'stream=nb_read_packets', '-of', 'csv=p=0', file], {encoding: 'utf8'}).stdout.trim(), 10);
  if (!(Math.abs(n - props.durationInFrames) <= 1)) add('fail', '', `has ${Number.isNaN(n) ? 'no readable' : n} frames, the timeline ${props.durationInFrames}: render it again`);
  // black: darker than any of the brand's backgrounds (a brand whose dark is black can't be told apart, so it isn't checked)
  // only near-pure black counts (a dark screenshot or a phone's bezel is lighter), and not when the brand's own
  // dark is black too. The threshold is on 0 to 255 luma; video black is 16.
  const y8 = (hex) => { let h = String(hex).replace('#', ''); if (h.length <= 4) h = [...h.slice(0, 3)].map((c) => c + c).join(''); const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const darkest = Math.min(...[props.brand.dark, props.brand.paper, props.brand.primary].map(y8));
  if (!(darkest > 4)) add('warn', '', `not checked for black frames: the brand's ${Number.isNaN(darkest) ? 'colours could not be read' : 'dark is black'}`);
  else {
    const black = spawnSync('ffmpeg', ['-i', file, '-vf', 'blackdetect=d=0.03:pic_th=0.98:pix_th=0.075', '-an', '-f', 'null', '-'], {encoding: 'utf8'}).stderr;
    for (const m of black.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)) add('fail', where(Math.round(Number(m[1]) * 30)), `black from ${Number(m[1]).toFixed(2)} to ${Number(m[2]).toFixed(2)} s`);
  }
  // brightness of each frame (0 to 255); a frame far brighter or darker than both its neighbours is a flash
  const ys = [...spawnSync('ffmpeg', ['-i', file, '-vf', 'scale=96:-2,signalstats,metadata=print:key=lavfi.signalstats.YAVG:file=-', '-an', '-f', 'null', '-'], {encoding: 'utf8', maxBuffer: 64e6}).stdout.matchAll(/YAVG=([\d.]+)/g)].map((m) => Number(m[1]));
  for (let i = 1; i < ys.length - 1; i++) {
    const a = ys[i] - ys[i - 1], b = ys[i + 1] - ys[i];
    if (Math.abs(a) > 50 && Math.abs(b) > 50 && Math.sign(a) !== Math.sign(b)) add('warn', where(i), `a one-frame flash at ${(i / 30).toFixed(2)} s`);
  }
  return out;
}

// print what was found, worst first; true when something must be fixed
function report(found) {
  const fails = found.filter((f) => f.level === 'fail');
  for (const f of [...fails, ...found.filter((f) => f.level !== 'fail')]) console.log(`${f.level === 'fail' ? 'FIX ' : 'look'}  ${f.fmt.padEnd(9)} ${f.at ? f.at.padEnd(22) : ''.padEnd(22)} ${f.msg}`);
  if (found.length) console.log(`${fails.length} to fix, ${found.length - fails.length} to look at`);
  else console.log('check: nothing found');
  return fails.length > 0;
}

// subtitle files beside a cut: <base>.srt and <base>.vtt, timed to the voice
function subs(base) {
  if (!props.subtitles?.length) return;
  const stamp = (fr, sep) => { const ms = Math.round((fr / 30) * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`; };
  // two lines at most: the break nearest the middle that keeps both within 42 characters, if there is one
  const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uac00-\ud7af]/;
  const wrap = (t) => {
    // Japanese and Chinese have no spaces: two lines of up to 21 characters, broken after punctuation if one is near the middle
    if (CJK.test(t) && !t.includes(' ')) {
      const ch = [...t];
      if (ch.length <= 21) return t;
      const mid = Math.ceil(ch.length / 2);
      const p = ch.map((c, i) => (/[、。，！？；：]/.test(c) ? i + 1 : -1)).filter((i) => i > 0 && i < ch.length && Math.abs(i - mid) <= 5).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid))[0];
      const k = p ?? mid;
      return `${ch.slice(0, k).join('')}\n${ch.slice(k).join('')}`;
    }
    if (t.length <= 42) return t;
    const spaces = [...t].map((ch, i) => (ch === ' ' ? i : -1)).filter((i) => i > 0);
    const fits = spaces.filter((i) => i <= 42 && t.length - i - 1 <= 42);
    const pool = fits.length ? fits : spaces;
    const k = pool.sort((a, b) => Math.abs(a - t.length / 2) - Math.abs(b - t.length / 2))[0];
    return k == null ? t : `${t.slice(0, k)}\n${t.slice(k + 1)}`;
  };
  // "-->" would read as a timing line; WebVTT also reads & < > as markup
  const safe = (t) => t.replace(/-->/g, '→');
  const vtt = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const cues = props.subtitles.map((c) => [stamp(c.from, ','), stamp(c.to, ','), wrap(safe(c.text))]);
  fs.writeFileSync(`${base}.srt`, cues.map(([a, b, t], i) => `${i + 1}\n${a} --> ${b}\n${t}\n`).join('\n'));
  fs.writeFileSync(`${base}.vtt`, 'WEBVTT\n\n' + cues.map(([a, b, t]) => `${a.replace(',', '.')} --> ${b.replace(',', '.')}\n${vtt(t)}\n`).join('\n'));
}

// first loudnorm pass: what the mix measures, so the second pass lands on target
function measure(file) {
  const p = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = (p.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/);
  return m ? JSON.parse(m[0]) : null;
}
