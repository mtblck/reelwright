---
name: reelwright
description: Make a 20 to 40 second promo or launch video for a project (app, tool, extension, skill, site) from its repo and brand - square and vertical for social, landscape for the web, plus a GIF and poster - with a Kokoro voiceover, reveals timed to each spoken phrase, a music bed written to the video's length and sound effects. Use when someone wants a promo, launch, demo, teaser or social video, a reel, a short, or an animated GIF for a README.
---

# reelwright

A short video built from what the project really is: its own screens, its own brand, its own words. Claude writes a story of five to seven scenes, each scene's lines are voiced separately, and every reveal on screen fires when its line starts. Remotion renders the scenes; FFmpeg mixes and normalises.

`<skill>` = this folder. `<run>` = a folder for this video, e.g. `<repo>/promo/<name>/` or a scratch folder. Nothing is written inside the skill.

## Files

| File | Use |
|---|---|
| `scripts/setup.sh` | One-time install into `~/.cache/reelwright` (Remotion, the Kokoro voice via kokoro-onnx, its model from GitHub). The other scripts run it themselves; skips what's done. |
| `scripts/capture.mjs` | `node <skill>/scripts/capture.mjs <url> <run>/media [--device phone\|desktop] [--steps steps.json] [--clip]`: screenshots and a screen clip of the running app, driven by a list of steps. |
| `scripts/build.mjs` | `node <skill>/scripts/build.mjs <run>`: reads `<run>/story.json`, voices each phrase, lays out the timeline, writes the voice track, fonts, sound effects and music into `<run>/public/` and `<run>/props.json`. Prints the timeline. |
| `scripts/render.mjs` | `node <skill>/scripts/render.mjs <run> stills [--format square]` for a contact sheet; `node <skill>/scripts/render.mjs <run> [--formats square,vertical,landscape]` for the videos, GIF and poster. |
| `scripts/music.mjs` | Writes the music bed (called by `build.mjs`). Moods `bright`, `calm`, `tech`. |
| `references/story.md` | The `story.json` schema, every scene type and its props, and the story templates. Read it before writing a story. |
| `examples/inlay/` | A finished story for Inlay (an image tracer) with its brand and screen clip. Copy it to start. |

## Steps

### 1. Gather

From the repo: the README (what it is, who it's for, the one-line pitch), the site or app's own copy, real numbers (speed, size, counts, ratings) and the brand. A brand-kit `brand.json` (often `brand/brand.json`) gives colours, fonts and marks in one go: point `story.brandJson` at it. Without one, set `story.brand` by hand from the site's CSS (see `references/story.md`).

Real screens beat everything else. Build and start the project the way its README says, then capture it:

```bash
node <skill>/scripts/capture.mjs http://localhost:5173/ <run>/media --device phone --steps <run>/steps.json --clip
```

Steps are clicks, typing, drags and waits that show the product doing its one job (load a sample, run it, show the result). Keep the clip under 8 seconds of action. Read the screenshots (open the PNGs) to check they show the right thing.

**Gate:** you can say, in one sentence each, what it is, who it's for, the problem, what it does about it, one proof point, and the call to action with its URL. You have at least one real screen.

### 2. Story

Write `<run>/story.json` from a template in `references/story.md` (app launch, feature demo, tool explainer). Rules:
- **Words from the project.** Reuse the README's and site's own phrases. Invent nothing that sounds like a fact: no made-up numbers, users or quotes.
- **60 to 90 spoken words** in total, which comes out at 20 to 35 seconds. One idea per scene.
- **`say` is a list of phrases.** Each phrase is voiced on its own and starts the scene's next reveal: the title's name on phrase 1 and tagline on phrase 2, each feature item on its own phrase, the end button press on phrase 2. Count reveals against phrases (`references/story.md` lists them per scene).
- **On-screen text is shorter than the voice.** The screen says "Every edge is traced *once*." while the voice says the whole sentence. Mark one or two words per scene with `*stars*` for the accent colour.
- **Pronunciation:** add `voice.pronounce` for names, acronyms and URLs ("SVG": "S V G", "inlaytrace.com": "inlay trace dot com"). On-screen text is unchanged.
- Alternate `bg` between `dark` and `paper` so cuts read as cuts; use `brand` for one moment at most.

### 3. Build

```bash
node <skill>/scripts/build.mjs <run>
```

The first run in a session installs into `~/.cache/reelwright` (under a minute). It prints the timeline: total 20 to 40 seconds. If it's long, cut words; don't speed up the voice. Re-run after any story edit; unchanged lines aren't voiced again.

### 4. Check, then render

```bash
node <skill>/scripts/render.mjs <run> stills --format vertical
```

Read `<run>/stills/sheet.png` (one frame per scene, after its last reveal). Check: no text cut off or crowding the edges, starred words make sense, screens show the right thing, colours readable. Fix the story and rebuild until it's right, then:

```bash
node <skill>/scripts/render.mjs <run> --formats square,vertical,landscape
```

Square and vertical are the social cuts and come first; landscape is for the web. Each takes 40 to 60 seconds. Read the `qa-<format>.png` sheets (a frame a second).

**Gate:** every MP4 exists at -14 LUFS, the QA sheets show every scene with nothing cut off, and `<name>.gif` is under 5 MB (else render the GIF from a shorter story or drop it).

### 5. Deliver

Give the paths: `<name>-square.mp4`, `-vertical.mp4`, `-landscape.mp4`, `<name>.gif`, `<name>-poster.png`. Say its length, which story template you used, and anything you weren't sure of (a number, a pronunciation). The music and sound effects are generated by the skill, so there is nothing to credit.

## Notes

- Remotion is free for individuals and companies of up to 3 people; bigger companies need a licence (remotion.dev/license).
- Kokoro voices: `af_heart` (default), `af_bella`, `am_michael`, `am_fenrir`, `bf_emma`, `bm_george` and more; `voice.speed` 0.9 to 1.1.
- To change the look for every video, edit `template/src/scenes.tsx` (layouts), `template/src/ui.tsx` (motion, colours) `template/src/transitions.tsx` (ways in and out; add a name there and to `WAYS` in `build.mjs`) and `template/src/looks.tsx` (looks; add a name there and to `LOOKS` in `build.mjs`). Each scene lays itself out from the frame size, so check all three shapes after a change.
- The skill runs on the default network of Claude's cloud sessions: npm, PyPI, GitHub releases and Google Fonts. It uses the Chromium already installed there.
