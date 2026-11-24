# story.json

One file describes the whole video. `build.mjs` reads it from the run folder; paths in it are relative to that folder.

```json
{
  "brandJson": "brand/brand.json",
  "brand": {"primary": "#23443a", "url": "example.com"},
  "voice": {"voice": "af_heart", "speed": 1.0, "pronounce": {"SVG": "S V G"}},
  "music": {"mood": "bright", "volume": 0.2},
  "sfx": true,
  "scenes": [
    {"type": "title", "bg": "paper", "say": ["Meet Inlay.", "It traces images into vector shapes that fit together."]}
  ]
}
```

## Top level

| Field | What it does |
|---|---|
| `brandJson` | A brand-kit `brand.json`. Colours by role (`primary`, `accent`, `paper`, `dark`, `support`, `ink`), `type.display` and `type.text`, and `logos.mark` (`file`, `dark`) for the mark on light and dark scenes. |
| `brand` | Overrides, or the whole brand when there's no `brand.json`: `name`, `tagline`, `url`, `paper` (light background), `ink` (text on paper), `primary` (brand field, buttons on paper), `accent` (highlights, one per scene), `dark` (dark scene background), `display` and `text` (`{"family": "<Google Font>", "weight": 700}`), `mark` and `markDark` (square SVG or PNG), `radius` (card corners in px at 1080). |
| `look` | The style over the whole video, on the brand's colours and fonts: `clean` (default: flat colour, `slide` cuts), `film` (grain, a soft vignette, a little gate weave and flicker, `splice` cuts) or `terminal` (JetBrains Mono in place of the brand's fonts, scanlines, words that type on behind a block cursor with a soft glow, hard `cut`s; good for CLIs and dev tools). A look sets the default `enter`; a scene's own `enter` still wins. Film MP4s are about 3 times the size of clean ones (grain doesn't compress); the GIF is made from a pass without the look's layers so it stays small. |
| `voice` | `voice` (Kokoro voice id, default `af_heart`), `speed` (default 1), `pronounce` (`{"written": "spoken"}`, whole words, case-insensitive). |
| `music` | `mood` (`bright` 112 bpm, `calm` 88 bpm, `tech` 120 bpm minor), `volume` (default 0.22; it dips to a third under the voice), `bpm`, `key` (`C` to `B`), `seed` (another arrangement of the same mood), or `file` for your own track (add its `bpm` to sync cuts to it). `false` for none. |
| `sfx` | `false` turns the sound effects off. |
| `beatSync` | Cuts land on the music's beats and the video ends on a bar line (default on). Each cut moves to the nearest beat, or the next one if the nearest would clip the scene's last word; phrases keep their place against their reveals. `false` keeps the voice-only timing. With your own `music.file`, set `music.bpm` to turn it on (the track's first beat must be at 0 s). |
| `scenes` | In order. Each has `type`, `say` and that type's props, plus `bg` (`paper`, `dark`, `brand`), `enter` (`cut`, `slide`, `fade`, `zoom`, `splice`: a wipe behind a bar of the accent colour, `push`: the new scene shoves the old one off, `mask`: the new scene opens through a growing shape; default after the first: the look's (`slide` for `clean`, `splice` for `film`, `cut` for `terminal`); with options as `{"type": "push", "direction": "up"}`, push's direction `left` (default), `right`, `up` or `down`; mask's `shape` `mark` (the brand mark, default), `frame` (with `aspect` `9:16`, `1:1` or `16:9`) or `iris`) and `hold` (extra seconds). |

`*stars*` around words in on-screen text set them in the accent colour.

## Scenes and their reveals

Each phrase in `say` starts the next reveal. Give a scene as many phrases as it has reveals (extra phrases just keep talking; fewer leave later reveals on the last phrase).

| type | Props | Reveals, one per phrase |
|---|---|---|
| `statement` | `text`*, `kicker` | 1: the text, word by word |
| `title` | `name` (default brand name), `tagline` (default brand tagline) | 1: mark and name; 2: tagline |
| `screen` | `image` or `video`*, `frame` (`phone` or `browser`), `caption`*, `url` (browser bar), `zoom` (`[from, to]` for a slow push on an image), `position` (CSS `object-position`) | 1: device rises in and the caption types on |
| `features` | `title`*, `items`* (2 to 4 short lines) | 1: title; 2, 3, 4...: each item with a tick |
| `steps` | `title`, `steps`* (2 to 4) | 1: title (if any); then each step |
| `stat` | `value`* (`"1.3 s"`, `"12,000+"`, `"0"`), `label`* | 1: the number counts up; 2: the label |
| `kinetic` | `words`* (one short line each, `*stars*` allowed), `colors` (per word: `dark`, `paper`, `brand`, `accent`; default the scene's `bg`), `stack` (keep earlier words, dimmed, and use the first colour) | 1, 2, 3...: each word slams in, replacing the last (or under it, with `stack`) |
| `reframe` | `shapes`* (2 to 3 of `{aspect: "9:16" \| "1:1" \| "16:9", video \| image, label}`), `caption`, `assemble` (default true) | 1, 2, 3: the frame snaps to each shape with its clip and label; then one more: the frames' outlines meet on one centre (Reelwright's mark) and the caption types on |
| `end` | `button`*, `url` (default brand url) | 1: mark, name and button; 2: the button is pressed and the URL appears |

Screen captures: a phone clip from `capture.mjs --device phone --clip` fits the `phone` frame; a desktop screenshot fits `browser`. Videos play muted.

## Templates

**App launch** (25 to 35 s): `statement` the problem (dark) → `title` meet it → `screen` it doing the job (dark) → `features` three reasons → `stat` one proof (dark) → `end`.

**Feature demo** (20 to 25 s): `statement` the new thing (dark, kicker "New") → `screen` before or the old way → `screen` the feature (dark) → `end` "Try it".

**Tool explainer** (20 to 30 s): `title` → `steps` input, what it does, output → `screen` the result (dark) → `end`.

**Hype** (20 to 30 s): `kinetic` the hook (two words, the second on `accent`) → `title` (enter `splice`) → `screen` it at work → `kinetic` with `stack`, three one-word beats → `reframe` or `stat` → `end`.

Short beats long: a 20-second video people finish beats a 40-second one they don't.
