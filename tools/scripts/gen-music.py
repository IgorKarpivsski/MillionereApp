#!/usr/bin/env python3
"""Synthesizes the game's background music loop from scratch: calm lo-fi.

An ORIGINAL lo-fi hip-hop loop written note by note in this file: jazzy
electric-piano chords, round bass, a few soft melody notes, lazy swung drums,
vinyl crackle and a little tape wobble. No samples, no existing songs.
Output: apps/mobile/assets/music/theme.m4a (seamless ~51 s loop).

    python3 tools/scripts/gen-music.py
"""
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, fftconvolve, sosfilt

SR = 32000
BPM = 74
BEAT = 60 / BPM
BAR = 4 * BEAT
BARS = 16
L = int(SR * BAR * BARS)
OUT = Path(__file__).resolve().parents[2] / "apps/mobile/assets/music"
rng = np.random.default_rng(2026)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


buf = np.zeros(L + SR * 4)  # room for tails; wrapped onto the start at the end
chords_bus = np.zeros_like(buf)
drum_bus = np.zeros_like(buf)


def put(bus, start_sec, sig):
    i = int(start_sec * SR)
    bus[i:i + len(sig)] += sig[: max(0, len(bus) - i)]


def swing(beat_pos):
    """Swing the off-beat 8ths (0.5 → 0.6)."""
    whole, frac = divmod(beat_pos, 1.0)
    return (whole + (0.6 if abs(frac - 0.5) < 1e-6 else frac)) * BEAT


# ---------------------------------------------------------------- instruments
def rhodes(freq, sec, vol):
    n = int(SR * sec)
    t = np.arange(n) / SR
    # body + a soft bell partial that fades fast (electric piano tine)
    w = np.sin(2 * np.pi * freq * t) + 0.18 * np.sin(2 * np.pi * 2 * freq * t)
    w += 0.22 * np.sin(2 * np.pi * 3.5 * freq * t) * np.exp(-t * 9)
    env = (1 - np.exp(-t * 60)) * np.exp(-t * 0.9)
    trem = 1 - 0.12 * (0.5 + 0.5 * np.sin(2 * np.pi * 4.2 * t))
    rel = int(SR * 0.25)
    env[-rel:] *= np.linspace(1, 0, rel)
    return w * env * trem * vol


def bass(freq, sec, vol):
    n = int(SR * sec)
    t = np.arange(n) / SR
    w = np.tanh(1.6 * (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)))
    env = (1 - np.exp(-t * 80)) * np.exp(-t * 1.6)
    rel = int(SR * 0.08)
    env[-rel:] *= np.linspace(1, 0, rel)
    return w * env * vol


def lead(freq, sec, vol):
    n = int(SR * sec)
    t = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5 * t) * np.clip(t * 2, 0, 1)
    ph = 2 * np.pi * freq * np.cumsum(vib) / SR
    w = np.sin(ph) + 0.12 * np.sin(2 * ph) + 0.05 * np.sin(3 * ph)
    env = (1 - np.exp(-t * 25)) * np.exp(-t * 1.1)
    rel = int(SR * 0.15)
    env[-rel:] *= np.linspace(1, 0, rel)
    return w * env * vol


def kick(vol):
    t = np.arange(int(SR * 0.45)) / SR
    f = 48 + 70 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9) * vol


SNARE_SOS = butter(2, [900 / (SR / 2), 5200 / (SR / 2)], btype="band", output="sos")
HAT_SOS = butter(2, 6500 / (SR / 2), btype="high", output="sos")


def snare(vol):
    t = np.arange(int(SR * 0.3)) / SR
    noise = sosfilt(SNARE_SOS, rng.standard_normal(len(t))) * np.exp(-t * 20)
    body = np.sin(2 * np.pi * 185 * t) * np.exp(-t * 30) * 0.5
    return (noise * 0.9 + body) * vol


def hat(vol):
    t = np.arange(int(SR * 0.06)) / SR
    return sosfilt(HAT_SOS, rng.standard_normal(len(t))) * np.exp(-t * 90) * vol


# ---------------------------------------------------------------- composition
# ii–V–I–vi in C with extensions, one chord per bar.
PROG = [
    ["D3", "F3", "A3", "C4", "E4"],    # Dm9
    ["G2", "F3", "B3", "E4", "A4"],    # G13 (rootless-ish)
    ["C3", "E3", "G3", "B3", "D4"],    # Cmaj9
    ["A2", "G3", "C4", "E4", "B4"],    # Am9
]
BASS = [["D2", "A2"], ["G2", "D2"], ["C2", "G2"], ["A1", "E2"]]
# A few soft melody phrases (beat offset, note, beats) — they only enter from bar 5.
PHRASES = [
    [(0.5, "A4", 1.0), (2.0, "C5", 0.75), (3.0, "A4", 1.0)],
    [(1.0, "B4", 0.75), (2.5, "A4", 1.5)],
    [(0.0, "G4", 1.0), (1.5, "E4", 0.75), (3.0, "D4", 1.0)],
    [(2.0, "E4", 1.5)],
]

