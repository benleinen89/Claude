#!/usr/bin/env python3
"""v3 soundtrack: same music edit as v1/v2 (impact 28.56, all safe 38.75), sound effects spotted to the
v3 story cut in edit_v3.py.

Music: "Born of the Sky" by Scott Buckley (CC-BY 4.0) - www.scottbuckley.com.au
SFX:   BigSoundBank.com by Joseph Sardin (CC0). Real recordings only; nothing is synthesised.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mix
from mix import C, cue

C.clear()
mix.OUT = os.path.join(mix.HERE, 'mix_v3.wav')

# ---------------- the lake (0 - 16.33): Jay asleep, the gift of the drop, take-off ----------------
cue('1906', 0.0, 40.0, 16.6, -30, fi=3.0, fo=1.2)                      # dawn birds
cue('2754', 0.0, 20.0, 16.6, -36, fi=3.0, fo=1.2, lp=2200)              # distant mountain stream
cue('0908', 0.0, 10.0, 17.0, -34, fi=2.5, fo=1.0, hp=120)               # soft mountain air
cue('1109', 2.6, 2.0, 6.6, -20, fi=2.4, fo=1.8)                         # light gathers under the water: singing bowl
cue('2080', 6.55, 0.0, 1.5, -18)                                        # his eyes open
cue('1335', 6.95, 0.0, 0.8, -17)                                        # a drop lifts off the lake
cue('2079', 7.1, 0.0, 2.3, -13)                                         # ...and rises
cue('1110', 8.6, 0.0, 6.0, -20, fo=4.0)                                 # resonant ring
cue('1867', 9.45, 0.0, 2.0, -20)                                        # it settles over his wing
cue('2891', 10.5, 0.0, 2.7, -12)                                        # take-off wings
cue('1529', 10.62, 0.0, 1.5, -12)                                       # wingtip skims the water
cue('3454', 11.25, 0.0, 0.68, -18)                                      # a happy jay call
cue('1529', 12.02, 0.2, 1.3, -15)
cue('2892', 12.6, 0.0, 2.2, -15)
cue('1529', 13.6, 0.0, 1.4, -13)
cue('1796', 14.55, 0.0, 1.1, -10)                                       # climbs past camera
cue('1800', 14.8, 0.0, 0.9, -13)

# ---------------- the cloud sea and the door (16.33 - 23.83) ----------------
cue('0154', 14.9, 6.0, 5.6, -23, fi=1.0, fo=1.0, hp=150)                # wind while climbing
cue('1796', 16.36, 0.0, 1.1, -9)                                         # bursts out over the cloud sea
cue('0908', 16.33, 30.0, 7.6, -28, fi=0.4, fo=0.6, hp=120)              # high-altitude air
cue('2892', 16.55, 0.0, 2.2, -15)
cue('2891', 18.0, 0.0, 2.7, -17)
cue('1871', 19.2, 0.0, 1.5, -24)                                        # the glow on the door
cue('3205', 20.05, 0.05, 2.8, -10, fo=0.6)                              # the old door creaks open for him
cue('0306', 20.2, 0.3, 2.2, -17, fo=0.8)
cue('1109', 20.15, 4.0, 2.8, -14, fi=0.6, fo=0.6)                       # light pours out
cue('2687', 20.4, 20.0, 3.0, -16, fi=0.6, fo=0.8)
cue('2891', 21.0, 0.0, 2.7, -14)                                        # he darts in
cue('1796', 21.4, 0.0, 1.1, -10)
cue('0573', 22.35, 8.05, 0.8, -9)                                       # into the light
cue('1110', 22.7, 0.0, 3.0, -17, fo=1.5)

# ---------------- the delivery (23.83 - 27.04): out of the light above a grey, frozen campus ----------------
cue('1796', 23.75, 0.0, 1.1, -8)                                         # out of the light
cue('0908', 23.8, 50.0, 3.8, -24, fi=0.3, fo=0.5, hp=120)               # wind high over the campus
cue('2892', 24.05, 0.0, 2.2, -16)
cue('2079', 25.95, 0.0, 2.3, -14)                                       # he lets the drop go
cue('2086', 26.6, 0.0, 2.6, -14)                                        # it falls

# ---------------- one change, every system knows (27.04 - 34.08) ----------------
cue('1521', 28.565, 0.0, 4.0, -6, fo=1.0)                                # IMPACT (music hit 28.56)
cue('1023', 28.575, 0.0, 2.5, -10, lp=380, fo=1.2)                       # deep low thump
cue('1110', 28.56, 0.0, 6.0, -10, fo=3.0)                               # resonant ring
cue('2687', 28.6, 60.0, 4.6, -15, fi=0.2, fo=2.2)                       # shimmer of the wave
cue('3576', 29.2, 30.0, 4.9, -27, fi=1.5, fo=0.6)                       # campus comes alive
cue('1417', 30.9, 0.0, 0.26, -16)                                       # readers turn green as the light lines arrive
cue('2066', 31.25, 0.0, 0.43, -16)                                      # terminals wake
cue('1417', 31.45, 0.0, 0.26, -15)
cue('3442', 31.6, 0.0, 0.68, -16)                                       # door strike
cue('1803', 31.8, 17.6, 1.4, -17, fi=0.05, fo=0.4)                      # glass doors slide open
cue('1318', 31.6, 10.0, 2.5, -23, fi=1.0, fo=0.5)                       # people start walking
cue('1417', 32.1, 0.0, 0.26, -16, rate=1.12)
cue('0027', 32.6, 2.1, 0.6, -16)                                        # gate
cue('2066', 33.0, 0.0, 0.43, -18, rate=1.19)                            # muster point online
cue('0027', 33.4, 3.6, 0.6, -17)

# ---------------- that night: the alarm (34.08 - 37.29) -> all safe (37.29 - 40.79) ----------------
for k in range(0, 6):                                                   # fire alarm bell (looped), dies down as they reach safety
    cue('0268', 34.08 + k * 0.62, 0.0, 0.66, [-8, -9, -9, -10, -12, -16][k], fi=0.004, fo=0.03)
cue('1469', 34.08, 20.0, 26.04, -27, fi=0.8, fo=3.0)                    # night crickets, to the end
cue('1319', 34.15, 3.0, 3.2, -16, fi=0.2, fo=0.6)                       # people walking out
cue('1318', 34.2, 20.0, 3.0, -21, fi=0.3, fo=0.6)
cue('3453', 34.9, 0.0, 0.9, -19)                                        # Jay: this way!
SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]                       # each person counted in at the muster point
for k in range(12):
    x = k / 11
    cue('1867', 35.6 + 2.9 * (x ** 0.8), 0.0, 0.9, -20 + k * 0.5, fo=0.4, rate=2 ** (SCALE[k] / 12))
cue('2892', 37.4, 0.0, 2.2, -19)                                        # Jay raises a wing: "you're all here"
cue('2531', 38.75, 0.0, 3.5, -12, fo=1.5)                               # ALL SAFE: bell (music climax)
cue('2365', 38.75, 0.0, 3.0, -17, fo=1.0)
cue('0236', 38.62, 0.0, 3.2, -11, fo=1.0)                               # relief: applause and cheers
cue('0237', 39.3, 0.0, 4.2, -16, fo=1.6)
cue('1110', 38.75, 0.0, 6.0, -15, fo=3.0)

# ---------------- hello, and up into the sky (40.79 - 54.67) ----------------
cue('2754', 40.79, 60.0, 6.2, -31, fi=0.4, fo=0.8, lp=3000)             # the plaza fountain
cue('1871', 41.1, 0.0, 1.5, -21)                                        # hello wave sparkle
cue('2892', 41.9, 0.0, 2.2, -21)
cue('3453', 45.55, 0.0, 0.9, -18)                                       # a joyful jay call
cue('0237', 45.6, 1.0, 2.2, -22, fi=0.2, fo=1.0)
cue('2891', 47.05, 0.0, 2.7, -13)                                       # he takes off
cue('1796', 47.6, 0.0, 1.1, -11)
cue('2687', 47.4, 90.0, 9.0, -15, fi=1.8, fo=2.2)                       # the campus lights lift off with him
cue('1109', 48.6, 6.0, 8.0, -19, fi=2.5, fo=2.5)
cue('1796', 51.4, 0.0, 1.1, -14)                                        # they swirl up into the sky
cue('1800', 52.4, 0.0, 0.9, -17)

# ---------------- the bird mark (54.67 - 60.13, render) ----------------
cue('2079', 54.55, 0.0, 2.3, -11)                                       # the lights become the bird mark
cue('2086', 55.5, 0.0, 2.6, -14)
cue('1110', 55.7, 0.0, 4.4, -13, fo=2.5)
cue('1867', 56.9, 0.0, 2.0, -22, rate=1.335)                            # it settles and twinkles

if __name__ == '__main__':
    mix.build()
