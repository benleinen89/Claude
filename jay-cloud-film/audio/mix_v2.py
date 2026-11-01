#!/usr/bin/env python3
"""v2 soundtrack: same music edit as v1, sound effects re-spotted to the v2 cut
(Jay's acting shots are Higgsfield/Kling clips; the in-between shots are rendered).

Music: "Born of the Sky" by Scott Buckley (CC-BY 4.0) - www.scottbuckley.com.au
SFX:   BigSoundBank.com by Joseph Sardin (CC0). Real recordings only; nothing is synthesised.

v2 edit (film seconds):
  0.00  lake (render)        5.50  Jay wakes, catches the drop      10.54  flight over the lake
 16.33  cloud sea -> door    21.05 the drop wakes the lock (render) 22.76  door opens, into the light
 26.54  drop -> pool -> wave (render, impact 28.56)                  34.71  alarm, streams to muster (render)
 36.71  muster point, all safe at 38.75                              40.79  Jay's hello
 47.83  lights lift off and become the bird mark (render) -> 60.13
"""
import os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mix
from mix import C, cue

C.clear()
mix.OUT = os.path.join(mix.HERE, 'mix_v2.wav')

# ---------------- lake at dawn: render (0 - 5.5) + Jay wakes (5.5 - 10.54) + flight (10.54 - 16.33) ----------------
cue('1906', 0.0, 40.0, 16.6, -30, fi=3.0, fo=1.2)                      # dawn birds
cue('2754', 0.0, 20.0, 16.6, -36, fi=3.0, fo=1.2, lp=2200)              # distant mountain stream
cue('0908', 0.0, 10.0, 17.0, -34, fi=2.5, fo=1.0, hp=120)               # soft mountain air
cue('1109', 3.4, 2.0, 5.8, -20, fi=2.2, fo=1.8)                         # light gathers on the water: singing bowl
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

# ---------------- cloud sea -> the door (16.33 - 21.05) ----------------
cue('0154', 14.9, 6.0, 5.6, -23, fi=1.0, fo=1.0, hp=150)                # wind while climbing
cue('1796', 16.36, 0.0, 1.1, -9)                                         # bursts out over the cloud sea
cue('0908', 16.33, 30.0, 6.6, -28, fi=0.4, fo=0.6, hp=120)              # high-altitude air
cue('2892', 16.55, 0.0, 2.2, -15)
cue('2891', 18.0, 0.0, 2.7, -17)
cue('1871', 19.2, 0.0, 1.5, -24)                                        # the drop's glow on the door
cue('2892', 19.6, 0.0, 2.2, -18)

# ---------------- the 1908 lock wakes (21.05 - 22.76, render) ----------------
cue('1335', 21.03, 0.0, 0.8, -12)                                       # drop meets the keyhole
cue('2087', 21.05, 0.0, 2.1, -14)
cue('1674', 21.18, 0.6, 1.6, -11, fi=0.05, fo=0.3)                      # clockwork winding
cue('2816', 21.18, 0.25, 1.6, -22, fo=0.3)
cue('0795', 21.41, 15.8, 1.3, -11, fo=0.3)                              # ratchet
cue('1539', 22.06, 0.9, 1.4, -9, fo=0.3)                                # bolts retract
cue('0378', 22.38, 11.05, 0.9, -11, fo=0.3)                             # lock clunk

# ---------------- the door opens; into the light (22.76 - 26.54) ----------------
cue('3205', 22.5, 0.05, 2.8, -10, fo=0.6)                               # the old door creaks open
cue('0306', 22.62, 0.3, 2.2, -17, fo=0.8)
cue('1109', 22.55, 4.0, 2.6, -14, fi=0.8, fo=0.6)                       # light pours out
cue('2687', 22.8, 20.0, 2.6, -16, fi=0.6, fo=0.8)
cue('2891', 23.15, 0.0, 2.7, -14)                                       # he darts in
cue('1796', 23.5, 0.0, 1.1, -10)
cue('0573', 24.85, 8.05, 0.8, -9)                                       # into the light
cue('1110', 25.2, 0.0, 3.0, -17, fo=1.5)
cue('1796', 26.3, 0.0, 1.1, -8)

