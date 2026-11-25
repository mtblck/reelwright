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
| `brand` | Overrides, or the whole brand when there's no `brand.json` (with neither, the build uses `<run>/site-brand.json` from `brand.mjs`, and `brand` overrides that): `name`, `tagline`, `url`, `paper` (light background), `ink` (text on paper), `primary` (brand field, buttons on paper), `accent` (highlights, one per scene), `dark` (dark scene background), `display` and `text` (`{"family": "<Google Font>", "weight": 700}`), `mark` and `markDark` (square SVG or PNG), `logo` and `logoDark` (a wide logo, shown on light or on dark and brand `title` and `end` scenes in place of the mark and name), `radius` (card corners in px at 1080). |
| `look` | The style over the whole video, on the brand's colours and fonts: `clean` (default: flat colour, `slide` cuts), `film` (grain, a soft vignette, a little gate weave and flicker, `splice` cuts), `terminal` (JetBrains Mono in place of the brand's fonts, scanlines, words that type on behind a block cursor with a soft glow, hard `cut`s; good for CLIs and dev tools), `poster` (capitals a size up, a slab of the brand colour along one edge, the scene's number huge and cropped in a corner, hard `cut`s; for hype cuts), `blueprint` (grid paper, crop marks and a dimension line drawn on at each scene, `fade`s; for libraries, infra and APIs), `paper` (stop motion at 12 frames a second with a little shake, paper grain and a torn paper edge round the frame), `sketch` (every line boils, starred words get a marker scribbled under them, `fade`s; `paper` and `sketch` suit playful brands and indie projects) or `isometric` (devices, windows and list cards tilted in 3D and drifting for depth, `zoom`s; for SaaS dashboards). A look sets the default `enter`; a scene's own `enter` still wins. Film, paper and sketch MP4s are 2 to 3 times the size of clean ones (grain and boil don't compress); the GIF is made from a pass without the look's layers so it stays small. |
| `voice` | `voice` (Kokoro voice id, default `af_heart`), `speed` (default 1), `pronounce` (`{"written": "spoken"}`, whole words, case-insensitive). |
| `music` | `mood` (`bright` 112 bpm, `calm` 88 bpm, `tech` 120 bpm minor, `lofi` 80 bpm swung with tape crackle, `cinematic` 72 bpm minor with no kit, an ostinato and a build, `minimal` 100 bpm with a kick, a held bass and a sparse arpeggio; `minimal` and `lofi` sit well under the `terminal` and `film` looks), `volume` (default 0.22; it dips to a third under the voice), `bpm`, `key` (`C` to `B`), `seed` (another arrangement of the same mood), `end` (`"tapestop"`: the bed slows to a stop on the last bar line instead of fading), or `file` for your own track (add its `bpm` to sync cuts to it). `false` for none. |
| `captions` | Burned-in captions: the line being spoken, a few words at a time, the word being said lit in the accent, inside the platform safe zones. On by default in the vertical and square cuts (feeds play muted), off in landscape. `true` for all three, `false` for none, or a list such as `["vertical"]`. A scene's own `"captions": false` leaves it uncaptioned (say, an end card whose words are already on screen). Word timings are estimated from each phrase's pauses and syllables. |
| `sfx` | `false` turns the sound effects off. Otherwise they're placed for you, all quiet under the voice: a whoosh on moving cuts, ticks on list items, a sub drop under the `title`, a riser into a `reframe`, a click and chime on the end button, a click for each cursor target, a hit on a stinger. |
| `beatSync` | Cuts land on the music's beats and the video ends on a bar line (default on). Each cut moves to the nearest beat, or the next one if the nearest would clip the scene's last word; phrases keep their place against their reveals. `false` keeps the voice-only timing. With your own `music.file`, set `music.bpm` to turn it on (the track's first beat must be at 0 s). |
| `scenes` | In order. Each has `type`, `say` and that type's props, plus `bg` (`paper`, `dark`, `brand`), `enter` (`cut`, `slide`, `fade`, `zoom`, `splice`: a wipe behind a bar of the accent colour, `push`: the new scene shoves the old one off, `mask`: the new scene opens through a growing shape; `whip`: a fast pan with a motion smear and a whoosh, `direction` as push; `match`: a match cut, the old scene's main shape (a device, window, frame, viewport or the mark on `title` and `end`) moves and reshapes onto the new scene's while the rest dips through the colours, e.g. `title` → `screen` → `zoom-pan`; scenes with no main shape get a plain dip; `glitch`: a 4-frame hit with the colours split and bands jolted sideways, best once per video and on a cut into a scene with words already on screen (`kinetic`, `statement`), good with the `terminal` look; default after the first: the look's (`slide` for `clean`, `splice` for `film`, `cut` for `terminal`); with options as `{"type": "push", "direction": "up"}`, push's direction `left` (default), `right`, `up` or `down`; mask's `shape` `mark` (the brand mark, default), `frame` (with `aspect` `9:16`, `1:1` or `16:9`) or `iris`) `hold` (extra seconds) and `keep` (`6` or `15`: the shortest cut the scene belongs in; see Short cuts below). |

`*stars*` around words in on-screen text set them in the accent colour.

## Scenes and their reveals

Each phrase in `say` starts the next reveal. Give a scene as many phrases as it has reveals (extra phrases just keep talking; fewer leave later reveals on the last phrase).

| type | Props | Reveals, one per phrase |
|---|---|---|
| `statement` | `text`*, `kicker` | 1: the text, word by word |
| `title` | `name` (default brand name), `tagline` (default brand tagline) | 1: mark and name; 2: tagline |
| `screen` | `image` or `video`*, `frame` (`phone` or `browser`), `caption`*, `url` (browser bar), `zoom` (`[from, to]` for a slow push on an image), `position` (CSS `object-position`), `cursor` | 1: device rises in and the caption types on |
| `zoom-pan` | `image`* (one screenshot, as large as you have), `focus` (one per phrase: `[x, y, w, h]` as fractions of the picture from its top left, or `null` for the whole picture), `caption`, `cursor` | 1: the picture rises in; each phrase: the camera eases to that phrase's focus. The camera never blows a pixel up past 1.25x, so small text stays sharp; take the screenshot at 2x. In the vertical cut a wide screenshot is cropped, so give every phrase a focus |
| `features` | `title`*, `items`* (2 to 4 short lines) | 1: title; 2, 3, 4...: each item with a tick |
| `steps` | `title`, `steps`* (2 to 4) | 1: title (if any); then each step |
| `stat` | `value`* (`"1.3 s"`, `"12,000+"`, `"0"`), `label`* | 1: the number counts up; 2: the label |
| `kinetic` | `words`* (one short line each, `*stars*` allowed), `colors` (per word: `dark`, `paper`, `brand`, `accent`; default the scene's `bg`), `stack` (keep earlier words, dimmed, and use the first colour), `accelerate` (each beat comes quicker than the last: shorter gaps and a slightly faster voice; for a run of three or four one-word beats) | 1, 2, 3...: each word slams in, replacing the last (or under it, with `stack`) |
| `reframe` | `shapes`* (2 to 3 of `{aspect: "9:16" \| "1:1" \| "16:9", video \| image, label}`), `caption`, `assemble` (default true) | 1, 2, 3: the frame snaps to each shape with its clip and label; then one more: the frames' outlines meet on one centre (Reelwright's mark) and the caption types on |
| `terminal` | `command`*, `output`* (lines, or one string with newlines; up to 14 shown), `highlight` (text in the output line to light), `prompt` (default `$`), `title` (default `Terminal`), `caption`, or `transcript` (a JSON file from `scripts/term.mjs`: a real run's `command` and `output`, which the story's own props override) | 1: the window rises and the command types on; 2: the output prints; 3: the highlighted line lights up and the rest dim |
| `code` | `code`*, or `file` (a path from the run folder, read by build.mjs) with `lines` (`[from, to]`, 1-based; up to 14); `highlights` (`[[from, to], ...]` in file line numbers, one per phrase after the first), `title` (default the file name), `caption`. Lines starting `+ ` or `- ` show as a diff | 1: the window rises and the lines print; 2, 3...: each highlight in turn, the other lines dimmed |
| `before-after` | `before`* and `after`* (pictures or clips of the same view, same size), `labels` (default `["Before", "After"]`), `caption`, `split` (stop the slider halfway), `position` | 1: the before rises in; 2: a slider sweeps across to the after |
| `quote` | `text`* (the real words, quoted exactly), `source`* (who: a name or handle), `detail` (where: "on GitHub", "issue #12"), `avatar` | 1: the quote; 2: who said it |
| `compare` | `rows`* (2 to 4 `[old, new]` pairs), `title`, `headers` (default `["Before", "With <name>"]`) | 1: the title, headers and first row; then one row per phrase |
| `logo-wall` | `logos`* (4 to 12 `{"image", "name"}`; without an image the name shows), `title` | the logos come in one group per phrase |
| `diagram` | `nodes`* (2 to 4: `"label"` or `{"label", "sub"}`; what goes in, the tool, what comes out), `focus` (the node in the accent, default the middle one), `caption` | 1: the first node; then each phrase draws an arrow and the next node |
| `end` | `button`*, `url` (default brand url), `stinger` (one short line after the card: a cut to dark, a beat of silence, then the line slams in with a hit; adds 1.7 s, and the music ends before it) | 1: mark, name and button; 2: the button is pressed and the URL appears |

Screen captures: a phone clip from `capture.mjs --device phone --clip` fits the `phone` frame; a desktop screenshot fits `browser`. Videos play muted.

**Proof is real.** A `quote` is someone's actual words, copied exactly, with where they said it (an issue, a review, a post); a `stat` or `compare` row is a number or fact you can point to in the repo, its README or `gh api` (stars, downloads, benchmark output). If there's nothing real to quote, leave the scene out; never write a testimonial.

**Cursor** (`screen` and `zoom-pan`): `cursor` is one target per phrase, `[x, y]` as fractions of the picture, or `null` for none. The cursor glides in from the lower right to each target as its phrase starts and clicks it (with a ripple and a click) two-thirds of a second later. It follows the picture as the camera moves. Find targets by opening the screenshot and measuring: a button at 1195, 598 in a 2000 x 1250 picture is `[0.6, 0.48]`.
## Short cuts

`node build.mjs <run> --length 6` (or `15`) builds a bumper or a short ad from the same story, beside the full one,
and `node render.mjs <run> --length 6` renders it as `<name>-6s-<format>.mp4`. A scene marked `"keep": 6` is in both
short cuts, `"keep": 15` only in the 15 s one; unmarked scenes are left out. With no `keep` anywhere, the 6 s cut is
the first scene and the end card, and the 15 s cut adds the `title`. The cut always ends on the end card, opens on a
hard cut, and the 6 s one drops any stinger. Phrases keep their full length, so mark short scenes: build warns when
the cut runs well over.

## Templates

**Open cold.** The first 1.5 seconds are the hook (the problem, a bold claim or two kinetic words), before any logo; the `title` comes second. People decide whether to keep watching before they know whose video it is.

**App launch** (25 to 35 s): `statement` the problem (dark) → `title` meet it → `screen` it doing the job (dark) → `features` three reasons → `stat` one proof (dark) → `end`.

**Feature demo** (20 to 25 s): `statement` the new thing (dark, kicker "New") → `screen` before or the old way → `screen` the feature (dark) → `end` "Try it".

**Tool explainer** (20 to 30 s): `statement` the job it does (dark) → `title` → `steps` input, what it does, output → `screen` the result (dark) → `end`.

**Dev tool** (20 to 30 s, no app to film): `statement` the pain (dark) → `terminal` a real run, the line that matters highlighted → `code` the few lines that make it work (dark) → `stat` or `features` → `end`. Pairs with the `terminal` look.

**Hype** (20 to 30 s): `kinetic` the hook (two words, the second on `accent`) → `title` (enter `splice`) → `screen` it at work → `kinetic` with `stack` and `accelerate`, three or four one-word beats → `reframe` or `stat` → `end`, with a `stinger` if there's a good last line. Try `"music": {"end": "tapestop"}`.

Short beats long: a 20-second video people finish beats a 40-second one they don't.
