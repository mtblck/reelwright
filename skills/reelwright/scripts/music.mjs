// A music bed written for the video: tempo, key and mood picked per video, length cut to the frame,
// ending on a downbeat. Pure JavaScript synthesis (drums, bass, chords, a pluck arpeggio, a little
// reverb), no samples, so every bed is this repo's own and free to use anywhere (CC0).
// Usage: node music.mjs <out.wav> --seconds 30 [--stop <seconds>: end on a tape stop there] [--mood bright|calm|tech|lofi|cinematic|minimal] [--bpm 112] [--key C] [--seed 3]
import fs from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = args[0];
if (!out || out.startsWith('--')) { console.error('usage: node music.mjs <out.wav> --seconds 30 [--mood bright|calm|tech|lofi|cinematic|minimal] [--bpm N] [--key C] [--seed N]'); process.exit(1); }
const MOODS = {
  bright: {bpm: 112, prog: [[0, 4, 7, 11], [7, 11, 14, 17], [9, 12, 16, 19], [5, 9, 12, 16]], hat: 0.5, pluck: 0.5, kick: 1, minor: false},
  calm: {bpm: 88, prog: [[0, 4, 7, 14], [5, 9, 12, 16], [9, 12, 16, 19], [7, 11, 14, 21]], hat: 0.25, pluck: 0.35, kick: 0.6, minor: false},
  tech: {bpm: 120, prog: [[0, 3, 7, 10], [8, 12, 15, 19], [3, 7, 10, 14], [10, 14, 17, 21]], hat: 0.6, pluck: 0.55, kick: 1, minor: true},
  // lofi: a lazy boom-bap with swung hats, soft electric-piano chords on the beat, tape crackle, rolled-off top
  lofi: {bpm: 80, prog: [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]], hat: 0.4, pluck: 0.5, kick: 0.8, minor: false, style: 'lofi', swing: 0.16, crackle: true, top: 4200},
  // cinematic: no kit; a low boom on each bar, an eighth-note string ostinato, swelling pads, building to the end
  cinematic: {bpm: 72, prog: [[0, 3, 7, 12], [8, 12, 15, 20], [5, 8, 12, 17], [7, 11, 14, 19]], hat: 0, pluck: 0, kick: 0.9, minor: true, style: 'cinematic', pad: 2},
  // minimal: a kick on the one, a few quiet hats, a held bass note and a sparse arpeggio, lots of air
  minimal: {bpm: 100, prog: [[0, 7, 14], [5, 12, 16], [9, 16, 19], [7, 14, 19]], hat: 0.25, pluck: 0.45, kick: 0.7, minor: false, style: 'minimal'},
};
const mood = MOODS[opt('--mood', 'bright')] ?? MOODS.bright;
const SR = 48000;
const bpm = Number(opt('--bpm', mood.bpm));
const KEYS = {C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, B: 11};
const key = KEYS[opt('--key', 'C')] ?? 0;
let seed = Number(opt('--seed', 7));
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const beat = 60 / bpm;
const bar = beat * 4;
// whole bars that fill the video, the last one ringing out past the final downbeat
const want = Number(opt('--seconds', 30));
const bars = Math.max(2, Math.round(want / bar));
const len = Math.ceil((bars * bar + 2.5) * SR);
const L = new Float32Array(len), R = new Float32Array(len);
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);
const add = (buf, i, v) => { if (i >= 0 && i < len) buf[i] += v; };
const put = (i, v, pan = 0) => { add(L, i, v * (1 - pan) ); add(R, i, v * (1 + pan)); };