# ---------------- the drop falls; one change, every system knows (26.54 - 34.71, render) ----------------
cue('0908', 26.5, 50.0, 2.2, -24, fi=0.3, fo=0.5, hp=120)
cue('1798', 26.6, 0.0, 0.5, -15)
cue('2086', 26.95, 0.0, 2.6, -14)                                       # the drop falls
cue('1521', 28.565, 0.0, 4.0, -6, fo=1.0)                                # IMPACT (music hit 28.56)
cue('1023', 28.575, 0.0, 2.5, -10, lp=380, fo=1.2)                       # deep low thump
cue('1110', 28.56, 0.0, 6.0, -10, fo=3.0)                               # resonant ring
cue('2687', 28.6, 60.0, 4.6, -15, fi=0.2, fo=2.2)                       # shimmer of the wave
cue('3576', 29.2, 30.0, 5.6, -27, fi=1.5, fo=0.6)                       # campus comes alive
cue('1417', 30.9, 0.0, 0.26, -16)                                       # readers turn green as the light lines arrive
cue('2066', 31.25, 0.0, 0.43, -16)                                      # terminals wake
cue('1417', 31.45, 0.0, 0.26, -15)
cue('3442', 31.6, 0.0, 0.68, -16)                                       # door strike
cue('1803', 31.8, 17.6, 1.4, -17, fi=0.05, fo=0.4)                      # glass doors slide open
cue('1318', 31.6, 10.0, 3.1, -23, fi=1.0, fo=0.5)                       # people start walking
cue('1417', 32.1, 0.0, 0.26, -16, rate=1.12)
cue('0027', 32.6, 2.1, 0.6, -16)                                        # gate
cue('2066', 33.0, 0.0, 0.43, -18, rate=1.19)                            # muster point online
cue('0027', 33.4, 3.6, 0.6, -17)

# ---------------- alarm (34.71 - 36.71, render) -> muster point (36.71 - 40.79) ----------------
for k in range(0, 5):                                                   # fire alarm bell (looped), dies away on the cut
    cue('0268', 34.71 + k * 0.62, 0.0, 0.66, [-8, -9, -9, -11, -15][k], fi=0.004, fo=0.03)
cue('1319', 34.71, 3.0, 2.3, -15, fi=0.2, fo=0.5)                       # people moving out
cue('1318', 34.75, 20.0, 2.2, -20, fi=0.3, fo=0.5)
cue('0908', 34.71, 60.0, 2.2, -27, fi=0.3, fo=0.4, hp=150)
SCALE = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19]                       # the muster ring counts everyone in
for k in range(12):
    x = k / 11
    cue('1867', 34.85 + 1.8 * (x ** 0.8), 0.0, 0.9, -19 + k * 0.5, fo=0.4, rate=2 ** (SCALE[k] / 12))
cue('1469', 36.71, 20.0, 23.42, -27, fi=0.8, fo=3.0)                    # night crickets, to the end
cue('2892', 36.85, 0.0, 2.2, -19)                                       # Jay raises a wing: "you're all here"
cue('2531', 38.75, 0.0, 3.5, -12, fo=1.5)                               # ALL SAFE: bell (music climax)
cue('2365', 38.75, 0.0, 3.0, -17, fo=1.0)
cue('0236', 38.62, 0.0, 3.2, -11, fo=1.0)                               # relief: applause and cheers
cue('0237', 39.3, 0.0, 4.2, -16, fo=1.6)
cue('1110', 38.75, 0.0, 6.0, -15, fo=3.0)

# ---------------- Jay's hello (40.79 - 47.83) ----------------
cue('2754', 40.79, 60.0, 7.1, -31, fi=0.4, fo=0.4, lp=3000)             # the plaza fountain
cue('1871', 41.1, 0.0, 1.5, -21)                                        # hello wave sparkle
cue('2892', 41.9, 0.0, 2.2, -21)
cue('3453', 45.55, 0.0, 0.9, -18)                                       # a joyful jay call...
cue('0237', 45.9, 1.0, 2.6, -21, fi=0.2, fo=1.0)                        # ...and the crowd cheers with him
cue('2891', 46.1, 0.0, 2.0, -20, fo=0.6)

# ---------------- the lights lift off and become the bird mark (47.83 - 60.13, render) ----------------
cue('2687', 49.3, 90.0, 8.4, -15, fi=2.0, fo=2.2)                       # lights lift off
cue('1109', 50.4, 6.0, 7.6, -19, fi=2.5, fo=2.5)
cue('1796', 52.7, 0.0, 1.1, -14)                                        # they swirl up into the sky
cue('1800', 53.2, 0.0, 0.9, -17)
cue('2079', 54.2, 0.0, 2.3, -11)                                        # the bird mark forms
cue('2086', 55.5, 0.0, 2.6, -14)
cue('1110', 55.7, 0.0, 4.4, -13, fo=2.5)
cue('1867', 56.9, 0.0, 2.0, -22, rate=1.335)                            # it settles and twinkles
cue('2891', 53.5, 0.0, 2.7, -16)                                        # Jay (rigged 3D) climbs through the lights
cue('2892', 57.2, 0.0, 2.2, -20)                                        # ...and makes one pass in front of the bird mark
cue('1798', 57.75, 0.0, 0.5, -19)
cue('3454', 58.05, 0.0, 0.68, -23)                                      # a small happy call as he goes by
cue('2891', 58.4, 0.0, 2.0, -24, fo=0.8)

if __name__ == '__main__':
    mix.build()
