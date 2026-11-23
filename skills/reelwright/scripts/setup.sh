#!/usr/bin/env bash
# One-time setup, cached in ~/.cache/reelwright (about 700 MB). Safe to re-run: finished parts are skipped.
#   bash setup.sh            prints the paths render.mjs and build.mjs use, as KEY=value lines
# Needs Node 20+, FFmpeg and Python 3.9+. In Claude's cloud sessions all three are preinstalled.
set -euo pipefail
SKILL="$(cd "$(dirname "$0")/.." && pwd)"
VER="$(node -p "require('$SKILL/template/package.json').dependencies.remotion")"
CACHE="${REELWRIGHT_CACHE:-$HOME/.cache/reelwright}"
TPL="$CACHE/template-$VER"
mkdir -p "$CACHE"

command -v ffmpeg >/dev/null || { echo "! FFmpeg is required (macOS: brew install ffmpeg; Ubuntu: sudo apt install ffmpeg)" >&2; exit 1; }

# 1. Remotion, in a cached copy of the template (the skill folder itself may be read-only)
if [ ! -d "$TPL/node_modules/remotion" ]; then
  echo "> Remotion $VER" >&2
  rm -rf "$TPL" && mkdir -p "$TPL"
  cp -R "$SKILL/template/." "$TPL/"
  rm -rf "$TPL/node_modules"
  (cd "$TPL" && npm ci --no-audit --no-fund --loglevel=error >&2)
fi
# the scene code is always copied fresh, so edits to the skill show up without a reinstall
rm -rf "$TPL/src" && cp -R "$SKILL/template/src" "$TPL/src"

# 2. A headless Chrome for Remotion: use one already on the machine, else let Remotion fetch its own
BROWSER="${REELWRIGHT_BROWSER:-}"
if [ -z "$BROWSER" ]; then
  for b in /opt/pw-browsers/chromium_headless_shell-*/chrome-headless-shell-linux64/chrome-headless-shell; do
    [ -x "$b" ] && BROWSER="$b"
  done
fi
if [ -z "$BROWSER" ]; then
  (cd "$TPL" && npx remotion browser ensure >&2)
fi

# 3. Kokoro voice: kokoro-onnx (PyPI) and its model files (GitHub release), no PyTorch
VENV="$CACHE/venv"
if [ ! -x "$VENV/bin/python" ] || ! "$VENV/bin/python" -c "import kokoro_onnx, soundfile" 2>/dev/null; then
  echo "> Kokoro voice (kokoro-onnx)" >&2
  if command -v uv >/dev/null; then
    uv venv -q --allow-existing "$VENV" >&2
    uv pip install -q --python "$VENV/bin/python" "kokoro-onnx==0.6.1" "soundfile==0.14.0" >&2
  else
    python3 -m venv "$VENV"
    "$VENV/bin/pip" install -q "kokoro-onnx==0.6.1" "soundfile==0.14.0" >&2
  fi
fi
MODELS="$CACHE/kokoro"
mkdir -p "$MODELS"
REL="https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0"
for f in kokoro-v1.0.int8.onnx voices-v1.0.bin; do
  if [ ! -s "$MODELS/$f" ]; then
    echo "> $f" >&2
    curl -fsSL --retry 3 -o "$MODELS/$f.part" "$REL/$f" && mv "$MODELS/$f.part" "$MODELS/$f"
  fi
done

echo "TEMPLATE=$TPL"
echo "BROWSER=$BROWSER"
echo "PYTHON=$VENV/bin/python"
echo "KOKORO_MODEL=$MODELS/kokoro-v1.0.int8.onnx"
echo "KOKORO_VOICES=$MODELS/voices-v1.0.bin"
