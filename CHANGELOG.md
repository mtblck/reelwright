# Changelog

What changed in Reelwright, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and versions follow [Semantic Versioning](https://semver.org/). The version is `version` in
[`.claude-plugin/plugin.json`](.claude-plugin/plugin.json); installed copies only update when it changes.

A pull request that changes the plugin adds its lines under **Unreleased**. A release moves them under the new
version with the date and bumps `plugin.json` to match.

## [Unreleased]

### Added

- Cuts land on the music's beat, and the video ends on a bar line so the last chord meets the end card. Whole scenes
  move, so each phrase keeps its place against its reveal. `"beatSync": false` turns it off; a custom `music.file`
  opts in with `music.bpm` ([#39](https://github.com/mtblck/reelwright/pull/39)).
- `mask` way in: the new scene opens through the brand's own mark, an aspect frame edged in the accent, or a circle,
  growing from the centre while the old scene pushes in and darkens, with no sound effect, e.g. `"enter": {"type": "mask", "shape": "frame",
  "aspect": "16:9"}` ([#41](https://github.com/mtblck/reelwright/pull/41)).
- `push` way in: the new scene shoves the old one off, in any of four directions with
  `"enter": {"type": "push", "direction": "up"}` ([#40](https://github.com/mtblck/reelwright/pull/40)).

### Changed

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

[Unreleased]: https://github.com/mtblck/reelwright/compare/5bfc62c...HEAD
[0.1.0]: https://github.com/mtblck/reelwright/commit/5bfc62c
