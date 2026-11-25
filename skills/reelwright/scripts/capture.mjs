// Screenshots and a short screen clip of a running app or site, for screen scenes.
// Usage: node capture.mjs <url> <out_dir> [--device phone|desktop] [--steps steps.json] [--clip]
//   steps.json: [{"click": "Try a sample"}, {"wait": 2000}, {"drag": "[role=slider]", "dx": -120}, {"shot": "traced"},
//                {"scroll": 600}, {"type": ["input[name=q]", "hello"]}, {"press": "Enter"},
//                {"box": "Export button", "selector": "button.export"}, {"box": "Download SVG"}, {"shot": "result"}]
//   A box step notes where an element sits (by CSS selector, or by its text when there's no selector) for the
//   next shot; a shot can also list them: {"shot": "result", "boxes": {"Export button": "button.export"}}.
//   They're saved to <out>/<device>-boxes.json as [x, y, w, h] fractions of the screenshot, so a story's
//   cursor and zoom-pan focus can name them: "cursor": ["Export button"].
// Writes <out>/<device>-<name>.png for each "shot" (plus <device>-start.png), and with --clip
// <out>/<device>-clip.mp4: the steps as they happened, trimmed to start at the first step.
// Uses Playwright from the machine (Claude's cloud sessions have it preinstalled), else from the template.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const args = process.argv.slice(2);
const [url, out] = args;
if (!url || !out) { console.error('usage: node capture.mjs <url> <out_dir> [--device phone|desktop] [--steps steps.json] [--clip]'); process.exit(1); }
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const device = opt('--device', 'phone');
const steps = args.includes('--steps') ? JSON.parse(fs.readFileSync(opt('--steps'), 'utf8')) : [];
const clip = args.includes('--clip');
fs.mkdirSync(out, {recursive: true});

function playwright() {
  const roots = [];
  try { roots.push(execFileSync('npm', ['root', '-g'], {encoding: 'utf8'}).trim()); } catch {}
  for (const r of roots) { try { return createRequire(path.join(r, 'x.js'))('playwright'); } catch {} }
  try { return createRequire(import.meta.url)('playwright'); } catch {}
  console.error('! Playwright not found. Install it once with: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}
const {chromium} = playwright();
const vp = device === 'desktop' ? {width: 1280, height: 800} : {width: 390, height: 844};
const browser = await chromium.launch();
const vidDir = path.join(out, `.video-${device}`);
const ctx = await browser.newContext({viewport: vp, deviceScaleFactor: 2, ...(clip ? {recordVideo: {dir: vidDir, size: vp}} : {})});
const page = await ctx.newPage();
const t0 = Date.now();
await page.goto(url, {waitUntil: 'networkidle', timeout: 60000}).catch(() => page.waitForLoadState('load'));
await page.waitForTimeout(800);
await page.screenshot({path: path.join(out, `${device}-start.png`)});
const startAt = (Date.now() - t0) / 1000;
const boxFile = path.join(out, `${device}-boxes.json`);
const boxes = fs.existsSync(boxFile) ? JSON.parse(fs.readFileSync(boxFile, 'utf8')) : {};
let pending = {};
// where an element sits in the viewport, as fractions of it (the screenshot is the viewport at 2x)
async function boxOf(name, sel) {
  const loc = sel ? page.locator(sel) : page.getByText(name, {exact: false});
  const b = await loc.first().boundingBox({timeout: 5000}).catch(() => null);
  if (!b) { console.error(`! box "${name}": nothing matches ${sel ? `selector ${sel}` : 'that text'} on screen`); return null; }
  const r = (v) => Math.round(v * 10000) / 10000;
  const x0 = Math.max(0, b.x), y0 = Math.max(0, b.y), x1 = Math.min(vp.width, b.x + b.width), y1 = Math.min(vp.height, b.y + b.height);
  if (x1 <= x0 || y1 <= y0) { console.error(`! box "${name}" is off screen: scroll to it before the shot`); return null; }
  return [r(x0 / vp.width), r(y0 / vp.height), r((x1 - x0) / vp.width), r((y1 - y0) / vp.height)];
}
for (const s of steps) {
  if (s.wait) await page.waitForTimeout(s.wait);
  if (s.click) await page.getByText(s.click, {exact: false}).first().click();
  if (s.press) await page.keyboard.press(s.press);
  if (s.type) await page.locator(s.type[0]).first().fill(s.type[1]);
  if (s.scroll) { await page.mouse.wheel(0, s.scroll); await page.waitForTimeout(500); }
  if (s.drag) {
    const b = await page.locator(s.drag).first().boundingBox();
    if (b) {
      const x = b.x + b.width / 2, y = b.y + b.height / 2;
      await page.mouse.move(x, y); await page.mouse.down();
      for (let i = 1; i <= 20; i++) { await page.mouse.move(x + (s.dx ?? 0) * Math.sin((i / 20) * Math.PI / 2), y + (s.dy ?? 0) * Math.sin((i / 20) * Math.PI / 2)); await page.waitForTimeout(30); }
      await page.mouse.up();
    }
  }
  if (s.box) { const b = await boxOf(s.box, s.selector); if (b) pending[s.box] = b; }
  if (s.shot) {
    for (const [n, sel] of Object.entries(s.boxes ?? {})) { const b = await boxOf(n, sel); if (b) pending[n] = b; }
    await page.screenshot({path: path.join(out, `${device}-${s.shot}.png`)});
    if (Object.keys(pending).length) { boxes[s.shot] = pending; pending = {}; fs.writeFileSync(boxFile, JSON.stringify(boxes, null, 1)); }
  }
}
await page.waitForTimeout(800);
const video = clip ? page.video() : null;
await ctx.close();
await browser.close();
if (video) {
  const raw = await video.path();
  // recordVideo draws the CSS-pixel viewport; scale it up 2x and start where the steps start
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-ss', startAt.toFixed(2), '-i', raw, '-an', '-vf', `scale=${vp.width * 2}:${vp.height * 2}:flags=lanczos,fps=30`, '-c:v', 'libx264', '-crf', '22', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(out, `${device}-clip.mp4`)]);
  fs.rmSync(vidDir, {recursive: true, force: true});
}
console.log(fs.readdirSync(out).filter((f) => f.startsWith(device)).map((f) => path.join(out, f)).join('\n'));
