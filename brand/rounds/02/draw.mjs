// Reelwright, round 2: sketch 2 (square, tall and wide frames on one centre)
// drawn properly five ways, in colour, plus the horizontal lockup.
//   node draw.mjs   (BRAND_KIT points at brand-kit/skills/logo)
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const KIT = process.env.BRAND_KIT || '/home/claude/brand-kit/skills/logo'
const { loadFont, lockup, svg, write, rect } = await import(join(KIT, 'scripts/brand.mjs'))
const { union, subtract, intersect, bounds, dilate } = await import(join(KIT, 'scripts/geometry.mjs'))
const here = dirname(fileURLToPath(import.meta.url))
const out = (f) => join(here, f)

const INK = '#0F4C4A', ACC = '#D9661F'

// A frame: outline of a w × h box centred on (128,128), band s, outer radius r.
const frame = (w, h, s, r) => subtract(rect(128 - w / 2, 128 - h / 2, w, h, r), rect(128 - w / 2 + s, 128 - h / 2 + s, w - 2 * s, h - 2 * s, Math.max(0, r - s)))
// The tall frame's width is the square's inner width, so their edges meet exactly.
const set = ({ W, H, s, r }) => ({ sq: frame(W + 2 * s, W + 2 * s, s, r), tall: frame(W, H, s, r), wide: frame(H, W, s, r) })

const V = [
  { label: 'A · as sketched, 112 × 208, band 16', ...set({ W: 112, H: 208, s: 16, r: 10 }) },
  { label: 'B · true 9:16, band 16', ...set({ W: 117, H: 208, s: 16, r: 10 }) },
  { label: 'C · true 9:16, band 22, heavier', ...set({ W: 108, H: 192, s: 22, r: 12 }) },
  { label: 'D · true 9:16, square corners', ...set({ W: 117, H: 208, s: 16, r: 0 }) },
]
// F · B with the square as the solid centre: the 1:1 cut is the one you see first.
{
  const b = set({ W: 117, H: 208, s: 16, r: 10 })
  V.push({ label: 'E · B, the square filled', sq: subtract(rect(128 - 74.5, 128 - 74.5, 149, 149, 10), dilate(union(b.tall, b.wide), 0)), tall: b.tall, wide: b.wide, solidSq: true })
}

const markOf = (v, ink, acc) => {
  const others = union(v.tall, v.wide)
  const d = union(v.sq, others), bb = bounds(d)
  const body = `<g transform="translate(${-bb.x} ${-bb.y})"><path d="${others}" fill="${ink}" fill-rule="evenodd"/><path d="${v.sq}" fill="${acc}" fill-rule="evenodd"/></g>`
  return { body, w: bb.w, h: bb.h }
}
const files = []
V.forEach((v, i) => {
  const m = markOf(v, INK, ACC)
  const f = out(`${'ABCDEF'[i]}.svg`)
  write(f, svg({ w: m.w, h: m.h, title: `Reelwright ${v.label}`, body: m.body }))
  files.push(f)
})

const font = await loadFont('Familjen Grotesk', 700)
const lock = []
for (const [i, name] of [[1, 'Reelwright'], [1, 'reelwright'], [4, 'Reelwright']]) {
  const l = lockup({ mark: markOf(V[i], INK, ACC), font, name, layout: 'horizontal', color: INK, tracking: -0.02 })
  const f = out(`lockup-${'ABCDEF'[i]}-${name[0] === 'R' ? 'cap' : 'lower'}.svg`)
  write(f, svg({ w: l.w, h: l.h, title: 'Reelwright', body: l.body }))
  lock.push(f)
}
const R = join(KIT, 'scripts/render.mjs')
execFileSync('node', [R, ...files, '--sheet', out('round-2-marks.png'), '--title', 'Reelwright · round 2 · the frames mark five ways (A–E)'], { stdio: 'inherit' })
execFileSync('node', [R, ...lock, '--sheet', out('round-2-lockups.png'), '--title', 'Reelwright · round 2 · lockups in Familjen Grotesk 700'], { stdio: 'inherit' })
console.log(V.map((v, i) => `${i + 1}=${v.label}`).join('\n'))
