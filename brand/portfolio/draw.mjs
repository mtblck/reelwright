// Reelwright's portfolio covers: one scene, drawn twice (2400 × 800 and 1000 × 800).
//
// Verb: Reelwright *cuts* a promo from a repo. Picture: an editing timeline on a
// dark cutting mat, a film strip of the promo's scenes over a voice waveform and a
// music track, with the three cuts it makes (tall, wide and the square in Tungsten)
// framed around one scene on one centre. Front-on throughout. The three frames are
// the mark's own idea, so the logo is part of the scene rather than a badge on it.
//
//   node draw.mjs        writes cover.svg and cover-mobile.svg next to this file
//   node $BRAND_KIT/scripts/portfolio.mjs ../brand.json
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = process.env.BRAND_KIT || '/home/claude/brand-kit/skills/logo'
const { svg, write } = await import(join(KIT, 'scripts/brand.mjs'))
const here = dirname(fileURLToPath(import.meta.url))

const C = { emulsion: '#0F4C4A', tungsten: '#D9661F', leader: '#F6F2EA', darkroom: '#0B1A19', wash: '#D3E5E1', mat: '#12201F', strip: '#16292A' }
const r1 = (n) => Math.round(n * 10) / 10
const box = (x, y, w, h, rx, fill, extra = '') => `<rect x="${r1(x)}" y="${r1(y)}" width="${r1(w)}" height="${r1(h)}" rx="${r1(rx)}" fill="${fill}"${extra}/>`

/** What sits in one film-strip cell, centred on (x, y) at scale k. */
const cells = {
  // An empty dark frame: the leader running off toward the edges.
  blank: () => '',
  // A code scene: indented lines in Emulsion and Wash.
  code: (x, y, k) =>
    [[0, 150, 1], [24, 230, 0.6], [24, 190, 1], [0, 260, 0.6], [24, 120, 1], [24, 210, 0.6], [0, 170, 1]]
      .map(([dx, w, o], i) => box(x - 180 * k + dx * k, y - 90 * k + i * 27 * k, w * k, 12 * k, 6 * k, o === 1 ? C.emulsion : C.wash, o === 1 ? '' : ` opacity="${o}"`))
      .join(''),
  // The title card: the mark over a name bar, on Leader.
  title: (x, y, k) =>
    `<rect x="${r1(x - 18 * k)}" y="${r1(y - 62 * k)}" width="${r1(36 * k)}" height="${r1(64 * k)}" rx="${r1(5 * k)}" fill="none" stroke="${C.emulsion}" stroke-width="${r1(7 * k)}"/>` +
    `<rect x="${r1(x - 32 * k)}" y="${r1(y - 48 * k)}" width="${r1(64 * k)}" height="${r1(36 * k)}" rx="${r1(5 * k)}" fill="none" stroke="${C.emulsion}" stroke-width="${r1(7 * k)}"/>` +
    box(x - 70 * k, y + 24 * k, 140 * k, 18 * k, 9 * k, C.emulsion) +
    box(x - 50 * k, y + 52 * k, 100 * k, 10 * k, 5 * k, C.emulsion, ' opacity="0.45"'),
  // The scene in the cut: a headline in three bars on Emulsion.
  hero: (x, y, k) =>
    box(x - 100 * k, y - 62 * k, 200 * k, 30 * k, 15 * k, C.leader, ' opacity="0.4"') +
    box(x - 105 * k, y - 18 * k, 210 * k, 30 * k, 15 * k, C.leader, ' opacity="0.4"') +
    box(x - 110 * k, y + 26 * k, 220 * k, 30 * k, 15 * k, C.wash),
  // The end card: a square and a call-to-action button, on Leader.
  end: (x, y, k) =>
    `<rect x="${r1(x - 26 * k)}" y="${r1(y - 70 * k)}" width="${r1(52 * k)}" height="${r1(52 * k)}" rx="${r1(6 * k)}" fill="none" stroke="${C.emulsion}" stroke-width="${r1(7 * k)}"/>` +
    box(x - 80 * k, y, 160 * k, 40 * k, 20 * k, C.emulsion) +
    box(x - 50 * k, y + 16 * k, 100 * k, 8 * k, 4 * k, C.leader),
}
const ground = { blank: C.darkroom, code: C.darkroom, title: C.leader, hero: C.emulsion, end: C.leader }

/** A deterministic waveform: clusters of bars (words) with gaps between them. */
function waveform(x0, x1, y, k) {
  let seed = 7
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
  let d = '', x = x0
  while (x < x1) {
    const n = 5 + Math.floor(rnd() * 8)
    for (let i = 0; i < n && x < x1; i++, x += 14 * k) {
      const h = (10 + rnd() * 22 + Math.sin((i / n) * Math.PI) * 10) * k
      d += `M${r1(x)} ${r1(y - h)}V${r1(y + h)}`
    }
    x += (26 + rnd() * 30) * k
  }
  return `<path d="${d}" stroke="${C.wash}" stroke-opacity="0.45" stroke-width="${r1(7 * k)}" stroke-linecap="round" fill="none"/>`
}

/**
 * The scene at width W (height 800), at scale k around (W / 2, cy).
 * `types` names the strip's cells from left to right, centred on the middle one.
 */
