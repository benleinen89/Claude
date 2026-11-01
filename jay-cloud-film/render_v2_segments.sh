#!/usr/bin/env bash
# v2: renders the Jay-less in-between segments (Jay himself comes from the Higgsfield clips in hf/clips).
# Frame-exact ranges (24 fps) — see edit_v2.py for where each lands in the film.
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p out/v2
R() { echo "=== $1"; node render.mjs video --shot "$2" --from "$3" --to "$4" --nojay 1 ${G:+--gjay 1} --w 1920 --h 1080 --fps 24 --msaa 4 --shells 4 --crf 12 --out "out/v2/$1.mp4" 2>&1 | grep --line-buffered -v "GPU stall\|toNonIndexed"; }
R gears  sky    6.458333  8.166667   # 41 frames: the drop wakes the 1908 lock
R ripple ripple 0         8.166667   # 196 frames: drop falls, wave of light, campus wakes
R alarm  alarm  1.708333  3.708333   # 48 frames: alarm, everyone streams to the muster point
G=1 R finale finale 7.041667  19.333333  # 295 frames: lights lift off and become the bird mark; rigged Jay climbs and flies past
echo segments done
