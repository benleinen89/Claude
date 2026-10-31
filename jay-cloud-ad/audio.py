"""Synthesize the 30s soundtrack, synced to the anim.js timeline. Writes soundtrack.wav (48k stereo)."""
import sys, wave
import numpy as np

SR, DUR = 48000, 30.0
N = int(SR * DUR)
L = np.zeros(N); R = np.zeros(N)
rng = np.random.default_rng(7)


def add(sig, t0, gain=1.0, pan=0.0):
    i = int(t0 * SR); j = min(N, i + len(sig))
    if j <= i: return
    s = sig[: j - i] * gain
    L[i:j] += s * np.sqrt(0.5 * (1 - pan)); R[i:j] += s * np.sqrt(0.5 * (1 + pan))


def tt(d): return np.arange(int(d * SR)) / SR


def env(d, a=0.005, r=None, curve=6.0):
    t = tt(d); e = np.minimum(1, t / max(a, 1e-4))
    return e * np.exp(-curve * t / d) if r is None else e * np.clip((d - t) / r, 0, 1)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR); y = np.zeros_like(x); acc = 0.0
    for k in range(len(x)): acc = (1 - a) * x[k] + a * acc; y[k] = acc
    return y


def tone(f, d, harm=(1,), curve=6.0, a=0.005):
    t = tt(d); s = sum(h * np.sin(2 * np.pi * f * (n + 1) * t) for n, h in enumerate(harm))
    return s * env(d, a=a, curve=curve)


def noise(d): return rng.standard_normal(int(d * SR))


# ---- 0–7.5s: fire alarm whoops synced to the 0.6s strobe, muffled after the cold open
for k in range(13):
    t0 = k * 0.6; d = 0.45; t = tt(d)
    f = 600 + 520 * (t / d)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.tanh(2.2 * np.sin(ph)) * env(d, a=0.01, r=0.06)
    g = 0.30 if t0 < 2.4 else 0.30 * max(0.0, 1 - (t0 - 2.4) / 5.0)
    if t0 >= 2.4: s = lowpass(s, 900)
    add(s, t0, g)

# impacts on the text slams
def boom(f=48, d=0.9):
    t = tt(d); return (np.sin(2 * np.pi * f * t * (1 - 0.35 * t / d)) * np.exp(-5 * t / d)
                       + 0.25 * lowpass(noise(d), 1500) * np.exp(-30 * t / d))
add(boom(), 0.15, 0.55); add(boom(44), 0.60, 0.6)

# ---- 2.4–13s: tension drone + ticking clock
d = 13.0 - 2.4; t = tt(d)
drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 82.4 * t)) * (0.75 + 0.25 * np.sin(2 * np.pi * 0.5 * t))
drone *= np.clip(t / 1.0, 0, 1) * np.clip((d - t) / 0.6, 0, 1)
add(drone, 2.4, 0.16)
for k in range(int((12.9 - 2.5) / 0.5)):
    add(lowpass(noise(0.02), 4000) * np.exp(-np.linspace(0, 8, int(0.02 * SR))), 2.5 + k * 0.5, 0.22, pan=0.3 if k % 2 else -0.3)

# roster marker scribbles (scene 3 starts 5.6)
for at in (1.2, 1.45, 1.7, 1.95):
    s = lowpass(noise(0.16), 2500) * (0.6 + 0.4 * np.sin(2 * np.pi * 38 * tt(0.16))) * env(0.16, a=0.01, r=0.05)
    add(s, 5.6 + at, 0.25, pan=0.2)

# scene 4 card swooshes + 'access granted' beep on the leaver card + warning hit
def swoosh(d=0.35):
    t = tt(d); return lowpass(noise(d), 3000) * np.sin(np.pi * t / d) ** 2
for at in (0.25, 0.75, 1.25): add(swoosh(), 10.0 + at - 0.1, 0.2, pan=-0.4)
add(tone(1800, 0.09, (1, 0.2), curve=2), 11.45, 0.18); add(tone(1800, 0.09, (1, 0.2), curve=2), 11.58, 0.18)
add(boom(40, 1.0), 12.0, 0.45)

