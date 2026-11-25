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
| `scripts/term.mjs` | `node <skill>/scripts/term.mjs <run>/media/term.json [--cwd <dir>] [--show "cmd as typed"] -- <cmd> <args...>`: runs a command and records its real output (colours stripped, 40 lines at most) for a `terminal` scene's `transcript`. |
| `scripts/build.mjs` | `node <skill>/scripts/build.mjs <run>`: reads `<run>/story.json`, voices each phrase, lays out the timeline, writes the voice track, fonts, sound effects and music into `<run>/public/` and `<run>/props.json`. Prints the timeline. |
| `scripts/brand.mjs` | `node <skill>/scripts/brand.mjs <url> <run>`: the brand from a live site when there's no brand kit; writes `<run>/site-brand.json` and a swatch to check. |
| `scripts/render.mjs` | `node <skill>/scripts/render.mjs <run> stills [--format square]` for a contact sheet; `check [--formats square,vertical]` measures text size, contrast, safe zones and reading time, and checks the MP4s already rendered; `node <skill>/scripts/render.mjs <run> [--formats square,vertical,portrait,landscape]` for the videos, GIF and poster; `stills --format vertical --safe tiktok` (or `reels`, `shorts`) shades where the app's buttons cover; `loop` for a silent seamless loop; `--length 6` renders a short cut. |
| `scripts/music.mjs` | Writes the music bed (called by `build.mjs`). Moods `bright`, `calm`, `tech`. |
| `references/story.md` | The `story.json` schema, every scene type and its props, and the story templates. Read it before writing a story. |
| `examples/inlay/` | A finished story for Inlay (an image tracer) with its brand and screen clip. Copy it to start. |

## Steps

### 1. Gather

