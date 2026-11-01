#!/usr/bin/env python3
"""v2 conform: cuts the Higgsfield Jay clips and the rendered Jay-less segments together,
frame-accurate at 24 fps (1443 frames = 60.125 s), then muxes audio/mix_v2.wav.

Run ./render_v2_segments.sh and python3 audio/mix_v2.py first.
"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

AI = 'scale=1931:1080:flags=lanczos,crop=1920:1080,noise=alls=3:allf=t'   # Kling clips are 1924x1076
RN = 'null'
# (source, first frame, frame count, filter)
EDIT = [
    ('out/final/lake.mp4', 0, 132, RN),          #  0.000  dawn on the lake, light gathers
    ('hf/clips/c1.mp4',    0, 121, AI),          #  5.500  Jay wakes and catches the drop
    ('hf/clips/c2.mp4',    0, 139, AI),          # 10.542  flight over the lake
    ('hf/clips/c3.mp4',    0, 113, AI),          # 16.333  over the cloud sea to the door
    ('out/v2/gears.mp4',   0,  41, RN),          # 21.042  the drop wakes the 1908 lock
    ('hf/clips/c4.mp4',   30,  91, AI),          # 22.750  the door opens; into the light
    ('hf/clips/c7.mp4',    0, 196, AI + ',fade=t=in:st=0:d=0.25:color=white'),  # 26.542  drop -> pool (splash f49 = 28.58) -> wave of light
    ('out/v2/alarm.mp4',   0,  48, RN),          # 34.708  alarm; everyone streams to the muster point
    ('hf/clips/c5.mp4',    5,  98, AI),          # 36.708  muster point: all safe (38.75)
    ('hf/clips/c6.mp4',    0, 169, AI),          # 40.792  Jay's hello
    ('out/v2/finale.mp4',  0, 295, RN),          # 47.833  lights lift off -> the bird mark
]

def main():
    total = sum(n for _, _, n, _ in EDIT)
    assert total == 1443, total
    args = ['ffmpeg', '-y', '-v', 'error']
    fl = []
    for k, (src, a, n, f) in enumerate(EDIT):
        args += ['-i', src]
        fl.append(f'[{k}:v]trim=start_frame={a}:end_frame={a + n},setpts=PTS-STARTPTS,fps=24,{f},format=yuv420p,setsar=1[v{k}]')
    fl.append(''.join(f'[v{k}]' for k in range(len(EDIT))) + f'concat=n={len(EDIT)}:v=1:a=0[v]')
    os.makedirs('out/v2', exist_ok=True)
    vid = 'out/v2/video.mp4'
    subprocess.run(args + ['-filter_complex', ';'.join(fl), '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'film', '-pix_fmt', 'yuv420p', vid], check=True)
    master = 'out/jay-cloud_the-wingman_v2_60s_1080p.mp4'
    web = 'out/jay-cloud_the-wingman_v2_60s_1080p_web.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-i', 'audio/mix_v2.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '320k', '-shortest', master], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-i', 'audio/mix_v2.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '8M', '-bufsize', '16M', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', web], check=True)
    print('wrote', master, 'and', web)

if __name__ == '__main__':
    main()
