// Reelwright, round 1: nine sketches on a 3 × 3 grid, in black.
// Rows are structures (symbol, lettermark, wordmark); columns are weirdness 2, 3
// and 4. Pick one to three by number; only those get drawn properly.
//
//   node draw.mjs   (BRAND_KIT points at brand-kit/skills/logo; writes 1.svg … 9.svg and round-1.png)
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const KIT = process.env.BRAND_KIT || '/home/claude/brand-kit/skills/logo'
const { loadFont, text, svg, write, rect, poly, arcBand, polar } = await import(join(KIT, 'scripts/brand.mjs'))
const { union, subtract, intersect, bounds, solid, transform, C } = await import(join(KIT, 'scripts/geometry.mjs'))

const here = dirname(fileURLToPath(import.meta.url))
const out = (f) => join(here, f)

const fam = await loadFont('Familjen Grotesk', 700)
const mono = await loadFont('Martian Mono', 800)
const word = (font, str, size, opts = {}) => {
  const t = text(font, str, { size, ...opts })
  return { ...t, d: solid(t.d) }
}
const cells = []

// 1 · Symbol · 2: a film reel whose three windows are the three cuts it makes:
// tall (9:16), wide (16:9) and square (1:1).
{
  const R = 112, hub = 16, ring = 62, rr = 6
  const at = (deg) => polar(128, 128, ring, deg)
  const [tx, ty] = at(-90), [wx, wy] = at(30), [sx, sy] = at(150)
  const tall = rect(tx - 20, ty - 34, 40, 70, rr)
  const wide = rect(wx - 35, wy - 20, 70, 40, rr)
  const sq = rect(sx - 26, sy - 26, 52, 52, rr)
  cells.push(subtract(C(128, 128, R).d, C(128, 128, hub).d, tall, wide, sq))
}

// 2 · Symbol · 3: the three frames themselves, laid over each other on one
// centre like guides in a viewfinder: square, tall and wide, one outline each.
{
  const w = 16
  const frame = (fw, fh) => subtract(rect(128 - fw / 2, 128 - fh / 2, fw, fh, 10), rect(128 - fw / 2 + w, 128 - fh / 2 + w, fw - 2 * w, fh - 2 * w, 0))
  cells.push(union(frame(144, 144), frame(112, 208), frame(208, 112)))
}

// 3 · Symbol · 4: the wright at work: a hand plane whose shaving curls up out
// of its mouth as a strip of film, sprocket holes and all.
{
  const body = poly([[16, 220], [240, 220], [240, 192], [222, 180], [34, 180], [16, 196]])
  const tote = subtract(rect(184, 116, 48, 72, 24), rect(202, 134, 12, 38, 6))
  const curl = arcBand(98, 104, 64, 28, 150, 430)
  const holes = [195, 250, 305, 360].map((a) => {
    const [x, y] = polar(98, 104, 50, a)
    return rect(x - 7, y - 7, 14, 14, 0)
  })
  const [ex, ey] = polar(98, 104, 50, 430)
  const lip = rect(ex - 14, ey - 4, 28, 186 - ey, 0)
  cells.push(subtract(union(body, tote, curl, lip), ...holes, rect(ex - 18, 186, 4, 0.01, 0)))
}

// 4 · Lettermark · 2: an R whose stem is a strip of film.
{
  const R = word(fam, 'R', 300), b = R.bbox
  const d = transform(R.d, { x: 128 - (b.x1 + b.w / 2), y: 128 + b.h / 2 - b.y2 })
  const bb = bounds(d)
  const stem = word(fam, 'l', 300).bbox.w
  const cx = bb.x + stem / 2, s = stem * 0.34
  const holes = [0.16, 0.39, 0.62, 0.85].map((t) => rect(cx - s / 2, bb.y + bb.h * t - s / 2, s, s, 0))
  cells.push(subtract(d, ...holes))
}

// 5 · Lettermark · 3: r and w knocked out of a vertical 9:16 tile, the phone
// frame most of the cuts end up in.
{
  const t = word(fam, 'rw', 120, { tracking: -0.06 }), b = t.bbox
  const tile = rect(56, 0, 144, 256, 24)
  const letters = transform(t.d, { x: 128 - (b.x1 + b.w / 2), y: 172 - b.y2 })
  cells.push(subtract(tile, letters))
}