# ---- 12.2–13.0 riser, 13.0 reveal hit
d = 0.8; t = tt(d)
add(lowpass(noise(d), 6000) * (t / d) ** 2.5, 12.2, 0.28)
add(boom(60, 1.4), 13.0, 0.5)
add(tone(523.25, 2.5, (1, 0.3, 0.1), curve=2.5, a=0.01), 13.0, 0.10, pan=-0.2)
add(tone(783.99, 2.5, (1, 0.3, 0.1), curve=2.5, a=0.01), 13.0, 0.08, pan=0.2)

# ---- 13–30s: music bed (120 bpm) C – G – Am – F – C
BEAT = 0.5
chords = [(13.0, [130.81, 196.0, 329.63, 392.0]), (17.0, [98.0, 196.0, 293.66, 493.88]),
          (21.0, [110.0, 220.0, 261.63, 329.63]), (25.0, [87.31, 174.61, 261.63, 349.23]),
          (29.0, [130.81, 196.0, 329.63, 392.0])]
for idx, (t0, notes) in enumerate(chords):
    d = (chords[idx + 1][0] if idx + 1 < len(chords) else 30.0) - t0 + 0.3
    t = tt(d); e = np.clip(t / 0.6, 0, 1) * np.clip((d - t) / 0.5, 0, 1)
    pad = sum(np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2.003 * f * t) for f in notes) * e
    add(pad, t0, 0.035)
    # 8th-note pluck arpeggio from the chord, an octave up
    arp = [notes[1] * 2, notes[2] * 2, notes[3] * 2, notes[2] * 2]
    k = 0; tb = max(t0, 15.0)
    while tb < min(t0 + d - 0.3, 29.5):
        add(tone(arp[k % 4], 0.35, (1, 0.25), curve=7), tb, 0.06, pan=(-0.3, 0.3)[k % 2]); k += 1; tb += BEAT / 2
# soft kick on beats 1 & 3 from 15s, hats on off-beats
tb = 15.0
while tb < 29.5:
    add(boom(55, 0.35), tb, 0.35)
    add(lowpass(noise(0.05), 9000) * np.exp(-np.linspace(0, 10, int(0.05 * SR))) - lowpass(noise(0.05), 2000) * 0.0, tb + 0.25, 0.05)
    tb += 2 * BEAT

# ---- scene 6 event sounds (beats at 15.4, 18.0, 20.6; result +0.95)
for b in (15.4, 18.0, 20.6):
    add(swoosh(0.4), b + 0.45, 0.12, pan=0.5)
add(tone(1760, 0.1, (1, 0.2), curve=2), 16.35, 0.2); add(tone(2349, 0.14, (1, 0.2), curve=3), 16.47, 0.2)
buzz = np.sign(np.sin(2 * np.pi * 180 * tt(0.38))) * env(0.38, a=0.005, r=0.05)
add(lowpass(buzz, 1800), 18.95, 0.16)
add(tone(1318.5, 0.9, (1, 0.4, 0.2), curve=4), 21.55, 0.14); add(tone(1975.5, 0.9, (1, 0.3), curve=4), 21.62, 0.10)

# ---- scene 7: count-up ticks rising, missing-row alerts
for k in range(28):
    at = 23.45 + 1.65 * (1 - (1 - k / 27) ** 2)  # follows the ease-out count
    add(tone(900 + 30 * k, 0.03, (1,), curve=8), at, 0.07, pan=0.2)
for at in (25.1, 25.3, 25.5): add(tone(660, 0.18, (1, 0.5), curve=5), at, 0.12)

# ---- scene 8: resolve + CTA pop
add(boom(65, 1.2), 27.0, 0.3)
add(tone(1046.5, 1.2, (1, 0.3), curve=3), 28.0, 0.12); add(tone(1568, 1.2, (1, 0.3), curve=3), 28.05, 0.09)

# master: fade tail, normalize
fade = np.clip((DUR - np.arange(N) / SR) / 0.6, 0, 1); L *= fade; R *= fade
peak = max(np.abs(L).max(), np.abs(R).max()); L /= peak / 0.89; R /= peak / 0.89
out = sys.argv[1] if len(sys.argv) > 1 else 'soundtrack.wav'
with wave.open(out, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.stack([L, R], 1) * 32767).astype('<i2').tobytes())
print('wrote', out)