for bar in range(BARS):
    t0 = bar * BAR
    chord = PROG[bar % 4]
    # Chords: a lazy strum on beat 1, a softer re-hit on the "and" of 3 every other bar.
    for k, n in enumerate(chord):
        put(chords_bus, t0 + 0.012 * k, rhodes(hz(n), BAR * 0.98, 0.075))
    if bar % 2 == 1:
        for k, n in enumerate(chord[1:]):
            put(chords_bus, t0 + swing(2.5) + 0.01 * k, rhodes(hz(n), BEAT * 1.4, 0.04))
    # Bass: root on 1, fifth on the swung "and" of 2.
    r, f = BASS[bar % 4]
    put(buf, t0, bass(hz(r), BEAT * 1.7, 0.16))
    put(buf, t0 + swing(2.5), bass(hz(f), BEAT * 1.1, 0.11))
    # Melody from bar 5, resting every 4th bar so it never nags.
    if bar >= 4 and bar % 4 != 3:
        for off, n, beats in PHRASES[bar % 4]:
            put(buf, t0 + swing(off), lead(hz(n), beats * BEAT, 0.06))
    # Drums: boom-bap, swung hats, a tiny fill every 4 bars.
    for b in (0.0, 2.5):
        put(drum_bus, t0 + swing(b), kick(0.42 * rng.uniform(0.9, 1.0)))
    if bar % 4 == 3:
        put(drum_bus, t0 + swing(3.5), kick(0.25))
    for b in (1.0, 3.0):
        put(drum_bus, t0 + swing(b) + 0.012, snare(0.2 * rng.uniform(0.85, 1.0)))
    for h in range(8):
        put(drum_bus, t0 + swing(h * 0.5), hat((0.05 if h % 2 else 0.075) * rng.uniform(0.6, 1.0)))

# Sidechain-ish ducking of the chords on every kick (that lo-fi "breathing").
duck = np.ones_like(buf)
for bar in range(BARS + 1):
    for b in (0.0, 2.5):
        i = int((bar * BAR + swing(b)) * SR)
        d = int(SR * 0.35)
        if i < len(duck):
            seg = 1 - 0.35 * np.exp(-np.arange(min(d, len(duck) - i)) / (SR * 0.09))
            duck[i:i + len(seg)] = np.minimum(duck[i:i + len(seg)], seg)
chords_bus *= duck

# Small room: convolve with a short decaying noise impulse.
ir_t = np.arange(int(SR * 1.1)) / SR
ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t * 4.5)
ir = sosfilt(butter(1, 3500 / (SR / 2), output="sos"), ir)
ir /= np.sqrt(np.sum(ir ** 2))
room = fftconvolve(chords_bus + buf * 0.6, ir)[: len(buf)] * 0.18

mix = buf + chords_bus + drum_bus * 0.85 + room

# Seamless loop: everything that rang past the end wraps onto the start.
tail = mix[L:]
mix = mix[:L].copy()
mix[: len(tail)] += tail[: L]

# Tape wobble: a slow ±0.12% pitch drift (resample along a gently warped time axis).
n = np.arange(L)
f_w = max(1, round(L / SR * 0.35)) / (L / SR)  # whole cycles per loop, so the loop stays seamless
warp = n + (0.0012 * SR / (2 * np.pi * f_w)) * np.sin(2 * np.pi * f_w * n / SR)
mix = np.interp(np.clip(warp, 0, L - 1), n, mix)

# Vinyl: low hiss + sparse soft crackles.
hiss = sosfilt(butter(2, [400 / (SR / 2), 4000 / (SR / 2)], btype="band", output="sos"), rng.standard_normal(L)) * 0.006
crackle = np.zeros(L)
for i in rng.integers(0, L - 40, size=int(L / SR * 9)):
    crackle[i:i + 40] += rng.standard_normal(40) * np.exp(-np.arange(40) / 6) * rng.uniform(0.02, 0.07)
mix = mix + hiss + sosfilt(butter(2, 2500 / (SR / 2), btype="high", output="sos"), crackle)

# Warm it up: gentle low-pass, soft saturation, quiet master level.
mix = sosfilt(butter(2, 5200 / (SR / 2), output="sos"), mix)
mix = np.tanh(mix * 1.3) / 1.3
mix = mix / np.max(np.abs(mix)) * 0.5

OUT.mkdir(parents=True, exist_ok=True)
wav = OUT / "theme.wav"
wavfile.write(wav, SR, (mix * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "80k", str(OUT / "theme.m4a")], check=True)
wav.unlink()
print(f"theme.m4a: {L / SR:.1f}s lo-fi loop")
