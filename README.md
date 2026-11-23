# Reelwright

Short promo videos for a project, made from its repo and its brand: square and vertical cuts for social, landscape for the web, a GIF for the README and a poster frame. A voiceover reads the story, and every reveal on screen lands on its line. The music bed is written to the video's length, and the sound effects come with the skill.

A Claude Code plugin. It runs in Claude's cloud sessions as they are, with no API keys and no setup beyond about 700 MB of cached downloads on first use.

## Install

From the [mtblck marketplace](https://github.com/mtblck/claude-marketplace):

```
/plugin marketplace add mtblck/claude-marketplace
/plugin install reelwright@mtblck
```

or on its own: `/plugin install reelwright --marketplace mtblck/reelwright`.

In a repo, add `"reelwright@mtblck": true` to `enabledPlugins` in `.claude/settings.json` so cloud sessions have it.

## Use

Ask for it: "make a launch video for this app", "a 20-second vertical for the new export feature", "a GIF for the README". Claude reads the repo, captures the running app, writes the story, checks a contact sheet and renders.

You get `<name>-square.mp4`, `<name>-vertical.mp4`, `<name>-landscape.mp4` (1080p, -14 LUFS), `<name>.gif` and `<name>-poster.png`.

## How it works

1. **Gather:** the README, the site's copy and the brand (a [brand-kit](https://github.com/mtblck/brand-kit) `brand.json` when there is one). `capture.mjs` takes screenshots and a screen clip of the running app with Playwright.
2. **Story:** five to seven scenes in `story.json`: statement, title, screen, features, steps, stat, end. Each scene's lines are a list of phrases.
3. **Build:** each phrase is voiced with [Kokoro](https://github.com/thewh1teagle/kokoro-onnx) on the CPU. The timeline puts each reveal where its phrase starts. `music.mjs` writes a bed to the exact length.
4. **Render:** [Remotion](https://www.remotion.dev/) renders all three shapes from the same scenes. FFmpeg normalises the loudness and makes the GIF.

| Needs | |
| --- | --- |
| Node 20+, FFmpeg, Python 3.9+ | Preinstalled in Claude's cloud sessions |
| Network on first run | npm, PyPI, GitHub releases, Google Fonts |
| Disk | About 700 MB in `~/.cache/reelwright` |

Remotion is free for individuals and companies of up to 3 people; larger companies need a [Remotion licence](https://www.remotion.dev/license). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## Example

`skills/reelwright/examples/inlay/` is the story behind Inlay's launch video:

```bash
cp -R skills/reelwright/examples/inlay /tmp/inlay-video
node skills/reelwright/scripts/build.mjs /tmp/inlay-video
node skills/reelwright/scripts/render.mjs /tmp/inlay-video --formats square,vertical,landscape
```

## License

MIT. The sound effects and generated music are also CC0, so videos need no credit.
