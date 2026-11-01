#!/usr/bin/env python3
"""Builds the soundtrack: edited music bed + ~80 placed sound-effect cues -> mix.wav.

Music: "Born of the Sky" by Scott Buckley (CC-BY 4.0) - www.scottbuckley.com.au
SFX:   BigSoundBank.com by Joseph Sardin (CC0)
All sounds are real recordings downloaded from those libraries; nothing is synthesised.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
SFX = os.path.join(HERE, 'sfx')
MUSIC = os.path.join(HERE, 'src', 'BornOfTheSky.mp3')
OUT = os.path.join(HERE, 'mix.wav')
FILM = 60.13

def path(i):
    for ext in ('flac', 'mp3'):
        p = os.path.join(SFX, f'{i}.{ext}')
        if os.path.exists(p): return p
    raise FileNotFoundError(i)

_peak = {}
def peak(i):
    if i not in _peak:
        r = subprocess.run(['ffmpeg', '-v', 'info', '-i', path(i), '-af', 'volumedetect', '-f', 'null', '-'], capture_output=True, text=True).stderr
        _peak[i] = float(re.search(r'max_volume: (-?[\d.]+) dB', r).group(1))
    return _peak[i]

# cue: (id, film_start, file_offset, duration, gain_db, fade_in, fade_out, opts)
# gain is relative to the file normalised to 0 dBFS peak.
C = []
def cue(i, at, off=0.0, dur=None, g=-12, fi=0.005, fo=0.05, **o): C.append(dict(i=i, at=at, off=off, dur=dur, g=g, fi=fi, fo=fo, o=o))

# ---------------- SHOT 1: lake at dawn (0 - 16.32) ----------------
cue('1906', 0.0, 40.0, 16.6, -30, fi=3.0, fo=1.2)                      # dawn birds
cue('2754', 0.0, 20.0, 16.6, -36, fi=3.0, fo=1.2, lp=2200)              # distant mountain stream / waterfall
cue('0908', 0.0, 10.0, 17.0, -34, fi=2.5, fo=1.0, hp=120)               # soft mountain air
cue('1109', 3.8, 2.0, 5.4, -20, fi=2.2, fo=1.6)                         # light gathers: singing bowl
cue('1520', 6.25, 0.0, 4.5, -8, fo=1.5)                                 # the lake erupts
cue('3430', 6.3, 5.0, 2.6, -20, fi=0.15, fo=1.2, lp=1800)               # water column rumble
cue('1110', 8.3, 0.0, 7.5, -17, fo=4.0)                                 # formed: resonant ring
cue('1386', 8.8, 2.0, 2.8, -20, fi=0.3, fo=0.8)                         # water running off
cue('1531', 10.82, 0.0, 1.6, -15)                                       # shake-off
cue('1533', 11.05, 0.0, 1.6, -17)
cue('2080', 11.85, 0.0, 1.5, -15)                                       # eyes open sparkle
cue('2079', 12.5, 0.0, 2.3, -12)                                        # the drop rises
cue('1867', 13.42, 0.0, 2.0, -21, rate=1.0)                             # twinkle as he holds it
cue('2891', 14.15, 0.0, 2.7, -9)                                        # take-off wings
cue('1529', 14.5, 0.0, 1.5, -11)                                        # take-off splash
cue('3454', 14.62, 0.0, 0.68, -17)                                      # a jay call
cue('1796', 14.85, 0.0, 1.1, -11)

# ---------------- SHOT 2: clouds + door (16.32 - 26.52) ----------------
cue('0154', 15.9, 6.0, 5.6, -22, fi=0.8, fo=1.0, hp=150)                # wind while climbing
cue('1796', 16.62, 0.0, 1.1, -7)                                         # burst through the cloud sea
cue('1800', 16.8, 0.0, 0.9, -9)
cue('2892', 17.05, 0.0, 2.2, -14)
cue('2891', 17.95, 0.0, 2.7, -16)
cue('0908', 18.3, 30.0, 8.3, -28, fi=0.6, fo=0.6, hp=120)               # high altitude air
cue('1798', 19.7, 0.0, 0.5, -12)
cue('1797', 20.55, 0.0, 0.54, -14)
cue('2892', 20.95, 0.0, 2.2, -18)
cue('1023', 21.25, 0.0, 1.5, -24, lp=260, fo=0.6)                       # soft landing on cloud
cue('1335', 22.74, 0.0, 0.8, -12)                                       # drop meets the keyhole
cue('2087', 22.78, 0.0, 2.1, -14)
cue('1674', 22.92, 0.6, 1.6, -11, fi=0.05, fo=0.3)                      # clockwork winding
cue('2816', 22.92, 0.25, 1.6, -22, fo=0.3)
cue('0795', 23.15, 15.8, 1.3, -11, fo=0.3)                              # ratchet
cue('1539', 23.8, 0.9, 1.4, -9, fo=0.3)                                 # bolts retract
cue('0378', 24.12, 11.05, 0.9, -11, fo=0.3)                             # lock clunk
cue('3205', 24.45, 0.05, 2.8, -9, fo=0.6)                               # the old door creaks open
cue('0306', 24.55, 0.3, 2.2, -16, fo=0.8)
cue('1109', 24.35, 4.0, 2.4, -14, fi=1.0, fo=0.6)                       # light pours out
cue('2687', 24.75, 20.0, 2.2, -16, fi=0.6, fo=0.8)
cue('0573', 25.95, 8.05, 0.8, -9)                                       # into the light
cue('1796', 26.3, 0.0, 1.1, -8)

# ---------------- SHOT 3: the ripple (26.52 - 34.70) ----------------
cue('0908', 26.5, 50.0, 2.2, -24, fi=0.3, fo=0.5, hp=120)
cue('2891', 26.62, 0.0, 2.7, -17)
cue('2086', 27.5, 0.0, 2.6, -15)                                        # the drop falls
cue('1521', 28.565, 0.0, 4.0, -6, fo=1.0)                                # IMPACT (music hit 28.56)
cue('1023', 28.575, 0.0, 2.5, -10, lp=380, fo=1.2)                       # deep low thump
cue('1110', 28.56, 0.0, 6.0, -10, fo=3.0)                               # resonant ring
cue('2687', 28.6, 60.0, 4.6, -15, fi=0.2, fo=2.2)                       # shimmer of the wave
cue('3576', 29.2, 30.0, 5.6, -27, fi=1.5, fo=0.6)                       # campus comes alive
cue('1417', 29.34, 0.0, 0.26, -16)                                      # kiosk / readers beep
cue('2066', 29.71, 0.0, 0.43, -15)                                      # terminal boots
cue('1417', 29.73, 0.0, 0.26, -14)
cue('1417', 29.89, 0.0, 0.26, -14, rate=1.12)
cue('3442', 29.98, 0.0, 0.68, -15)                                      # door strike buzz
cue('1803', 30.2, 17.6, 1.4, -18, fi=0.05, fo=0.4)                      # doors slide
cue('2066', 30.29, 0.0, 0.43, -17, rate=1.19)                           # muster point online
cue('0027', 30.42, 2.1, 0.6, -14)                                       # turnstile click
cue('0027', 30.9, 3.6, 0.6, -15)                                        # barrier
cue('1318', 30.1, 10.0, 4.7, -25, fi=1.2, fo=0.5)                       # people start moving

# ---------------- SHOT 4: alarm + muster (34.70 - 40.79) ----------------
for k in range(0, 7):                                                   # fire alarm bell (looped)
    cue('0268', 35.05 + k * 0.62, 0.0, 0.62 + 0.04, -9 if k else -8, fi=0.004, fo=0.03)
cue('3453', 35.35, 0.0, 0.9, -14)                                        # Jay: alert!
cue('2891', 35.85, 0.0, 2.7, -14)
cue('1319', 35.6, 3.0, 3.25, -15, fi=0.5, fo=0.35)                      # people running
cue('1318', 35.9, 20.0, 2.95, -20, fi=0.5, fo=0.35)
cue('0908', 36.0, 60.0, 2.9, -26, fi=0.4, fo=0.4, hp=150)
# counting up: one rising music-box note per lit segment of the muster ring
SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]
import random
N = 64; ALL_SAFE = 4.05; t0 = 34.70
rr = random.Random(1)
for k in range(12):
    need = int((k + 1) * N / 12 - 1e-6)
    x = (need - 1) / (N - 1)
    a = 1.5 + (ALL_SAFE - 1.5) * (x ** 0.85)
    cue('1867', t0 + a, 0.0, 0.9, -19 + k * 0.5, fo=0.4, rate=2 ** (SCALE[k] / 12))
cue('2531', 38.75, 0.0, 3.5, -12, fo=1.5)                               # ALL SAFE: bell
cue('2365', 38.75, 0.0, 3.0, -17, fo=1.0)
cue('0236', 38.82, 0.0, 3.2, -10, fo=1.0)                               # cheer
cue('0237', 39.4, 0.0, 4.2, -16, fo=1.6)
cue('1110', 38.75, 0.0, 6.0, -15, fo=3.0)
cue('2892', 38.95, 0.0, 2.2, -18)

# ---------------- SHOT 5: finale (40.79 - 60.13) ----------------
cue('1469', 40.6, 20.0, 19.4, -27, fi=1.5, fo=3.0)                      # night crickets
cue('1871', 43.0, 0.0, 1.5, -22)                                        # hello wave sparkle
cue('3453', 45.92, 0.0, 0.9, -19)                                       # a cheeky jay call...
cue('1871', 46.03, 0.0, 1.5, -15, rate=1.335)                           # ...and the wink
cue('2687', 49.3, 90.0, 8.4, -15, fi=2.0, fo=2.2)                       # lights lift off
cue('1109', 50.4, 6.0, 7.6, -19, fi=2.5, fo=2.5)
cue('2891', 52.55, 0.0, 2.7, -14)                                       # Jay soars
cue('1796', 53.1, 0.0, 1.1, -12)
cue('2079', 54.2, 0.0, 2.3, -11)                                        # the bird mark forms
cue('2086', 55.5, 0.0, 2.6, -13)
cue('1110', 55.7, 0.0, 4.4, -13, fo=2.5)
cue('2892', 57.25, 0.0, 2.2, -21)                                       # one bird flies past the mark
cue('2891', 58.15, 0.0, 2.0, -24, fo=0.8)
cue('1798', 57.6, 0.0, 0.5, -20)

def build():
    args = ['ffmpeg', '-y', '-v', 'error']
    fl = []
    # music: two segments butt-spliced on a downbeat
    args += ['-i', MUSIC, '-i', MUSIC]
    A0, A1, B0 = 4.13, 42.88, 163.22
    fl.append(f'[0:a]atrim={A0}:{A1},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.6,afade=t=out:st={A1-A0-0.05}:d=0.05,volume=0dB[mA]')
    fl.append(f'[1:a]atrim={B0}:{B0+FILM-(A1-A0)+0.5},asetpts=PTS-STARTPTS,aresample=48000,afade=t=in:st=0:d=0.03,volume=-3.5dB,afade=t=out:st={FILM-(A1-A0)-2.2}:d=2.2,adelay={int((A1-A0)*1000)}|{int((A1-A0)*1000)}[mB]')
    fl.append('[mA][mB]amix=inputs=2:normalize=0,volume=0dB[music]')
    labels = []
    for n, c in enumerate(C):
        args += ['-i', path(c['i'])]
        idx = n + 2
        dur = c['dur']
        rate = c['o'].get('rate', 1.0)
        f = [f'atrim={c["off"]}:{c["off"] + dur * rate}', 'asetpts=PTS-STARTPTS', 'aresample=48000', 'aformat=sample_fmts=fltp:channel_layouts=stereo']
        if rate != 1.0: f += [f'asetrate={48000 * rate:.0f}', 'aresample=48000']
        if 'lp' in c['o']: f.append(f'lowpass=f={c["o"]["lp"]}')
        if 'hp' in c['o']: f.append(f'highpass=f={c["o"]["hp"]}')
        g = c['g'] - peak(c['i'])
        f += [f'volume={g:.2f}dB', f'afade=t=in:st=0:d={c["fi"]}', f'afade=t=out:st={max(0, dur - c["fo"]):.3f}:d={c["fo"]}']
        d = int(round(c['at'] * 1000))
        f.append(f'adelay={d}|{d}')
        fl.append(f'[{idx}:a]' + ','.join(f) + f'[c{n}]')
        labels.append(f'[c{n}]')
    fl.append(''.join(labels) + f'amix=inputs={len(labels)}:normalize=0[sfx]')
    fl.append(f'[sfx]volume=0dB[sfxv]')
    fl.append(f'[music][sfxv]amix=inputs=2:normalize=0,atrim=0:{FILM},afade=t=out:st={FILM-1.2}:d=1.2,alimiter=limit=0.79:attack=2:release=60[out]')
    args += ['-filter_complex', ';'.join(fl), '-map', '[out]', '-ar', '48000', '-c:a', 'pcm_s24le', OUT + '.pre.wav']
    subprocess.run(args, check=True)
    # loudness normalise to -14 LUFS / -1 dBTP (two pass)
    r = subprocess.run(['ffmpeg', '-v', 'info', '-i', OUT + '.pre.wav', '-af', 'loudnorm=I=-14:TP=-2.8:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
    m = json.loads(r[r.rindex('{'):r.rindex('}') + 1])
    ln = f"loudnorm=I=-14:TP=-2.8:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true"
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', OUT + '.pre.wav', '-af', ln + ',aresample=48000', '-c:a', 'pcm_s24le', OUT], check=True)
    os.remove(OUT + '.pre.wav')
    print('cues', len(C), 'measured', m['input_i'], 'LUFS ->', OUT)

if __name__ == '__main__':
    build()
