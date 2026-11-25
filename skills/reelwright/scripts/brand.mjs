// Read a brand from a live site or running app, for projects with no brand kit.
// Usage: node brand.mjs <url> <run_dir>
// Writes <run>/site-brand.json (the `brand` block build.mjs uses when the story has no brandJson) and
// <run>/site-brand/: the mark (favicon or app icon), a wide logo when the header has one, and swatch.png,
// a sheet of what it found to check by eye. Prints every guess it had to make.
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';

const [url, run] = process.argv.slice(2);
if (!url || !run || !/^https?:\/\//.test(url)) { console.error('usage: node brand.mjs <http(s) url> <run_dir>'); process.exit(1); }
const dir = path.join(run, 'site-brand');
fs.mkdirSync(dir, {recursive: true});
const notes = [];

function playwright() {
  const roots = [];
  try { roots.push(execFileSync('npm', ['root', '-g'], {encoding: 'utf8'}).trim()); } catch {}
  for (const r of roots) { try { return createRequire(path.join(r, 'x.js'))('playwright'); } catch {} }
  try { return createRequire(import.meta.url)('playwright'); } catch {}
  console.error('! Playwright not found. Install it once with: npm i -g playwright && npx playwright install chromium');
  process.exit(1);
}
const {chromium} = playwright();
const browser = await chromium.launch();
const ctx = await browser.newContext({viewport: {width: 1280, height: 800}, deviceScaleFactor: 2, colorScheme: 'light'});
const page = await ctx.newPage();
// a page that never goes quiet is fine once it has loaded; one that can't be reached is not
const loaded = await page.goto(url, {waitUntil: 'networkidle', timeout: 60000}).then(() => null, (e) => (/Timeout/i.test(e.name + e.message) ? page.waitForLoadState('load').then(() => null, () => e) : e));
if (loaded || page.url() === 'about:blank') {
  console.error(`! could not load ${url}: ${(loaded?.message ?? 'blank page').split('\n')[0]}\n  start the app (or check the URL) and run this again`);
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(800);

// --- in the page: colours by where they're used, the fonts, the name, the icons and the header logo ---
const found = await page.evaluate(() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const g = cv.getContext('2d', {willReadFrequently: true});
  // any CSS colour (rgb, hsl, oklch, lab, named) -> #rrggbb, or null when missing or mostly transparent
  const hex = (c) => {
    if (!c || c === 'transparent' || c === 'none' || !CSS.supports('color', c)) return null; // url(#gradient) and the like aren't colours
    g.clearRect(0, 0, 1, 1);
    g.fillStyle = '#000';
    g.fillStyle = c;
    g.fillRect(0, 0, 1, 1);
    const [r, gg, b, a] = g.getImageData(0, 0, 1, 1).data;
    return a < 200 ? null : '#' + [r, gg, b].map((v) => v.toString(16).padStart(2, '0')).join('');
  };
  const css = (el) => getComputedStyle(el);
  // custom properties declared on :root or html, resolved through a probe (bare HSL / RGB / OKLCH triplets too)
  const vars = {};
  const probe = document.createElement('span');
  const holder = document.createElement('div');
  holder.style.color = 'rgb(1, 2, 3)';
  holder.appendChild(probe);
  document.body.appendChild(holder);
  const names = new Set();
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = sheet.cssRules; } catch { continue; }
    const walk = (list) => { for (const r of list) { if (r.cssRules) walk(r.cssRules); if (r.style && /(^|,)\s*(:root|html)\b/.test(r.selectorText || '')) for (const p of r.style) if (p.startsWith('--')) names.add(p); } };
    walk(rules);
  }
  for (const n of [...names].slice(0, 400)) {
    for (const w of [`var(${n})`, `hsl(var(${n}))`, `rgb(var(${n}))`, `oklch(var(${n}))`]) {
      probe.style.color = '';
      probe.style.color = w;
      const v = css(probe).color;
      if (probe.style.color && v !== 'rgb(1, 2, 3)') { const h = hex(v); if (h) { vars[n] = h; break; } }
    }
  }
  holder.remove();
  // backgrounds by visible area, text colours by amount of text, buttons and links on their own
  const bg = {}, text = {}, buttons = {}, links = {};
  const add = (m, k, w) => { if (k) m[k] = (m[k] || 0) + w; };
  const H = Math.max(window.innerHeight * 3, 2400);
  for (const el of [...document.body.querySelectorAll('*')].slice(0, 4000)) {
    const s = css(el);
    if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || r.top > H) continue;
    const area = Math.min(r.width, innerWidth) * Math.min(r.height, H);
    add(bg, hex(s.backgroundColor), area);
    const own = [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()).join('').length;
    if (own) add(text, hex(s.color), own);
    const tag = el.tagName.toLowerCase();
    if (tag === 'button' || el.getAttribute('role') === 'button' || /\b(btn|button|cta)\b/i.test(el.className?.baseVal ?? el.className ?? '')) add(buttons, hex(s.backgroundColor), 1);
    if (tag === 'a' && own) add(links, hex(s.color), own);
  }
  const page = hex(css(document.body).backgroundColor) || hex(css(document.documentElement).backgroundColor) || '#ffffff';
  // fonts: the biggest heading, and the body
  const heads = [...document.querySelectorAll('h1, h2, [class*=title], [class*=headline]')].filter((e) => e.getBoundingClientRect().height && e.textContent.trim());
  heads.sort((a, b) => parseFloat(css(b).fontSize) - parseFloat(css(a).fontSize));
  const h = heads[0] ?? document.body;
  const font = (el) => ({stack: css(el).fontFamily, weight: +css(el).fontWeight || 400});
  // name and line
  const meta = (s) => document.querySelector(s)?.getAttribute('content')?.trim();
  // icons: link tags and the web manifest
  const icons = [...document.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"], link[rel="mask-icon"]')]
    .map((l) => ({href: l.href, rel: l.rel, sizes: l.getAttribute('sizes') || '', type: l.type || ''}));
  const manifest = document.querySelector('link[rel="manifest"]')?.href;
  // the header logo: an img or svg in the header or nav that says logo, or sits in the link home
  const scope = document.querySelector('header, nav, [role=banner]') || document.body;
  const says = (e) => /logo|brand/i.test([e.id, e.getAttribute('class'), e.getAttribute('alt'), e.getAttribute('aria-label'), e.getAttribute('src'), e.closest('a')?.getAttribute('aria-label')].join(' '));
  const home = (e) => { const a = e.closest('a'); if (!a) return false; try { const u = new URL(a.href); return u.origin === location.origin && (u.pathname === '/' || u.pathname === ''); } catch { return false; } };
  const cands = [...scope.querySelectorAll('img, svg')].filter((e) => { const r = e.getBoundingClientRect(); return r.width >= 24 && r.height >= 12 && r.top < 200 && (says(e) || home(e)); });
  let logo = null;
  const el = cands[0];
  if (el) {
    const r = el.getBoundingClientRect();
    let on = null;
    for (let p = el; p && !on; p = p.parentElement) on = hex(css(p).backgroundColor);
    on = on || page;
    if (el.tagName.toLowerCase() === 'img') logo = {src: el.currentSrc || el.src, w: r.width, h: r.height, on};
    else {
      // inline SVG: copy the colours it is drawn in onto it, so it looks the same on its own
      const c = el.cloneNode(true);
      const fills = {};
      // first the colours, while the clone still matches the original element for element
      const bake = (s, d, count) => {
        const st = css(s);
        if (st.fill && st.fill !== 'none') { const f = hex(st.fill); if (f) { d.setAttribute('fill', f); if (count && /^(path|rect|circle|polygon|ellipse|text)$/i.test(s.tagName)) fills[f] = (fills[f] || 0) + 1; } }
        if (st.stroke && st.stroke !== 'none') { const f = hex(st.stroke); if (f) d.setAttribute('stroke', f); }
      };
      const src = [el, ...el.querySelectorAll('*')], dst = [c, ...c.querySelectorAll('*')];
      src.forEach((s, i) => dst[i] && bake(s, dst[i], true));
      // then each <use href="#id"> becomes a copy of what it points at, drawn in the <use>'s colours
      dst.forEach((u, i) => {
        if (u.tagName.toLowerCase() !== 'use') return;
        const id = (u.getAttribute('href') || u.getAttribute('xlink:href') || '').split('#')[1];
        const ref = id ? document.getElementById(id) : null;
        if (!ref) return;
        const gEl = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        for (const a of ['fill', 'stroke', 'transform']) if (u.getAttribute(a)) gEl.setAttribute(a, u.getAttribute(a));
        const x = +u.getAttribute('x') || 0, y = +u.getAttribute('y') || 0;
        if (x || y) gEl.setAttribute('transform', `translate(${x} ${y}) ${gEl.getAttribute('transform') ?? ''}`.trim());
        for (const ch of ref.childNodes) gEl.appendChild(ch.cloneNode(true));
        // only colours the symbol sets itself; the rest inherit the <use>'s
        gEl.querySelectorAll('*').forEach((d) => { if (!d.getAttribute('fill') && !d.style?.fill) d.removeAttribute('fill'); });
        const f = hex(css(src[i]).fill);
        if (f) fills[f] = (fills[f] || 0) + 1;
        u.replaceWith(gEl);
      });
      // gradients, patterns and masks it points at elsewhere in the page come along in a <defs>
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      const have = new Set([...c.querySelectorAll('[id]')].map((e) => e.id));
      for (const e of [c, ...c.querySelectorAll('*')]) for (const a of ['fill', 'stroke', 'mask', 'clip-path', 'filter']) {
        const id = (e.getAttribute(a) || '').match(/url\(\s*['"]?#([^)'"]+)/)?.[1];
        const ref = id && !have.has(id) ? document.getElementById(id) : null;
        if (ref) { defs.appendChild(ref.cloneNode(true)); have.add(id); }
      }
      if (defs.childNodes.length) c.insertBefore(defs, c.firstChild);
      c.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      if (!c.getAttribute('viewBox')) c.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`);
      c.setAttribute('width', String(Math.round(r.width)));
      c.setAttribute('height', String(Math.round(r.height)));
      c.removeAttribute('class');
      const tone = Object.entries(fills).sort((a, b) => b[1] - a[1])[0]?.[0];
      logo = {svg: c.outerHTML, w: r.width, h: r.height, on, tone};
    }
  }
  return {
    vars, bg, text, buttons, links, page,
    display: font(h), body: font(document.body),
    name: meta('meta[property="og:site_name"]') || meta('meta[name="application-name"]') || document.title,
    tagline: meta('meta[name="description"]') || meta('meta[property="og:description"]') || '',
    icons, manifest, logo,
  };
});

// what comes back from the page is the page's to say: keep only well-formed colours and plain text
const isHex = (h) => typeof h === 'string' && /^#[0-9a-f]{6}$/.test(h);
const clean = (m) => Object.fromEntries(Object.entries(m ?? {}).filter(([k, v]) => isHex(k) && Number.isFinite(v)));
found.vars = Object.fromEntries(Object.entries(found.vars ?? {}).filter(([k, v]) => /^--[\w-]{1,80}$/.test(k) && isHex(v)));
for (const k of ['bg', 'text', 'buttons', 'links']) found[k] = clean(found[k]);
if (!isHex(found.page)) found.page = '#ffffff';
const plain = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, ' ').slice(0, n);
found.name = plain(found.name, 200);
found.tagline = plain(found.tagline, 400);

// --- colours: pick each role from what the page uses most, preferring names the CSS gives them ---
const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const lum = (h) => { const [r, g, b] = rgb(h).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hsl = (h) => {
  const [r, g, b] = rgb(h);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const hue = d === 0 ? 0 : mx === r ? 60 * (((g - b) / d) % 6) : mx === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  return {h: (hue + 360) % 360, s, l};
};
const colourful = (h) => { const c = hsl(h); return c.s > 0.28 && c.l > 0.12 && c.l < 0.85; };
const hueGap = (a, b) => { const d = Math.abs(hsl(a).h - hsl(b).h); return Math.min(d, 360 - d); };
const mixHex = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round((v + (rgb(b)[i] - v) * t) * 255).toString(16).padStart(2, '0')).join('');
const near = (a, b) => rgb(a).reduce((s, v, i) => s + Math.abs(v - rgb(b)[i]), 0) < 0.12;
const ranked = (m) => Object.entries(m).sort((a, b) => b[1] - a[1]).map(([k]) => k);
const byName = (re) => Object.entries(found.vars).filter(([n]) => re.test(n) && !/foreground|text|-fg\b|hover|muted|border|ring/i.test(n)).map(([, v]) => v);

const site = found.page;
// the browser's own link blue and Times mean the page's CSS never arrived: what follows is not the brand
if (found.links['#0000ee'] && /times/i.test(found.body.stack)) notes.push('the page looks unstyled (its CSS did not load): these colours and fonts are the browser defaults, not the brand');
const darkSite = lum(site) < 0.2;
const textTop = ranked(found.text)[0] ?? (darkSite ? '#ffffff' : '#111111');
// paper is the light background and ink the text on it; a dark site lends its text colour as paper
let paper = darkSite ? (lum(textTop) > 0.6 ? textTop : '#f5f5f2') : site;
// ink: the most used text colour that reads well on paper, else the strongest one
const texts = darkSite ? [site] : ranked(found.text).slice(0, 6);
let ink = texts.find((c) => contrast(c, paper) >= 7) ?? texts.sort((x, y) => contrast(y, paper) - contrast(x, paper))[0] ?? '#141414';
if (darkSite) notes.push('the site is dark: its background is used as ink and dark, and its text colour as paper');
if (contrast(ink, paper) < 4.5) { ink = lum(paper) > 0.5 ? '#141414' : '#f5f5f5'; notes.push(`ink had too little contrast on paper; using ${ink}`); }
// a colour taken toward black (or white) until it reaches a contrast with c
const until = (h, c, ratio, to = '#000000') => {
  let x = h;
  for (let k = 0; k <= 20 && contrast(x, c) < ratio; k++) x = mixHex(h, to, k / 20);
  if (contrast(x, c) < ratio) notes.push(`${h} can't reach ${ratio}:1 against ${c} even at ${to}: check the swatch`);
  return x;
};
// the brand colour: a named --primary/--brand, else the most used colourful button, link or background.
// It fills `brand` scenes under paper-coloured text, so it is darkened until that text reads on it.
const pool = [...byName(/primary|brand/), ...ranked(found.buttons), ...ranked(found.links), ...ranked(found.bg), ...byName(/accent|secondary|highlight/)];
let primary = pool.find((c) => colourful(c) && contrast(paper, c) >= 3) ?? pool.find(colourful);
if (!primary) { primary = byName(/primary|brand/)[0] ?? ranked(found.buttons)[0] ?? ink; notes.push(`no colourful brand colour on the page; primary is ${primary}`); }
if (contrast(paper, primary) < 3) { const was = primary; primary = until(primary, paper, 3); notes.push(`primary ${was} is too light under paper-coloured text; darkened to ${primary}`); }
// dark: the darkest well-used background, else the primary taken most of the way to black
let dark = darkSite ? site : ranked(found.bg).find((c) => lum(c) < 0.03 && !near(c, '#000000'));
if (!dark) dark = lum(primary) < 0.05 ? primary : mixHex(primary, '#000000', 0.72);
if (contrast(paper, dark) < 7) dark = until(dark, paper, 7);
// the accent marks starred words on paper and on dark, so it needs to show on both: a named --accent,
// else another colourful one with its own hue, else the primary; the one that shows best on both wins
const both = (c) => Math.min(contrast(c, paper), contrast(c, dark));
const others = [...byName(/accent|highlight|secondary/), ...pool].filter((c) => colourful(c) && !near(c, primary) && hueGap(c, primary) > 25);
let accent = others.find((c) => both(c) >= 2.2) ?? others.sort((x, y) => both(y) - both(x))[0];
if (!accent) { accent = pool.find(colourful) ?? primary; notes.push(`one brand colour only: accent = ${accent} (set brand.accent if the site has a highlight colour)`); }
if (both(accent) < 2.2) notes.push(`accent ${accent} is faint on ${contrast(accent, paper) < contrast(accent, dark) ? 'paper' : 'dark'}: starred words may not stand out`);

// --- fonts: the first face in each stack, mapped to a Google Font when it isn't one ---
const LIKE = {
  'helvetica': 'Inter', 'helvetica neue': 'Inter', 'arial': 'Inter', 'sf pro': 'Inter', 'sf pro display': 'Inter', 'sf pro text': 'Inter',
  'segoe ui': 'Inter', 'system-ui': 'Inter', '-apple-system': 'Inter', 'blinkmacsystemfont': 'Inter', 'ui-sans-serif': 'Inter', 'sans-serif': 'Inter',
  'söhne': 'Inter', 'sohne': 'Inter', 'graphik': 'Inter', 'aktiv grotesk': 'Inter', 'suisse intl': 'Inter', 'neue haas grotesk': 'Inter',
  'circular': 'DM Sans', 'circular std': 'DM Sans', 'gt walsheim': 'DM Sans', 'gt america': 'Inter', 'avenir': 'Nunito Sans', 'avenir next': 'Nunito Sans',
  'futura': 'Jost', 'proxima nova': 'Montserrat', 'gilroy': 'Plus Jakarta Sans', 'geistsans': 'Geist', 'geist sans': 'Geist', 'geistmono': 'Geist Mono',
  'georgia': 'Source Serif 4', 'times': 'Source Serif 4', 'times new roman': 'Source Serif 4', 'ui-serif': 'Source Serif 4', 'serif': 'Source Serif 4',
  'menlo': 'JetBrains Mono', 'monaco': 'JetBrains Mono', 'consolas': 'JetBrains Mono', 'sf mono': 'JetBrains Mono', 'ui-monospace': 'JetBrains Mono', 'monospace': 'JetBrains Mono',
};
const google = new Map();
async function isGoogle(family) {
  if (!google.has(family)) {
    const r = await ctx.request.get(`https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, '+')}`, {timeout: 15000}).catch(() => null);
    google.set(family, !!r && r.ok());
  }
  return google.get(family);
}
async function face(f, role) {
  // Next.js and similar rename faces: "__Inter_d65c78", "__Space_Grotesk_Fallback_9f2a1b"
  const raw = f.stack.split(',')[0].replace(/["']/g, '').trim();
  let name = raw.replace(/^__/, '').replace(/_Fallback/i, '').replace(/_[0-9a-f]{5,}$/i, '').replace(/_/g, ' ').trim();
  name = name.replace(/\s+(variable|vf)$/i, '');
  if (name === name.toUpperCase()) name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const weight = Math.min(900, Math.max(400, Math.round(f.weight / 100) * 100));
  const system = LIKE[name.toLowerCase()];
  if (!system && (await isGoogle(name))) return {family: name, weight};
  const like = system ?? (/serif/i.test(f.stack) && !/sans/i.test(f.stack) ? 'Source Serif 4' : /mono/i.test(f.stack) ? 'JetBrains Mono' : 'Inter');
  notes.push(`${role} face "${name}" isn't a Google Font: using ${like}, the closest one`);
  return {family: like, weight};
}
const display = await face(found.display, 'display');
const text = await face(found.body, 'text');
if (display.weight < 600) display.weight = Math.max(display.weight, 600);

// --- the name and line ---
// the title's part that is in the host name ("Home page | Yarn" on yarnpkg.com), else its first part
const parts = (found.name || '').split(/\s+[|·•–—-]\s+|:\s/).map((x) => x.trim()).filter(Boolean);
const hostWord = new URL(url).hostname.replace(/^www\./, '').toLowerCase();
let name = parts.find((x) => { const w = x.toLowerCase().replace(/[^a-z0-9]/g, ''); return w.length > 1 && hostWord.includes(w); }) ?? parts[0] ?? hostWord;
if (name.length > 28) { name = new URL(url).hostname.replace(/^www\./, '').split('.')[0]; notes.push(`the page title is long; name = "${name}"`); }
let tagline = found.tagline.replace(/\s+/g, ' ').trim();
if (tagline.length > 90) tagline = tagline.split(/(?<=[.!?])\s/)[0];
if (tagline.length > 90) tagline = '';
const host = new URL(url).hostname.replace(/^www\./, '');
// a dev server's address is no URL to show on an end card
const local = /^(localhost|127\.|0\.0\.0\.0|\[?::1\]?|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$/i.test(host);
if (local) notes.push(`${host} is a local address: set brand.url to the public one for the end card`);

// --- the mark: an SVG favicon, else the biggest square icon (app icon, manifest icon, favicon) ---
async function fetchTo(src, base) {
  if (!/^https?:\/\//i.test(String(src))) return null; // no file:, data: or other schemes from the page
  const r = await ctx.request.get(src, {timeout: 20000, maxRedirects: 3}).catch(() => null);
  if (!r || !r.ok() || (await r.body()).length > 5e6) return null;
  const type = r.headers()['content-type'] || '';
  const ext = /svg/.test(type) || /\.svg(\?|$)/i.test(src) ? 'svg' : /png/.test(type) || /\.png(\?|$)/i.test(src) ? 'png' : /icon|ico/.test(type) || /\.ico(\?|$)/i.test(src) ? 'ico' : /jpe?g/.test(type) ? 'jpg' : /webp/.test(type) ? 'webp' : null;
  if (!ext) return null;
  const file = path.join(dir, `${base}.${ext}`);
  fs.writeFileSync(file, await r.body());
  if (ext === 'svg') return file;
  // raster: keep the biggest frame as PNG (an .ico holds several)
  const png = path.join(dir, `${base}.png`);
  try { execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-frames:v', '1', `${png}.tmp.png`]); fs.renameSync(`${png}.tmp.png`, png); } catch { return null; }
  if (file !== png) fs.rmSync(file);
  return png;
}
const dims = (file) => {
  if (file.endsWith('.svg')) {
    const s = fs.readFileSync(file, 'utf8');
    const vb = s.match(/viewBox=["']\s*[-\d.]+[\s,]+[-\d.]+[\s,]+([\d.]+)[\s,]+([\d.]+)/);
    const w = s.match(/<svg[^>]*\swidth=["']([\d.]+)/), h = s.match(/<svg[^>]*\sheight=["']([\d.]+)/);
    return vb ? [+vb[1], +vb[2]] : w && h ? [+w[1], +h[1]] : [1, 1];
  }
  const o = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], {encoding: 'utf8'}).trim().split(',');
  return [+o[0], +o[1]];
};
const iconList = [...found.icons];
if (found.manifest) {
  const r = await ctx.request.get(found.manifest, {timeout: 15000}).catch(() => null);
  if (r?.ok()) { try { for (const i of (await r.json()).icons ?? []) iconList.push({href: new URL(i.src, found.manifest).href, rel: 'manifest', sizes: i.sizes || '', type: i.type || ''}); } catch {} }
}
iconList.push({href: new URL('/favicon.ico', url).href, rel: 'icon', sizes: '', type: ''});
const size = (i) => Math.max(0, ...i.sizes.split(/\s+/).map((s) => +s.split('x')[0] || 0));
const order = [...iconList.filter((i) => /svg/.test(i.type) || /\.svg(\?|$)/i.test(i.href)).filter((i) => i.rel !== 'mask-icon'), ...iconList.filter((i) => !/svg/.test(i.type) && i.rel !== 'mask-icon').sort((a, b) => size(b) - size(a))];
// try them all and keep the sharpest square one (an SVG beats any bitmap)
let mark = null, best = 0, n = 0;
for (const i of order.slice(0, 8)) {
  const f = await fetchTo(i.href, `icon-${n++}`);
  if (!f) continue;
  const [w, h] = dims(f);
  const score = f.endsWith('.svg') ? 1e9 : w;
  if (Math.abs(w / h - 1) > 0.15 || score <= best) { fs.rmSync(f); continue; }
  if (mark) fs.rmSync(mark);
  mark = f; best = score;
}
if (mark) { const to = path.join(dir, `mark${path.extname(mark)}`); fs.renameSync(mark, to); mark = to; }
if (mark && mark.endsWith('.png')) {
  const px = execFileSync('ffmpeg', ['-v', 'error', '-i', mark, '-vf', 'crop=1:1:0:0,format=rgba', '-frames:v', '1', '-f', 'rawvideo', '-'], {maxBuffer: 1e6});
  if (px[3] === 255) notes.push('the icon fills a solid square (an app icon): it shows as a tile on dark scenes');
}
if (mark && best < 128) notes.push(`the biggest square icon is ${best} px: it will look soft at title size (set brand.mark to a bigger one)`);
if (!mark) notes.push('no square icon found: title and end show the name without a mark (set brand.mark)');

// --- a wide logo from the header, for title and end ---
let logo = null;
if (found.logo && found.logo.w / found.logo.h >= 1.6 && isHex(found.logo.on) && (typeof found.logo.svg === 'string' ? found.logo.svg.length < 5e5 : typeof found.logo.src === 'string')) {
  // which scenes it can sit on: by the colour it's drawn in when we know it (a light logo goes on dark scenes),
  // else by the background it sat on
  const light = isHex(found.logo.tone) ? lum(found.logo.tone) > 0.45 : lum(found.logo.on) < 0.35;
  const base = light ? 'logo-dark' : 'logo';
  if (found.logo.svg) { logo = path.join(dir, `${base}.svg`); fs.writeFileSync(logo, found.logo.svg.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/\son\w+\s*=\s*("[^"]*"|'[^']*')/gi, '')); }
  else logo = await fetchTo(found.logo.src, base);
  if (logo) notes.push(`wide logo from the header, drawn ${light ? 'light' : 'dark'}: used on ${light ? 'dark' : 'light'} title and end scenes; the others keep mark and name`);
}

const rel = (f) => (f ? path.relative(run, f) : undefined);
const brand = {
  name, tagline: tagline || undefined, url: local ? undefined : host,
  paper, ink, primary, accent, dark,
  display, text,
  mark: rel(mark),
  ...(logo ? {[path.basename(logo).startsWith('logo-dark') ? 'logoDark' : 'logo']: rel(logo)} : {}),
};
fs.writeFileSync(path.join(run, 'site-brand.json'), JSON.stringify({source: url, ...brand, notes}, null, 2) + '\n');

// --- a swatch sheet to check by eye ---
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const dataUrl = (f) => `data:${f.endsWith('.svg') ? 'image/svg+xml' : 'image/png'};base64,${fs.readFileSync(f).toString('base64')}`;
const fam = (f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}:wght@400;${f.weight}`;
const chip = (k, v) => `<div class="c"><div style="background:${v}"></div><b>${k}</b><span>${v}</span></div>`;
await page.setViewportSize({width: 900, height: 600});
await page.setContent(`<!doctype html><html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?${fam(display)}&${fam(text)}&display=block"><style>
body{margin:0;padding:32px;background:${paper};color:${ink};font:16px '${text.family}',sans-serif}
.row{display:flex;gap:14px;margin:18px 0}.c div{width:110px;height:70px;border-radius:10px;border:1px solid #0002}.c b,.c span{display:block;font-size:13px}
h1{font:${display.weight} 54px/1 '${display.family}',sans-serif;margin:0}.dark{background:${dark};color:${paper};padding:22px;border-radius:12px;display:flex;gap:22px;align-items:center}
.dark em{color:${accent};font-style:normal}img{height:72px}</style></head><body>
<h1>${esc(name)} <em style="color:${accent};font-style:normal">brand</em></h1><p>${esc(tagline || '(no tagline found)')} · ${esc(display.family)} ${display.weight} / ${esc(text.family)}</p>
<div class="row">${[['paper', paper], ['ink', ink], ['primary', primary], ['accent', accent], ['dark', dark]].map(([k, v]) => chip(k, v)).join('')}</div>
<div class="row">${mark ? `<img src="${dataUrl(mark)}">` : ''}${brand.logo ? `<img src="${dataUrl(logo)}">` : ''}</div>
<div class="dark">${mark ? `<img src="${dataUrl(mark)}">` : ''}${brand.logoDark ? `<img src="${dataUrl(logo)}">` : ''}<h1 style="font-size:40px">On <em>dark</em></h1></div>
</body></html>`, {waitUntil: 'networkidle'}).catch(() => {});
await page.waitForTimeout(400);
await page.screenshot({path: path.join(dir, 'swatch.png'), fullPage: true});
await browser.close();

console.log(JSON.stringify(brand, null, 1));
for (const n of notes) console.log(`note: ${n}`);
console.log(`${path.join(run, 'site-brand.json')}\n${path.join(dir, 'swatch.png')}`);
