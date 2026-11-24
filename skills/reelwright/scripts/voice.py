"""Voice every phrase with Kokoro (kokoro-onnx), one WAV per phrase, cached by text and voice.

Usage: python voice.py <lines.json> <out_dir> <model.onnx> <voices.bin>
lines.json: {"voice": "af_heart", "speed": 1.0, "lines": [{"id": "s0p0", "text": "...", "speed"?: 1.1}]}
Prints a JSON map {id: {"file": path, "seconds": float, "pauses": [[from, to], ...]}}: pauses are the
silences inside the phrase (in seconds), which build.mjs uses to time the words for captions.
"""
import hashlib, json, os, sys

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

spec_path, out, model, voices = sys.argv[1:5]
spec = json.load(open(spec_path))
voice, speed = spec.get("voice", "af_heart"), float(spec.get("speed", 1.0))
lang = "en-gb" if voice[:1] == "b" else "en-us"
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
for line in spec["lines"]:
    sp = float(line.get("speed", speed))  # a line can be quicker than the rest (kinetic accelerate)
    key = hashlib.sha1(json.dumps([line["text"], voice, sp]).encode()).hexdigest()[:12]
    path = os.path.join(out, f"{key}.wav")
    if not os.path.exists(path):
        tts = tts or Kokoro(model, voices)
        audio, sr = tts.create(line["text"], voice=voice, speed=sp, lang=lang)
        # trim the model's leading and trailing near-silence so cues land on the first word
        loud = np.where(np.abs(audio) > 0.01)[0]
        if len(loud):
            audio = audio[max(0, loud[0] - int(0.02 * sr)): loud[-1] + int(0.08 * sr)]
        sf.write(path, audio, sr)
    audio, sr = sf.read(path)
    result[line["id"]] = {"file": path, "seconds": len(audio) / sr, "pauses": pauses(audio, sr)}
print(json.dumps(result))
