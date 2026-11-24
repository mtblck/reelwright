#!/usr/bin/env bash
# Rebuild assets/sfx/*.wav. Every sound is synthesised here with FFmpeg (no samples), so they are this
# repo's own, under its MIT licence. Only needed when changing a sound.
set -euo pipefail
OUT="$(cd "$(dirname "$0")/.." && pwd)/assets/sfx"
mkdir -p "$OUT"
f() { ffmpeg -v error -y -f lavfi -i "$1" -af "$2" -ar 48000 -ac 1 "$OUT/$3.wav"; }
# whoosh: pink noise swept through a band-pass, swelling then gone
f "anoisesrc=d=0.5:c=pink:a=0.9" "highpass=f=300,lowpass=f=5000,bandpass=f=1400:width_type=o:w=2,afade=t=in:d=0.28:curve=exp,afade=t=out:st=0.3:d=0.2,volume=3" whoosh
# pop: a quick falling sine with a fast decay
f "aevalsrc='sin(2*PI*(900-1400*t)*t)*exp(-28*t)':d=0.16" "volume=0.9" pop
# tick: a short bright blip for list items
f "aevalsrc='(sin(2*PI*1800*t)+0.4*sin(2*PI*3600*t))*exp(-60*t)':d=0.08" "volume=0.7" tick
# click: a button press, noise burst plus a low knock
f "aevalsrc='(random(0)*2-1)*exp(-180*t)+0.6*sin(2*PI*180*t)*exp(-50*t)':d=0.07" "highpass=f=120,volume=0.8" click
# chime: two soft bells a fifth apart
f "aevalsrc='(sin(2*PI*1046.5*t)+0.6*sin(2*PI*1568*t)+0.15*sin(2*PI*2093*t))*exp(-4.5*t)':d=0.9" "volume=0.45" chime
# rise: a short upward sweep under a counting number
f "aevalsrc='sin(2*PI*(300*t+700*t*t))*min(1,t*6)*exp(-2.2*t)':d=0.7" "volume=0.5" rise
ls -la "$OUT"
