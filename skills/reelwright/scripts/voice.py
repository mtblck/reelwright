"""Voice every phrase with Kokoro (kokoro-onnx), one WAV per phrase, cached by text and voice.

Usage: python voice.py <lines.json> <out_dir> <model.onnx> <voices.bin>
lines.json: {"voice": "af_heart", "speed": 1.0, "lines": [{"id": "s0p0", "text": "..."}]}
Prints a JSON map {id: {"file": path, "seconds": float}}.
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
tts = None
result = {}
for line in spec["lines"]:
    key = hashlib.sha1(json.dumps([line["text"], voice, speed]).encode()).hexdigest()[:12]
    path = os.path.join(out, f"{key}.wav")
    if not os.path.exists(path):
        tts = tts or Kokoro(model, voices)
        audio, sr = tts.create(line["text"], voice=voice, speed=speed, lang=lang)
        # trim the model's leading and trailing near-silence so cues land on the first word
        loud = np.where(np.abs(audio) > 0.01)[0]
        if len(loud):
            audio = audio[max(0, loud[0] - int(0.02 * sr)): loud[-1] + int(0.08 * sr)]
        sf.write(path, audio, sr)
    info = sf.info(path)
    result[line["id"]] = {"file": path, "seconds": info.frames / info.samplerate}
print(json.dumps(result))
