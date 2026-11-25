"""Voice every phrase with Kokoro (kokoro-onnx), one WAV per phrase, cached by text and voice.

Usage: python voice.py <lines.json> <out_dir> <model.onnx> <voices.bin>
lines.json: {"voice": "af_heart", "lang": "en-us", "speed": 1.0, "lines": [{"id": "s0p0", "text": "...", "speed"?: 1.1}]}
A line with "file" instead of "text" is a recording: it's converted to mono WAV and trimmed, not voiced.
Prints a JSON map {id: {"file": path, "seconds": float, "pauses": [[from, to], ...]}}: pauses are the
silences inside the phrase (in seconds), which build.mjs uses to time the words for captions.
"""
import hashlib, json, os, subprocess, sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

spec_path, out, model, voices = sys.argv[1:5]
spec = json.load(open(spec_path))
voice, speed = spec.get("voice", "af_heart"), float(spec.get("speed", 1.0))
# the phonemizer's language: given by build.mjs, else from the voice's first letter
LANGS = {"a": "en-us", "b": "en-gb", "e": "es", "f": "fr-fr", "h": "hi", "i": "it", "j": "ja", "p": "pt-br", "z": "cmn"}
lang = spec.get("lang") or LANGS.get(voice[:1], "en-us")

# espeak can't read Japanese kanji or Mandarin tones well: those two go through misaki (installed by build.mjs
# when a story needs it), which gives Kokoro phonemes directly. Loaded at the first line Kokoro voices, so a
# story read from recordings never needs it.
MISAKI = lang in ("ja", "cmn")
_g2p = None


def g2p(text):
    global _g2p
    if _g2p is None:
        if lang == "ja":
            from misaki import ja
            jag = ja.JAG2P(version="pyopenjtalk")
            # misaki 0.9.4 returns the phonemes followed by a pitch line of the same length
            _g2p = lambda s: (lambda r: r[: len(r) // 2])(jag(s)[0])
        else:
            from misaki import zh
            _g2p = (lambda z: lambda s: z(s)[0])(zh.ZHG2P())
    return _g2p(text)
os.makedirs(out, exist_ok=True)


def pauses(audio, sr, least=0.09):
    """The quiet stretches of at least `least` seconds between words, from a 10 ms loudness envelope."""
    hop = int(0.01 * sr)
    env = np.array([np.sqrt(np.mean(audio[i:i + hop] ** 2)) for i in range(0, len(audio) - hop, hop)])
    if not len(env):
        return []
    quiet = env < max(0.004, 0.06 * env.max())
    out, start = [], None
    for k, q in enumerate(quiet):
        if q and start is None:
            start = k
        if not q and start is not None:
            if start > 0 and (k - start) * 0.01 >= least:
                out.append([round(start * 0.01, 3), round(k * 0.01, 3)])
            start = None
    return out


tts = None
result = {}
def trim(audio, sr, floor, lead=0.02):
    """Cut the near-silence before the first sound and after the last, so cues land on the first word.
    lead: seconds kept before it (a recording keeps more, for a soft s, f or h under the floor)."""
    loud = np.where(np.abs(audio) > floor)[0]
    return audio[max(0, loud[0] - int(lead * sr)): loud[-1] + int(0.08 * sr)] if len(loud) else audio


for line in spec["lines"]:
    if "file" in line:
        # a recording: keyed by its bytes, so replacing the file re-reads it
        key = "rec-" + hashlib.sha1(open(line["file"], "rb").read()).hexdigest()[:12]
        path = os.path.join(out, f"{key}.wav")
        if not os.path.exists(path):
            subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", line["file"], "-ac", "1", "-ar", "24000", path + ".tmp.wav"], check=True)
            audio, sr = sf.read(path + ".tmp.wav")
            os.remove(path + ".tmp.wav")
            # room noise sits above Kokoro's silence: the floor is a share of the peak
            sf.write(path, trim(audio, sr, max(0.01, 0.06 * float(np.abs(audio).max() or 1)), lead=0.1), sr)
        audio, sr = sf.read(path)
        result[line["id"]] = {"file": path, "seconds": len(audio) / sr, "pauses": pauses(audio, sr)}
        continue
    sp = float(line.get("speed", speed))  # a line can be quicker than the rest (kinetic accelerate)
    key = hashlib.sha1(json.dumps([line["text"], voice, sp] + ([lang, "misaki"] if MISAKI else [] if lang in ("en-us", "en-gb") and lang == LANGS.get(voice[:1]) else [lang])).encode()).hexdigest()[:12]
    path = os.path.join(out, f"{key}.wav")
    if not os.path.exists(path):
        tts = tts or Kokoro(model, voices)
        if MISAKI:
            audio, sr = tts.create(g2p(line["text"]), voice=voice, speed=sp, lang=lang, is_phonemes=True)
        else:
            audio, sr = tts.create(line["text"], voice=voice, speed=sp, lang=lang)
        sf.write(path, trim(audio, sr, 0.01), sr)
    audio, sr = sf.read(path)
    result[line["id"]] = {"file": path, "seconds": len(audio) / sr, "pauses": pauses(audio, sr)}
print(json.dumps(result))
