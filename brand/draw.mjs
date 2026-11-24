// Reelwright: short promo videos for a project, cut from its repo and its brand.
// Concept: the three cuts it makes (square 1:1, tall 9:16, wide 16:9) drawn as
// three frames on one centre. On a 256 grid: band 16, outer radius 10; the tall
// frame is 117 × 208 (9:16), the wide one 208 × 117, and the square 149, so its
// inner edge meets the tall frame's outer edge exactly. The square is the accent.
//
//   node draw.mjs        (BRAND_KIT points at brand-kit/skills/logo)
//   node $BRAND_KIT/scripts/export.mjs brand.json
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT = process.env.BRAND_KIT || '/home/claude/brand-kit/skills/logo'
const { loadFont, lockup, svg, write, rect } = await import(join(KIT, 'scripts/brand.mjs'))
const { union, subtract, bounds } = await import(join(KIT, 'scripts/geometry.mjs'))
const here = dirname(fileURLToPath(import.meta.url))
const out = (f) => join(here, f)

const C = { emulsion: '#0F4C4A', tungsten: '#D9661F', leader: '#F6F2EA', darkroom: '#0B1A19', wash: '#D3E5E1' }

const W = 117, H = 208, S = 16, R = 10, SQ = W + 2 * S
const frame = (w, h) => subtract(rect(128 - w / 2, 128 - h / 2, w, h, R), rect(128 - w / 2 + S, 128 - h / 2 + S, w - 2 * S, h - 2 * S, 0))
const square = frame(SQ, SQ), others = union(frame(W, H), frame(H, W))
const bb = bounds(union(square, others)) // 208 × 208 from (24, 24)
const markBody = (ink, acc) => `<g transform="translate(${-bb.x} ${-bb.y})"><path d="${others}" fill="${ink}"/><path d="${square}" fill="${acc}"/></g>`
const mark = (ink, acc) => ({ body: markBody(ink, acc), w: bb.w, h: bb.h })

write(out('mark.svg'), svg({ w: bb.w, h: bb.h, title: 'Reelwright', body: markBody(C.emulsion, C.tungsten) }))
write(out('mark-dark.svg'), svg({ w: bb.w, h: bb.h, title: 'Reelwright', body: markBody(C.leader, C.tungsten) }))

// Favicon: at 16 px a 16-unit band is one pixel, so the small version fills the
// square (the 1:1 cut) in Tungsten and thickens the bands to 28, on an Emulsion tile.
{
  const s = 28, w = 112, h = 200, sq = w + 2 * s
  const fr = (fw, fh) => subtract(rect(128 - fw / 2, 128 - fh / 2, fw, fh, 14), rect(128 - fw / 2 + s, 128 - fh / 2 + s, fw - 2 * s, fh - 2 * s, 0))
  const lines = union(fr(w, h), fr(h, w))
  const fill = subtract(rect(128 - sq / 2, 128 - sq / 2, sq, sq, 14), lines)
  write(out('favicon.svg'), svg({ w: 256, h: 256, title: 'Reelwright', body: `<rect width="256" height="256" rx="56" fill="${C.emulsion}"/><g transform="translate(128 128) scale(0.8) translate(-128 -128)"><path d="${fill}" fill="${C.tungsten}"/><path d="${lines}" fill="${C.leader}"/></g>` }))
}

const font = await loadFont('Familjen Grotesk', 700)
for (const [layout, file, gap] of [['horizontal', 'logo-horizontal', 0.24], ['stacked', 'logo-stacked', 0.3]]) {
  for (const [suffix, ink, word] of [['', C.emulsion, C.emulsion], ['-dark', C.leader, C.leader]]) {
    const l = lockup({ mark: mark(ink, C.tungsten), font, name: 'Reelwright', layout, gap, color: word, tracking: -0.02 })
    write(out(`${file}${suffix}.svg`), svg({ w: l.w, h: l.h, title: 'Reelwright', body: l.body }))
  }
}

write(out('brand.json'), JSON.stringify({
  name: 'Reelwright',
  tagline: 'Promo videos, cut from your repo.',
  about: 'Reelwright makes short promo videos for a project from its repo and its brand: square, vertical and landscape cuts with a voiceover, music and sound effects. It is a Claude Code plugin in the mtblck marketplace.\n\nThe mark is the three cuts it makes, drawn as frames on one centre: tall, wide, and the square in Tungsten.',
  construction: 'On a 256 grid, band 16: a 9:16 frame of 117 × 208, the same frame turned 16:9, and a square of 149 whose inner edge meets the tall frame exactly.',
  website: 'github.com/mtblck/reelwright',
  colors: [
    { name: 'Emulsion', hex: C.emulsion, role: 'primary', usage: 'The wordmark, headings, the tall and wide frames and the brand field.' },
    { name: 'Tungsten', hex: C.tungsten, role: 'accent', usage: 'The square frame and one highlight per layout; never body text.' },
    { name: 'Leader', hex: C.leader, role: 'paper', usage: 'Page backgrounds, and the mark on Emulsion or Darkroom.' },
    { name: 'Darkroom', hex: C.darkroom, role: 'dark', usage: 'Dark pages and the dark-mode ground.' },
    { name: 'Wash', hex: C.wash, role: 'support', usage: 'Panels, rules and quiet backgrounds.' },
  ],
  type: { display: { family: 'Familjen Grotesk', weight: 700 }, text: { family: 'Inter', weight: 400 } },
  logos: {
    mark: { file: 'mark.svg', dark: 'mark-dark.svg', minWidth: 24 },
    horizontal: { file: 'logo-horizontal.svg', dark: 'logo-horizontal-dark.svg', minWidth: 120 },
    stacked: { file: 'logo-stacked.svg', dark: 'logo-stacked-dark.svg', minWidth: 72 },
  },
  icon: { file: 'mark-dark.svg', background: C.emulsion, favicon: 'favicon.svg' },
  social: { background: C.leader },
  templates: { background: C.emulsion },
  direction: { words: ['crafted', 'cinematic', 'quick'], pairs: { tone: 'between', era: 'between', volume: 'between', finish: 'engineered' }, references: { like: [], avoid: ['purple-gradient play-button video tools'] }, lives: 'web', weirdness: 3 },
  legal: { owner: 'mtblck', contact: 'github.com/mtblck/reelwright' },
  clearSpace: 0.25,
  exports: 'all',
  out: 'dist',
}, null, 2) + '\n')
