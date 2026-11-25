# Changelog

What changed in Reelwright, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/). The version is `version` in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json); installed copies only update when it changes.

A pull request that changes the plugin adds its lines under **Unreleased**. A release moves them under the new
version with the date and bumps `plugin.json` to match.

## [Unreleased]

### Added

- `brand.mjs` reads the brand from a live site or running app when there's no brand kit: colours by role from its
  CSS (adjusted so text stays readable), its fonts (or the closest Google Fonts), its icon as the mark and its header
  logo, with a swatch sheet to check. The build uses it whenever the story has no `brandJson`
  ([#65](https://github.com/mtblck/reelwright/pull/65)).
- A `portrait` cut, 1080 × 1350 (4:5), for Instagram and LinkedIn feeds: `render.mjs --formats portrait`. It lays
  out like square with room to spare and has captions on by default; `4:5` also works as a `reframe` shape and a
  `mask` frame ([#68](https://github.com/mtblck/reelwright/pull/68)).
- A `chart` scene: bars or a line that grow one group per phrase, each value counting up, the highlighted bar or
  point in the accent, with an optional `source` line. In the `terminal` look the bars print as block characters
  ([#69](https://github.com/mtblck/reelwright/pull/69)).
- Named targets: a `box` step in capture.mjs records where an element sits on a screenshot, and `cursor` and
  `zoom-pan` `focus` can name it (`"cursor": ["Export button"]`) instead of giving coordinates
  ([#67](https://github.com/mtblck/reelwright/pull/67)).
- Subtitle files: every cut gets `.srt` and `.vtt` beside its MP4, timed to the voice and spelled as written, and
  the landscape cut gets `<name>-chapters.txt` with YouTube chapter marks (a scene's `chapter` names it)
  ([#66](https://github.com/mtblck/reelwright/pull/66)).
- `brand.logo` and `logoDark`: a wide logo on `title` and `end` in place of the mark and name
  ([#65](https://github.com/mtblck/reelwright/pull/65)).

### Fixed

- In square and portrait cuts, a `reframe` scene's label and caption sat under the burned-in captions; they now sit
  above them ([#68](https://github.com/mtblck/reelwright/pull/68)).

## [0.2.0] - 2026-11-24

### Added

- Short cuts: `build.mjs --length 6` or `15` makes a bumper or short ad from the same story, keeping the scenes
  marked `keep`, and `render.mjs --length` renders it. `render.mjs stills --safe tiktok` (or `reels`, `shorts`)
  shades where the app's buttons cover a vertical video. `render.mjs loop` makes a silent seamless loop (MP4, WebM
  and a GIF under 5 MB) for a README or landing page ([#52](https://github.com/mtblck/reelwright/pull/52)).
- `match` way in: a match cut. The old scene's main shape (a device, window, frame, viewport or the mark) moves and
  reshapes onto the new scene's, measured from the page so it lands exactly ([#51](https://github.com/mtblck/reelwright/pull/51)).
- Five looks: `poster` (capitals, a slab of colour, huge cropped scene numbers, hard cuts), `blueprint` (grid paper,
  crop marks and a dimension line drawn on), `paper` (12 fps stop motion, paper grain, a torn edge), `sketch` (boiling
  lines, marker scribbles under starred words) and `isometric` (devices and cards tilted in 3D)
  ([#50](https://github.com/mtblck/reelwright/pull/50)).
- Trailer moves: `accelerate` on `kinetic` makes each beat land quicker than the last, `stinger` on `end` adds a
  last line after a beat of dark, and `"music": {"end": "tapestop"}` stops the bed like a tape instead of fading it.
  The story templates now open cold, with the hook before the title.
- Three music moods: `lofi` (swung, with tape crackle), `cinematic` (no kit; a low boom, an ostinato and a build)
  and `minimal` (a kick, a held bass and a sparse arpeggio).
- Sound effects, all synthesised and quiet: a sub drop under the `title`, a riser into a `reframe`, and a hit on a
  stinger ([#49](https://github.com/mtblck/reelwright/pull/49)).
- Proof scenes: `before-after` (a slider from one picture or clip to the other), `quote` (a real comment and who
  said it), `compare` (the old way and the new, row by row), `logo-wall` (what it works with, a group per phrase) and
  `diagram` (in, the tool, out, drawn box by box). The README scene grid shows all 18
  ([#48](https://github.com/mtblck/reelwright/pull/48)).
- `zoom-pan` scene: a camera over one screenshot that eases to a new part of it on each phrase, never enlarging
  past the point where small text goes soft. A `cursor` on `zoom-pan` and `screen` glides to one target per
  phrase and clicks it with a ripple and a click sound ([#47](https://github.com/mtblck/reelwright/pull/47)).
- Burned-in captions, on by default in the vertical and square cuts: a few words at a time, low in the frame and
  inside the TikTok, Reels and Shorts safe zones, with the word being said lit in the accent. `"captions"` in
  `story.json` turns them on for every cut, off, or picks the cuts; a scene can opt out
  ([#46](https://github.com/mtblck/reelwright/pull/46)).
- `whip` way in: a fast pan with a directional motion smear and a whoosh (`direction` as `push`). `glitch` way in:
  a 4-frame hit that splits the colour channels and jolts bands of the picture sideways, with its own short sound;
  meant for once per video ([#45](https://github.com/mtblck/reelwright/pull/45)).
- `terminal` and `code` scenes, for projects with no app to film. `terminal` types a command, prints its output and
  lights one line; `scripts/term.mjs` records a real run for it. `code` shows lines from a file in the repo with line
  numbers and light syntax colours, then lights one range per phrase; `+ `/`- ` lines show as a diff. Both set text in
  JetBrains Mono (or the look's mono face) inside a dark window ([#44](https://github.com/mtblck/reelwright/pull/44)).
- `terminal` look: JetBrains Mono in place of the brand's fonts (set at 72%, since a mono face runs wider), scanlines, and words that type on behind a block
  cursor with a soft phosphor glow (in `statement`, `kinetic` and every caption), with hard cuts. `kinetic` becomes
  left-aligned lines behind a `>` prompt, and `stat` prints its number with the label as a `#` comment. For CLIs and dev
  tools ([#43](https://github.com/mtblck/reelwright/pull/43)).
- Looks: `"look"` in `story.json` re-skins the whole video without changing the story. `clean` is the default and
  looks as before. `film` adds grain, a soft vignette, a little gate weave and flicker, and cuts with `splice`.
  Film MP4s are about 3 times bigger; the GIF is rendered from a pass without the look's layers so it stays under
  5 MB ([#42](https://github.com/mtblck/reelwright/pull/42)).
- Cuts land on the music's beat, and the video ends on a bar line so the last chord meets the end card. Whole scenes
  move, so each phrase keeps its place against its reveal. `"beatSync": false` turns it off; a custom `music.file`
  opts in with `music.bpm` ([#39](https://github.com/mtblck/reelwright/pull/39)).
- `mask` way in: the new scene opens through the brand's own mark, an aspect frame edged in the accent, or a circle,
  growing from the centre while the old scene pushes in and darkens, with no sound effect, e.g. `"enter": {"type": "mask", "shape": "frame",
  "aspect": "16:9"}` ([#41](https://github.com/mtblck/reelwright/pull/41)).
- `push` way in: the new scene shoves the old one off, in any of four directions with
  `"enter": {"type": "push", "direction": "up"}` ([#40](https://github.com/mtblck/reelwright/pull/40)).

### Changed

- Captions in the vertical cut sit a little higher and narrower, clear of TikTok's caption and button rail
  ([#52](https://github.com/mtblck/reelwright/pull/52)).
- `kinetic` lines are sized to fit on one line, and a `stack` is laid out from its first frame, so earlier lines
  no longer jump up as each new one arrives ([#43](https://github.com/mtblck/reelwright/pull/43)).
- Transitions have two sides: the scene going out can move too, not only the one coming in. Each way in is one
  entry in `template/src/transitions.tsx` ([#40](https://github.com/mtblck/reelwright/pull/40)).
- The README has a new look: the logo in light and dark, Reelwright's own promo reel as the hero, the three cuts,
  a still of every scene type and what each output is for. Its images live in `.github/readme/`, with a social
  preview image for the repo page.

## [0.1.0] - 2026-11-24

The first release ([#1](https://github.com/mtblck/reelwright/pull/1)).

### Added

- The `reelwright` skill: short promo videos for a project from its repo and its brand, in square (1080 × 1080),
  vertical (1080 × 1920) and landscape (1920 × 1080), plus a GIF and a poster frame.
- Seven scene types: `statement`, `title`, `screen` (a phone or browser frame), `features`, `steps`, `stat` and `end`,
  with `cut`, `slide`, `fade` and `zoom` ways in.
- A [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) voiceover voiced one phrase at a time, with every reveal on
  screen timed to the start of its phrase.
- `music.mjs`: a music bed written to the video's exact length, in `bright`, `calm` and `tech` moods.
- Sound effects made by `make-sfx.sh` (whoosh, tick, click, chime, rise), MIT and CC0.
- `capture.mjs`: screenshots and a screen clip of the running app with Playwright.
- Loudness normalised to -14 LUFS, and a stills contact sheet to check before the full render.
- Themes from a [brand-kit](https://github.com/mtblck/brand-kit) `brand.json`.
- The Inlay launch story as a worked example in `examples/inlay/`.
- `kinetic` scene: huge words that slam in one per phrase (scale, blur and a flash of the accent), each on its own
  colour or stacking with the earlier words dimmed ([#3](https://github.com/mtblck/reelwright/pull/3)).
- `reframe` scene: one frame snaps between 9:16, 1:1 and 16:9 with a clip or image and a label in each, then draws
  the three outlines onto one centre with a caption ([#3](https://github.com/mtblck/reelwright/pull/3)).
- `splice` way in: the next scene wipes in behind a bar of the accent colour
  ([#3](https://github.com/mtblck/reelwright/pull/3)).
- A **Hype** story template for the new moves ([#3](https://github.com/mtblck/reelwright/pull/3)).
- Reelwright's own brand kit in `brand/`: the three-cuts mark, Familjen Grotesk and Inter, the Emulsion, Tungsten,
  Leader, Darkroom and Wash palette, logos, icons, guidelines, web tokens and templates. The brand is not under the
  MIT licence ([#2](https://github.com/mtblck/reelwright/pull/2)).

### Changed

- Sound effects are quieter: the whoosh on `slide`, `zoom` and `splice` cuts plays at half volume, and the pop is
  gone from kinetic words and everywhere else, because both were too loud on headphones
  ([#3](https://github.com/mtblck/reelwright/pull/3)).

### Fixed

- In square cuts, a `screen` scene with a phone frame ran past the bottom of the 1080 px frame. The phone now sits
  beside its caption, as it does in landscape ([#3](https://github.com/mtblck/reelwright/pull/3)).

[Unreleased]: https://github.com/mtblck/reelwright/compare/0d4ba92...HEAD
[0.2.0]: https://github.com/mtblck/reelwright/compare/5bfc62c...0d4ba92
[0.1.0]: https://github.com/mtblck/reelwright/commit/5bfc62c
