#!/usr/bin/env python3
"""Synthesizes the game's background music loop from scratch.

An ORIGINAL, cheerful chiptune-style tune (melody, bass, light percussion),
written note by note in this file. No samples, no existing songs, no chants.
Output: apps/mobile/assets/music/theme.m4a (seamless loop).

    python3 tools/scripts/gen-music.py
"""
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, lfilter

SR = 32000
BPM = 112
BEAT = 60 / BPM
OUT = Path(__file__).resolve().parents[2] / "apps/mobile/assets/music"
rng = np.random.default_rng(11)

NOTE = {n: i for i, n in enumerate(["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"])}


def hz(name):
    if name == "-":
        return 0.0
    n, o = name[:-1], int(name[-1])
    return 440.0 * 2 ** ((NOTE[n] + 12 * (o + 1) - 69) / 12)


def voice(freq, sec, kind, vol, attack=0.01, release=0.06):
    n = int(SR * sec)
    if freq == 0:
        return np.zeros(n)
    x = np.arange(n) / SR
    ph = 2 * np.pi * freq * x
    if kind == "pulse":  # soft 25% pulse: a few harmonics only
        w = sum(np.sin(ph * k) * np.sin(np.pi * k * 0.25) / k for k in range(1, 7))
    elif kind == "tri":
        w = 2 / np.pi * np.arcsin(np.sin(ph))
    else:
        w = np.sin(ph) + 0.25 * np.sin(2 * ph)
    e = np.ones(n)
    a, r = min(int(SR * attack), n // 2), min(int(SR * release), n // 2)
    e[:a] = np.linspace(0, 1, a)
    e[-r:] *= np.linspace(1, 0, r)
    # gentle decay so long notes don't drone
    e *= np.exp(-x * 1.4)
    return w * e * vol


def seq(notes, kind, vol):
    """notes: list of (note, beats)."""
    parts = [voice(hz(n), b * BEAT, kind, vol) for n, b in notes]
    return np.concatenate(parts)


# --- composition (4 chords × 4 bars, I–vi–IV–V in C, then a lift) ------------
A = [("E5", .5), ("G5", .5), ("C6", 1), ("B5", .5), ("G5", .5), ("E5", 1),
     ("A5", .5), ("C6", .5), ("E6", 1), ("D6", .5), ("C6", .5), ("A5", 1),
     ("F5", .5), ("A5", .5), ("C6", .5), ("A5", .5), ("G5", .5), ("F5", .5), ("E5", 1),
     ("D5", .5), ("G5", .5), ("B5", .5), ("D6", .5), ("C6", 1), ("-", 1)]
B = [("C6", .75), ("C6", .25), ("D6", .5), ("E6", .5), ("D6", .5), ("C6", .5), ("A5", 1),
     ("A5", .75), ("A5", .25), ("B5", .5), ("C6", .5), ("B5", .5), ("A5", .5), ("F5", 1),
     ("F5", .5), ("G5", .5), ("A5", .5), ("C6", .5), ("D6", .5), ("C6", .5), ("A5", 1),
     ("G5", .5), ("A5", .5), ("B5", .5), ("D6", .5), ("C6", 2)]
melody = seq(A + B + A + B, "pulse", 0.16)

BASS_BAR = {"C": ["C3", "G3", "C3", "G3"], "Am": ["A2", "E3", "A2", "E3"], "F": ["F2", "C3", "F2", "C3"], "G": ["G2", "D3", "G2", "B2"]}
prog = ["C", "Am", "F", "G"] * 4
bass = seq([(n, 1) for ch in prog for n in BASS_BAR[ch]], "tri", 0.22)

ARP = {"C": ["C5", "E5", "G5", "E5"], "Am": ["A4", "C5", "E5", "C5"], "F": ["F4", "A4", "C5", "A4"], "G": ["G4", "B4", "D5", "B4"]}
arp = seq([(n, .5) for ch in prog for n in ARP[ch] * 2], "sine", 0.05)


def drums(bars):
    out = []
    for _ in range(bars):
        for beat in range(4):
            n = int(SR * BEAT)
            x = np.arange(n) / SR
            if beat in (0, 2):  # soft kick
                k = np.sin(2 * np.pi * (60 + 80 * np.exp(-x * 30)) * x) * np.exp(-x * 14) * 0.35
            else:  # light clap / shaker
                noise = rng.standard_normal(n)
                b, a = butter(2, [2500 / (SR / 2), 7000 / (SR / 2)], btype="band")
                k = lfilter(b, a, noise) * np.exp(-x * 30) * 0.12
            out.append(k)
    return np.concatenate(out)


perc = drums(len(prog))
L = min(len(melody), len(bass), len(arp), len(perc))
mix = melody[:L] + bass[:L] + arp[:L] + perc[:L]
# 30 ms crossfade of the tail into the head for a seamless loop
f = int(SR * 0.03)
mix[:f] = mix[:f] * np.linspace(0, 1, f) + mix[-f:] * np.linspace(1, 0, f)
mix = mix[:-f]
mix = mix / np.max(np.abs(mix)) * 0.6

OUT.mkdir(parents=True, exist_ok=True)
wav = OUT / "theme.wav"
wavfile.write(wav, SR, (mix * 32767).astype(np.int16))
subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-c:a", "aac", "-b:a", "64k", str(OUT / "theme.m4a")], check=True)
wav.unlink()
print(f"theme.m4a: {L / SR:.1f}s")