function scene(W, H, { k, cy, types, ruler = true, title }) {
  const cx = W / 2, edge = 96, parts = []
  const inside = (x0, x1) => x0 >= edge && x1 <= W - edge
  // The cutting mat: a faint 50 px grid, edge to edge.
  parts.push(`<rect width="${W}" height="${H}" fill="${C.darkroom}"/>`)
  let grid = ''
  for (let x = 0; x <= W; x += 50) grid += `M${x} 0V${H}`
  for (let y = 0; y <= H; y += 50) grid += `M0 ${y}H${W}`
  parts.push(`<path d="${grid}" stroke="${C.mat}" stroke-width="2" fill="none"/>`)
  // The ruler: a timecode line with ticks, majors every fifth.
  if (ruler) {
    const ry = cy - 254 * k
    let d = `M0 ${r1(ry)}H${W}`
    for (let i = -40; i <= 40; i++) {
      const x = cx + i * 40 * k
      if (x < edge || x > W - edge) continue
      d += `M${r1(x)} ${r1(ry - (i % 5 === 0 ? 22 : 10) * k)}V${r1(ry)}`
    }
    parts.push(`<path d="${d}" stroke="${C.wash}" stroke-opacity="0.35" stroke-width="2" fill="none"/>`)
  }
  // The film strip, edge to edge, with its sprocket holes.
  const sy = cy - 180 * k, sh = 360 * k
  parts.push(box(-10, sy, W + 20, sh, 0, C.strip))
  parts.push(`<defs><rect id="hole" width="${r1(22 * k)}" height="${r1(26 * k)}" rx="${r1(5 * k)}" fill="${C.darkroom}"/></defs>`)
  for (let i = -60; i <= 60; i++) {
    const x = cx - 11 * k + i * 48 * k
    if (x < -30 || x > W + 10) continue
    parts.push(`<use href="#hole" x="${r1(x)}" y="${r1(sy + 10 * k)}"/><use href="#hole" x="${r1(x)}" y="${r1(sy + sh - 36 * k)}"/>`)
  }
  // The cells: the promo's scenes. Anything that would run into the quiet edges is an empty frame.
  const cw = 440 * k, ch = 248 * k, pitch = 468 * k, mid = types.length >> 1
  types.forEach((t, i) => {
    const x = cx + (i - mid) * pitch
    const fits = inside(x - cw / 2, x + cw / 2)
    const type = fits ? t : 'blank'
    parts.push(box(x - cw / 2, cy - ch / 2, cw, ch, 8 * k, ground[type]))
    parts.push(cells[type](x, cy, k))
  })
  // The voice waveform and the music track below the strip.
  parts.push(waveform(edge + 6 * k, W - edge - 6 * k, cy + 298 * k, k))
  const ty = cy + 372 * k
  parts.push(box(-20, ty, W + 40, 40 * k, 20 * k, C.emulsion))
  let ticks = ''
  for (let x = cx - 28 * k; x >= edge; x -= 56 * k) ticks += `M${r1(x)} ${r1(ty + 10 * k)}V${r1(ty + 30 * k)}`
  for (let x = cx + 28 * k; x <= W - edge; x += 56 * k) ticks += `M${r1(x)} ${r1(ty + 10 * k)}V${r1(ty + 30 * k)}`
  parts.push(`<path d="${ticks}" stroke="${C.wash}" stroke-opacity="0.5" stroke-width="${r1(3 * k)}" fill="none"/>`)
  // The cut: tall and wide frames in Leader, the square in Tungsten, on one centre, with crop marks.
  parts.push(box(cx - 300 * k, cy + 268 * k, 600 * k, 24 * k, 12 * k, '#000', ' opacity="0.12"'))
  const frame = (w, h, rx, stroke, sw) => `<rect x="${r1(cx - (w * k) / 2)}" y="${r1(cy - (h * k) / 2)}" width="${r1(w * k)}" height="${r1(h * k)}" rx="${r1(rx * k)}" fill="none" stroke="${stroke}" stroke-width="${r1(sw * k)}"/>`
  parts.push(frame(292, 520, 18, C.leader, 16))
  parts.push(frame(548, 308, 18, C.leader, 16))
  parts.push(frame(360, 360, 20, C.tungsten, 18))
  const corner = (x, y, sx, sy2) => `M${r1(cx + x * k)} ${r1(cy + (y + sy2 * 34) * k)}V${r1(cy + y * k)}H${r1(cx + (x + sx * 34) * k)}`
  parts.push(`<path d="${corner(-210, -210, 1, 1)}${corner(-210, 210, 1, -1)}${corner(210, -210, -1, 1)}${corner(210, 210, -1, -1)}" stroke="${C.tungsten}" stroke-width="${r1(8 * k)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`)
  return svg({ w: W, h: H, title, body: parts.join('') })
}

const alt = 'An editing timeline on a dark cutting mat: a film strip of a promo’s scenes runs over a voice waveform and a music track, with a tall, a wide and an orange square frame cut around one scene on one center.'

write(join(here, 'cover.svg'), scene(2400, 800, { title: alt, k: 0.8, cy: 380, types: ['blank', 'blank', 'code', 'title', 'hero', 'code', 'end', 'blank', 'blank'] }))
write(join(here, 'cover-mobile.svg'), scene(1000, 800, { title: alt, k: 0.9, cy: 384, types: ['title', 'hero', 'code'] }))
console.log('alt:', alt)
