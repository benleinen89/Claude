#!/usr/bin/env bash
# Renders every shot at 1080p24 (MSAA 4, 16 fur shells), concatenates them and muxes the soundtrack.
# Usage: ./render_final.sh [shot ...]   (default: all shots)
set -euo pipefail
cd "$(dirname "$0")"
W=${W:-1920}; H=${H:-1080}; SHELLS=${SHELLS:-16}; MSAA=${MSAA:-4}
SHOTS=${@:-lake sky ripple alarm finale}
mkdir -p out/final
for s in $SHOTS; do
  echo "=== $s"
  node render.mjs video --shot "$s" --w $W --h $H --fps 24 --msaa $MSAA --shells $SHELLS --crf 12 --out "out/final/$s.mp4" 2>&1 | grep --line-buffered -v "GPU stall\|toNonIndexed"
done
printf "file '%s'\n" lake.mp4 sky.mp4 ripple.mp4 alarm.mp4 finale.mp4 > out/final/list.txt
ffmpeg -v error -y -f concat -safe 0 -i out/final/list.txt -c copy out/final/video.mp4
python3 audio/mix.py
ffmpeg -v error -y -i out/final/video.mp4 -i audio/mix.wav -map 0:v -map 1:a -c:v libx264 -preset slow -crf 16 -pix_fmt yuv420p -tune film -movflags +faststart -c:a aac -b:a 320k -shortest out/jay-cloud_the-wingman_60s_1080p.mp4
echo done