// --- voices ---
function kick(t, g) {
  const s = Math.floor(t * SR);
  for (let i = 0; i < 0.35 * SR; i++) {
    const x = i / SR;
    const f = 45 + 110 * Math.exp(-x * 28);
    put(s + i, Math.sin(2 * Math.PI * (45 * x + (110 / 28) * (1 - Math.exp(-x * 28)))) * Math.exp(-x * 9) * 0.9 * g);
    void f;
  }
}
function hat(t, g, open = false) {
  const s = Math.floor(t * SR);
  let prev = 0;
  const d = open ? 0.18 : 0.05;
  for (let i = 0; i < d * SR * 3; i++) {
    const n = rnd() * 2 - 1;
    const hp = n - prev; prev = n; // crude high-pass
    put(s + i, hp * Math.exp(-(i / SR) / d * 3) * 0.12 * g, (rnd() - 0.5) * 0.3);
  }
}
function clap(t, g) {
  const s = Math.floor(t * SR);
  let lp = 0;
  for (let i = 0; i < 0.25 * SR; i++) {
    const x = i / SR;
    const env = (x < 0.03 ? (Math.floor(x / 0.01) % 2 ? 0.6 : 1) : 1) * Math.exp(-x * 18);
    lp += 0.5 * ((rnd() * 2 - 1) - lp);
    put(s + i, (rnd() * 2 - 1 - lp) * env * 0.22 * g);
  }
}
// saw with a one-pole low-pass and an ADSR-ish envelope
function saw(t, dur, note, g, {cut = 1200, atk = 0.01, rel = 0.2, det = 0, pan = 0} = {}) {
  const s = Math.floor(t * SR);
  const n = Math.floor((dur + rel) * SR);
  const f = midi(note) * (1 + det);
  const a = 1 - Math.exp(-2 * Math.PI * cut / SR);
  let ph = rnd(), y = 0;
  for (let i = 0; i < n; i++) {
    const x = i / SR;
    ph += f / SR; if (ph >= 1) ph -= 1;
    y += a * ((2 * ph - 1) - y);
    const env = Math.min(1, x / atk) * (x > dur ? Math.exp(-(x - dur) / rel * 4) : 1);
    put(s + i, y * env * g, pan);
  }
}
function pluck(t, note, g, pan) {
  const s = Math.floor(t * SR);
  const f = midi(note);
  for (let i = 0; i < 0.6 * SR; i++) {
    const x = i / SR;
    const v = (Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(4 * Math.PI * f * x) + 0.12 * Math.sin(6 * Math.PI * f * x)) * Math.exp(-x * 7);
    put(s + i, v * 0.09 * g, pan);
  }
}

// a soft electric piano: sines with a bell partial and a slow decay
function keys(t, note, g, pan) {
  const s = Math.floor(t * SR);
  const f = midi(note);
  for (let i = 0; i < 1.4 * SR; i++) {
    const x = i / SR;
    const v = (Math.sin(2 * Math.PI * f * x) + 0.25 * Math.sin(2 * Math.PI * f * 3.01 * x) * Math.exp(-x * 9)) * Math.exp(-x * 2.2) * Math.min(1, x / 0.004);
    put(s + i, v * 0.06 * g, pan);
  }
}

// --- arrangement: intro bar (pads only), groove, last bar a single held chord ---
const root = 48 + key; // C3
for (let b = 0; b < bars; b++) {
  const t0 = b * bar;
  const chord = mood.prog[b % mood.prog.length];
  const last = b === bars - 1;
  const intro = b === 0;
  // pad: four detuned saws per chord, slow attack
  const swell = mood.style === 'cinematic' ? 0.5 + 0.8 * (b / bars) : 1; // cinematic builds
  for (const [k, iv] of chord.entries()) for (const d of [-0.004, 0.004]) saw(t0, last ? bar * 0.5 : bar, root + 12 + iv, 0.035 * (mood.pad ?? 1) * swell, {cut: 900 + 500 * (b / bars), atk: 0.25, rel: last ? 1.8 : 0.3, det: d, pan: (k - 1.5) * 0.25});
  if (last) { kick(t0, mood.kick); saw(t0, bar * 0.5, root - 12 + chord[0], 0.16, {cut: 300, rel: 1.2}); break; }
  const sw = (q) => (q % 1 ? (mood.swing ?? 0) * beat : 0); // swing: offbeats land late
  if (mood.style === 'lofi') {
    if (!intro) {
      for (const q of [0, 2.5]) kick(t0 + q * beat, mood.kick);
      for (const q of [1, 3]) clap(t0 + q * beat, 0.55);
      for (let e = 0; e < 8; e++) hat(t0 + (e / 2) * beat + sw(e / 2), mood.hat * (e % 2 ? 0.7 : 1));
      for (let q = 0; q < 4; q += 2) saw(t0 + q * beat, beat * 1.6, root - 12 + chord[0], 0.13, {cut: 260, rel: 0.2});
    }
    for (const q of [0, 1.5, 2, 3.5]) for (const [k, iv] of chord.entries()) keys(t0 + q * beat + sw(q) + k * 0.012, root + 12 + iv, mood.pluck * (q % 1 ? 0.6 : 1), (k - 1.5) * 0.2);
    continue;
  }
  if (mood.style === 'cinematic') {
    kick(t0, mood.kick * swell);
    if (b % 4 === 3) kick(t0 + 2.5 * beat, mood.kick * 0.8 * swell);
    if (!intro) for (let e = 0; e < 8; e++) saw(t0 + (e / 2) * beat, beat * 0.32, root + chord[[0, 0, 1, 0, 2, 0, 1, 0][e]], 0.05 * swell, {cut: 1400, rel: 0.06, pan: e % 2 ? 0.25 : -0.25});
    saw(t0, bar, root - 24 + chord[0], 0.09 * swell, {cut: 160, atk: 0.4, rel: 0.4});
    continue;
  }
  if (mood.style === 'minimal') {
    kick(t0, mood.kick);
    if (!intro) for (const q of [1.5, 3.5]) hat(t0 + q * beat, mood.hat);
    saw(t0, bar * 0.9, root - 12 + chord[0], 0.11, {cut: 220, atk: 0.05, rel: 0.3});
    for (let e = 0; e < 8; e++) { if (rnd() < 0.45) continue; pluck(t0 + (e / 2) * beat, root + 24 + chord[e % chord.length], mood.pluck * 4, e % 2 ? 0.35 : -0.35); }
    continue;
  }
  // bass: root on every beat, an octave jump on the offbeat
  if (!intro) for (let q = 0; q < 4; q++) {
    saw(t0 + q * beat, beat * 0.45, root - 12 + chord[0], 0.15, {cut: 320, rel: 0.05});
    if (q % 2) saw(t0 + (q + 0.5) * beat, beat * 0.3, root + chord[0], 0.07, {cut: 500, rel: 0.05});
  }
  // drums
  if (!intro) for (let q = 0; q < 4; q++) {
    kick(t0 + q * beat, mood.kick);
    if (q % 2) clap(t0 + q * beat, 0.8);
    hat(t0 + (q + 0.5) * beat, mood.hat * 1.4, q === 3);
    hat(t0 + q * beat, mood.hat * 0.6);
  }
  // pluck arpeggio in 8ths over the chord
  if (!intro || mood === MOODS.calm) for (let e = 0; e < 8; e++) {
    if (rnd() < 0.18) continue;
    const n = root + 24 + chord[[0, 1, 2, 3, 2, 1, 2, 3][e]];
    pluck(t0 + e * beat / 2, n, mood.pluck * 4, e % 2 ? 0.3 : -0.3);
  }
}

