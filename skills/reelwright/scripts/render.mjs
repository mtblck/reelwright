// Render a built run (after build.mjs).
// Usage:
//   node render.mjs <run_dir> stills [--format square]     one frame per scene -> <run>/stills/sheet.png
//   node render.mjs <run_dir> [--formats square,vertical,landscape] [--no-gif]
// Writes <run>/<name>-<format>.mp4 at -14 LUFS, <name>-poster.png and <name>.gif (from the first format),
// and qa-<format>.png (one frame a second) for checking.
import {execFileSync, spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const run = path.resolve(args[0] ?? '');
if (!args[0] || !fs.existsSync(path.join(run, 'props.json'))) {
  console.error('usage: node render.mjs <run_dir> [stills] [--formats square,vertical,landscape] [--no-gif]   (run build.mjs first)');
  process.exit(1);
}
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const env = Object.fromEntries(
  execFileSync('bash', [path.join(SKILL, 'scripts/setup.sh')], {encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit']})
    .trim().split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]),
);
const props = JSON.parse(fs.readFileSync(path.join(run, 'props.json'), 'utf8'));
const slug = (props.brand.name || 'video').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const pub = path.join(run, 'public');
// bundle once, then every still and render reuses it
const bundle = path.join(run, '.bundle');
fs.rmSync(bundle, {recursive: true, force: true});
execFileSync('npx', ['remotion', 'bundle', 'src/index.ts', `--out-dir=${bundle}`, `--public-dir=${pub}`, '--log=error'], {cwd: env.TEMPLATE, stdio: ['ignore', 'ignore', 'inherit']});
process.on('exit', () => fs.rmSync(bundle, {recursive: true, force: true}));
const remotion = (cmd, comp, out, extra = []) =>
  execFileSync('npx', ['remotion', cmd, bundle, comp, out, `--props=${path.join(run, 'props.json')}`, '--log=error',
    ...(env.BROWSER ? [`--browser-executable=${env.BROWSER}`] : []), ...extra], {cwd: env.TEMPLATE, stdio: ['ignore', 'inherit', 'inherit']});
const ff = (...a) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...a]);

if (args[1] === 'stills') {
  const fmt = opt('--format', 'square');
  const dir = path.join(run, 'stills');
  fs.rmSync(dir, {recursive: true, force: true});
  fs.mkdirSync(dir, {recursive: true});
  // the moment every reveal in the scene has happened: just before the cut
  const frames = props.scenes.map((s) => s.start + Math.max(s.cues.at(-1) + 24, s.dur - 10));
  for (const [i, fr] of frames.entries()) remotion('still', fmt, path.join(dir, `s${String(i + 1).padStart(2, '0')}.png`), [`--frame=${Math.min(fr, props.durationInFrames - 1)}`]);
  const cols = Math.min(3, frames.length);
  ff('-pattern_type', 'glob', '-i', path.join(dir, 's*.png'), '-vf', `scale=480:-1,tile=${cols}x${Math.ceil(frames.length / cols)}:padding=8:color=white`, '-frames:v', '1', path.join(dir, 'sheet.png'));
  console.log(path.join(dir, 'sheet.png'));
  process.exit(0);
}

const formats = opt('--formats', 'square,vertical').split(',').map((s) => s.trim()).filter(Boolean);
const outs = [];
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
  ff('-i', out, '-vf', `fps=1,scale=${fmt === 'landscape' ? 384 : 270}:-1,tile=6x${Math.ceil(secs / 6)}:padding=4:color=white`, '-frames:v', '1', path.join(run, `qa-${fmt}.png`));
  console.log(`${out}  (${secs.toFixed(1)} s)`);
}
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

// first loudnorm pass: what the mix measures, so the second pass lands on target
function measure(file) {
  const p = spawnSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], {encoding: 'utf8'});
  const m = (p.stderr || '').match(/\{[^{}]*"input_i"[^{}]*\}/);
  return m ? JSON.parse(m[0]) : null;
}