From the repo: the README (what it is, who it's for, the one-line pitch), the site or app's own copy, real numbers (speed, size, counts, ratings) and the brand. A brand-kit `brand.json` (often `brand/brand.json`) gives colours, fonts and marks in one go: point `story.brandJson` at it. Most projects have none; then read the brand from the live site or the running app:

```bash
node <skill>/scripts/brand.mjs https://example.com <run>
```

It writes `<run>/site-brand.json`, which the build uses whenever the story has no `brandJson`: paper, ink, primary, accent and dark picked from the CSS by where they're used (and darkened where text wouldn't read on them), the heading and body faces (mapped to the closest Google Font when they aren't one), the favicon or app icon as the mark, and a wide header logo for title and end. Open `<run>/site-brand/swatch.png` and read the notes it prints: fix anything wrong with `story.brand`, which wins over both.

Real screens beat everything else. Build and start the project the way its README says, then capture it:

```bash
node <skill>/scripts/capture.mjs http://localhost:5173/ <run>/media --device phone --steps <run>/steps.json --clip
```

Steps are clicks, typing, drags and waits that show the product doing its one job (load a sample, run it, show the result). Add a `box` step for each button or panel a cursor will click or the camera will zoom to, so the story can name it instead of guessing coordinates (see Cursor in `references/story.md`). Keep the clip under 8 seconds of action. Read the screenshots (open the PNGs) to check they show the right thing.

**Gate:** you can say, in one sentence each, what it is, who it's for, the problem, what it does about it, one proof point, and the call to action with its URL. You have at least one real screen.

### 2. Story

Write `<run>/story.json` from a template in `references/story.md` (app launch, feature demo, tool explainer). Rules:
- **Words from the project.** Reuse the README's and site's own phrases. Invent nothing that sounds like a fact: no made-up numbers, users or quotes.
- **60 to 90 spoken words** in total, which comes out at 20 to 35 seconds. One idea per scene.
- **`say` is a list of phrases.** Each phrase is voiced on its own and starts the scene's next reveal: the title's name on phrase 1 and tagline on phrase 2, each feature item on its own phrase, the end button press on phrase 2. Count reveals against phrases (`references/story.md` lists them per scene).
- **On-screen text is shorter than the voice.** The screen says "Every edge is traced *once*." while the voice says the whole sentence. Mark one or two words per scene with `*stars*` for the accent colour.
- **Pronunciation:** add `voice.pronounce` for names, acronyms and URLs ("SVG": "S V G", "inlaytrace.com": "inlay trace dot com"). On-screen text is unchanged.
- **Language:** if the person wants the video in another language, set `voice.lang` (`es`, `fr`, `it`, `pt-br`, `hi`, `ja`, `zh`) and write every line in it. If they'd rather use their own voice, ask them to record one file per phrase and set `voice.files` (story reference: Languages and recordings).
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

Read `<run>/stills/sheet.png` (one frame per scene, after its last reveal). Check: no text cut off or crowding the edges, starred words make sense, screens show the right thing, colours readable. Then let the script measure it, for the cuts you'll render:

```bash
node <skill>/scripts/render.mjs <run> check --formats square,vertical,landscape
```

It lists each problem with its cut and scene, and exits 1 while any line starts `FIX`:

```
FIX   vertical  scene 5 (diagram)      "story, voice, music" is 28 px; the vertical cut needs 30 or more
FIX   square    scene 4 (kinetic)      "Synced." has contrast 2.7:1 against its background; it needs 3:1 at this size
look  vertical  scene 5 (reframe)      "cuts." sits where tiktok, reels, shorts put their buttons or caption
look  all       scene 3 (compare)      31 words on screen for 5.1 s; give it about 8.8 s ("hold": 3.7) or fewer words
2 to fix, 2 to look at
```

`FIX`: text under the cut's smallest size (30 px vertical, 26 square and portrait, 22 landscape, at 1080 on the short side), under WCAG contrast (4.5:1, or 3:1 from 40 px up; faded and dimmed words are left out), or off the frame. `look`: words where a vertical app's buttons sit, or a scene too short to read (a second plus 4 words a second from its first reveal). Fix with shorter words, another `bg`, `hold`, or a different scene, rebuild, and check again until nothing is left to fix. Then:

```bash
node <skill>/scripts/render.mjs <run> --formats square,vertical,landscape
```

Square and vertical are the social cuts and come first; landscape is for the web (and Google Play, which takes a YouTube link to it). Add `portrait` (1080 × 1350, 4:5) for Instagram and LinkedIn feeds, where it fills more of the screen than square; it lays out like square, with room to spare. For an app's App Store page, add `appstore` (886 × 1920, iPhone) and `appstore-ipad` (1200 × 1600): previews must run 15 to 30 s (render.mjs refuses otherwise; a 30 s-plus story renders with `--length 15`), have no burned-in captions, and are encoded to Apple's spec (H.264 High 4.0, 30 fps, stereo AAC 256k), which the render then checks. Show the app itself: Apple wants previews to be mostly real footage of the app, so lean on `screen` (phone or `tablet` frame) and `zoom-pan` scenes. Each cut takes 40 to 60 seconds. Read the `qa-<format>.png` sheets (a frame a second).

**Gate:** `check` found nothing to fix; every MP4 exists at -14 LUFS (the render checks each one decodes, has every frame and no black frames, and exits 1 if not); the QA sheets show every scene with nothing cut off; and `<name>.gif` is under 5 MB (else render the GIF from a shorter story or drop it).

**Optional extras.** A 6 s bumper or 15 s ad: `build.mjs <run> --length 6` then `render.mjs <run> --length 6` (see Short cuts in the story reference). A loop for a README or landing page: `render.mjs <run> loop [--format landscape] [--seconds 5] [--scene n]` makes `<name>-loop.mp4`, `.webm` and `.gif` (under 5 MB), silent, from inside one scene (the longest middle one by default) with the end faded into the start so it never jumps. Before posting a vertical cut, `stills --format vertical --safe tiktok` shades where TikTok's buttons and caption sit (`reels`, `shorts` for the others): keep words out of the shading.

### 5. Deliver

Give the paths: `<name>-square.mp4`, `-vertical.mp4`, `-landscape.mp4`, `<name>.gif`, `<name>-poster.png`, and the subtitle files beside each MP4 (`.srt`, `.vtt`: upload them with the video) and `<name>-chapters.txt` when render.mjs wrote one (only for a landscape cut long enough for three chapters). Say its length, which story template you used, and anything you weren't sure of (a number, a pronunciation). The music and sound effects are generated by the skill, so there is nothing to credit.

## Notes

- Remotion is free for individuals and companies of up to 3 people; bigger companies need a licence (remotion.dev/license).
- Kokoro voices: `af_heart` (default), `af_bella`, `am_michael`, `am_fenrir`, `bf_emma`, `bm_george` and more; `voice.speed` 0.9 to 1.1.
- To change the look for every video, edit `template/src/scenes.tsx` (layouts), `template/src/ui.tsx` (motion, colours) `template/src/transitions.tsx` (ways in and out; add a name there and to `WAYS` in `build.mjs`) and `template/src/looks.tsx` (looks; add a name there and to `LOOKS` in `build.mjs`). Each scene lays itself out from the frame size, so check all three shapes after a change.
- The skill runs on the default network of Claude's cloud sessions: npm, PyPI, GitHub releases and Google Fonts. It uses the Chromium already installed there.