// --- tape: crackle, and a rolled-off top ---
if (mood.crackle) for (let i = 0; i < len; i++) { if (rnd() < 0.00035) { const v = (rnd() - 0.5) * 0.25; for (let k = 0; k < 40; k++) put(i + k, v * Math.exp(-k / 6)); } }
if (mood.top) {
  const a = 1 - Math.exp(-2 * Math.PI * mood.top / SR);
  for (const buf of [L, R]) { let y = 0; for (let i = 0; i < len; i++) { y += a * (buf[i] - y); buf[i] = y; } }
}

// --- reverb (a few feedback delays), master fade, soft clip ---
for (const [buf, taps] of [[L, [0.0297, 0.0371, 0.0411, 0.0437]], [R, [0.0311, 0.0353, 0.0423, 0.0451]]]) {
  const wet = new Float32Array(len);
  for (const d of taps) {
    const n = Math.floor(d * SR * 3);
    const line = new Float32Array(n);
    let k = 0;
    for (let i = 0; i < len; i++) { const y = line[k]; line[k] = buf[i] + y * 0.72; wet[i] += y * 0.09; k = (k + 1) % n; }
  }
  for (let i = 0; i < len; i++) buf[i] += wet[i];
}
// --- a tape stop: over the last 0.7 s before --stop, playback slows to nothing, then silence ---
const stopAt = args.includes('--stop') ? Number(opt('--stop', 0)) : 0;
if (stopAt) {
  const e = Math.min(len, Math.floor(stopAt * SR));
  const n = Math.floor(0.7 * SR);
  const s0 = Math.max(0, e - n);
  for (const buf of [L, R]) {
    const src = buf.slice(s0, e);
    let pos = 0;
    for (let i = 0; i < e - s0; i++) {
      const r = Math.pow(1 - i / (e - s0), 1.6); // rate falls from 1 to 0
      const k = Math.floor(pos), fr = pos - k;
      buf[s0 + i] = ((src[k] ?? 0) * (1 - fr) + (src[k + 1] ?? 0) * fr) * Math.min(1, (e - s0 - i) / (0.03 * SR));
      pos += r;
    }
    buf.fill(0, e);
  }
}
let peak = 0;
for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const gain = 0.85 / (peak || 1);
const pcm = Buffer.alloc(len * 4);
for (let i = 0; i < len; i++) {
  const fadeIn = Math.min(1, i / (0.05 * SR));
  for (const [c, buf] of [[0, L], [1, R]]) pcm.writeInt16LE(Math.round(Math.tanh(buf[i] * gain * 1.1) * fadeIn * 32000), i * 4 + c * 2);
}
const h = Buffer.alloc(44);
h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(2, 22); h.writeUInt32LE(SR, 24); h.writeUInt32LE(SR * 4, 28); h.writeUInt16LE(4, 32); h.writeUInt16LE(16, 34);
h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
fs.writeFileSync(out, Buffer.concat([h, pcm]));
console.log(`${out}: ${bars} bars at ${bpm} bpm = ${(len / SR).toFixed(1)} s`);
