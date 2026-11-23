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
| `voice` | `voice` (Kokoro voice id, default `af_heart`), `speed` (default 1), `pronounce` (`{"written": "spoken"}`, whole words, case-insensitive). |
| `music` | `mood` (`bright` 112 bpm, `calm` 88 bpm, `tech` 120 bpm minor), `volume` (default 0.22; it dips to a third under the voice), `bpm`, `key` (`C` to `B`), `seed` (another arrangement of the same mood), or `file` for your own track. `false` for none. |
| `sfx` | `false` turns the sound effects off. |
| `scenes` | In order. Each has `type`, `say` and that type's props, plus `bg` (`paper`, `dark`, `brand`), `enter` (`cut`, `slide`, `fade`, `zoom`; default `slide` after the first) and `hold` (extra seconds). |

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
| `end` | `button`*, `url` (default brand url) | 1: mark, name and button; 2: the button is pressed and the URL appears |

Screen captures: a phone clip from `capture.mjs --device phone --clip` fits the `phone` frame; a desktop screenshot fits `browser`. Videos play muted.

## Templates

**App launch** (25 to 35 s): `statement` the problem (dark) → `title` meet it → `screen` it doing the job (dark) → `features` three reasons → `stat` one proof (dark) → `end`.

**Feature demo** (20 to 25 s): `statement` the new thing (dark, kicker "New") → `screen` before or the old way → `screen` the feature (dark) → `end` "Try it".

**Tool explainer** (20 to 30 s): `title` → `steps` input, what it does, output → `screen` the result (dark) → `end`.

Short beats long: a 20-second video people finish beats a 40-second one they don't.