// 6 · Lettermark · 4: an R that is a projector: its bowl is the lamp, its leg
// is the beam, widening onto the screen.
{
  const R = word(fam, 'R', 300), b = R.bbox
  const d = transform(R.d, { x: 128 - (b.x1 + b.w / 2) - 30, y: 128 + b.h / 2 - b.y2 })
  const bb = bounds(d)
  const top = intersect(d, rect(bb.x - 2, bb.y - 2, bb.w + 4, bb.h * 0.58, 0))
  const stemW = word(fam, 'l', 300).bbox.w
  const stem = rect(bb.x, bb.y, stemW, bb.h, 0)
  const y0 = bb.y + bb.h * 0.58 + 12, y1 = bb.y + bb.h
  const beam = poly([[bb.x + stemW + 18, y0], [bb.x + stemW + 50, y0], [bb.x + bb.w + 64, y1], [bb.x + stemW + 44, y1]])
  cells.push(union(top, stem, beam))
}

// 7 · Wordmark · 2: "reelwright" in Familjen Grotesk 700, tightened, the i's
// dot a square frame (accent later).
{
  const size = 120, tr = -0.02
  const pre = word(fam, 'reelwr', size, { tracking: tr })
  const all = word(fam, 'reelwrıght', size, { tracking: tr })
  const idot = word(fam, 'ı', size)
  const stem = idot.bbox.w
  const ix = pre.width + tr * size + idot.bbox.x1
  const top = all.bbox.y1
  const sq = rect(ix - 1, top - stem * 1.35 - 6, stem + 2, stem + 2, 0)
  cells.push(union(all.d, sq))
}

// 8 · Wordmark · 3: the double e becomes two reels, spokes and hub, at x-height.
{
  const size = 120
  const r = word(fam, 'r', size), rest = word(fam, 'lwright', size)
  const xh = word(fam, 'x', size).bbox.h * 1.04
  const rad = xh / 2, gap = size * 0.03
  const cy = -xh / 2 + size * 0.004
  const c1 = r.width + gap + rad, c2 = c1 + 2 * rad + gap
  const reel = (cx) => {
    const holes = [-90, 30, 150].map((a) => {
      const [x, y] = polar(cx, cy, rad * 0.52, a)
      return C(x, y, rad * 0.24).d
    })
    return subtract(C(cx, cy, rad).d, C(cx, cy, rad * 0.12).d, ...holes)
  }
  const restD = transform(rest.d, { x: c2 + rad + gap })
  cells.push(union(r.d, reel(c1), reel(c2), restD))
}

// 9 · Wordmark · 4: a jump cut. "reelwright" in a mono face, sliced in three
// like a clip on a timeline, the middle take nudged up and over.
{
  const t = word(mono, 'reelwright', 100), b = t.bbox
  const cut = (x0, x1) => intersect(t.d, rect(x0, b.y1 - 10, x1 - x0, b.h + 20, 0))
  const a = b.x1 + b.w * 0.45, c = b.x1 + b.w * 0.75
  cells.push(union(cut(b.x1 - 2, a), transform(cut(a, c), { x: 8, y: -16 }), transform(cut(c, b.x2 + 2), { x: 16 })))
}

cells.forEach((d, i) => {
  const b = bounds(d), p = 2
  write(out(`${i + 1}.svg`), svg({ w: b.w + p * 2, h: b.h + p * 2, title: `Reelwright sketch ${i + 1}`, body: `<path d="${d}" fill="#000" fill-rule="evenodd" transform="translate(${p - b.x} ${p - b.y})"/>` }))
})
execFileSync('node', [join(KIT, 'scripts/render.mjs'), ...cells.map((_, i) => out(`${i + 1}.svg`)), '--sheet', out('round-1.png'), '--rows', 'Symbol,Lettermark,Wordmark', '--cols', 'Weirdness 2,Weirdness 3,Weirdness 4', '--title', 'Reelwright · round 1 · nine unrefined sketches, pick one to three', '--mono'], { stdio: 'inherit' })
