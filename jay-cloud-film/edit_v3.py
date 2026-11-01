#!/usr/bin/env python3
"""v3 conform: one story, told with the drop.

  The lake gives Jay a drop of light -> he carries it across the sky, through the door in the clouds ->
  arrives above a grey, frozen workplace and lets it fall -> on the music hit it wakes everything up and
  connects it -> that night the alarm sounds; Jay guides everyone out -> all safe at the muster point ->
  Jay says hello, takes off, and the lights of the campus rise with him and become the jay cloud bird mark.

Frame-accurate at 24 fps (1443 frames = 60.125 s); muxes audio/mix_v3.wav. Needs hf/clips/c*.mp4,
out/v2/finale_mid.mp4 and out/v2/finale_tail.mp4 (finale local 13.875 -> 19.333, no Jay).
"""
import os, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
os.chdir(HERE)

AI = 'scale=1931:1080:flags=lanczos,crop=1920:1080,noise=alls=3:allf=t'   # Kling clips are 1924x1076
RN = 'null'
WHITE_IN = ',fade=t=in:st=0:d=0.25:color=white'
# (source, first frame, frame count, filter)                film time
EDIT = [
    ('hf/clips/cA.mp4',    0, 132, AI),                    #  0.000  dawn on the lake; Jay asleep on the shore; light gathers under the water
    ('hf/clips/c1.mp4',    0, 121, AI),                    #  5.500  Jay wakes; the lake gives him a glowing drop
    ('hf/clips/c2.mp4',    0, 139, AI),                    # 10.542  he takes off over the lake
    ('hf/clips/c3.mp4',    0,  96, AI),                    # 16.333  across the cloud sea to the door
    ('hf/clips/c4.mp4',   24,  84, AI),                    # 20.333  the door is open; he flies into the light
    ('hf/clips/cB.mp4',    8,  77, AI + WHITE_IN),         # 23.833  out of the light, above a grey, frozen campus; he lets the drop go
    ('hf/clips/c7.mp4',   12, 169, AI + ',fade=t=out:st=6.79:d=0.25'),                    # 27.042  the drop falls; splash on the music hit (28.58); everything wakes and connects
    ('hf/clips/cC.mp4',    0,  77, AI + ',fade=t=in:st=0:d=0.25'),                    # 34.083  that night: alarm; Jay guides everyone out
    ('hf/clips/c5.mp4',   16,  84, AI),                    # 37.292  muster point: all safe (38.75)
    ('hf/clips/c6.mp4',    0, 132, AI),                    # 40.792  Jay's hello
    ('hf/clips/cD.mp4',    0, 217, AI),                    # 46.292  he takes off; the campus lights rise with him
    ('out/v2/finale_mid.mp4',  4, 47, RN),                 # 54.833  (0.5 s dissolve) the lights become the bird mark (finale local 14.04)
    ('out/v2/finale_tail.mp4', 0, 80, RN),                 # 56.792  the bird mark holds, fades
]
XFADE_AT = 10          # dissolve from EDIT[10] (take-off) into the rest
XFADE_FRAMES = 12

def main():
    total = sum(n for _, _, n, _ in EDIT) - XFADE_FRAMES
    assert total == 1443, total
    args = ['ffmpeg', '-y', '-v', 'error']
    fl = []
    for k, (src, a, n, f) in enumerate(EDIT):
        args += ['-i', src]
        fl.append(f'[{k}:v]trim=start_frame={a}:end_frame={a + n},setpts=PTS-STARTPTS,fps=24,{f},format=yuv420p,setsar=1[v{k}]')
    X = XFADE_AT
    fl.append(''.join(f'[v{k}]' for k in range(X)) + f'concat=n={X}:v=1:a=0[head]')
    fl.append(''.join(f'[v{k}]' for k in range(X + 1, len(EDIT))) + f'concat=n={len(EDIT) - X - 1}:v=1:a=0,settb=1/24,fps=24[rest]')
    off = (EDIT[X][2] - XFADE_FRAMES) / 24
    fl.append(f'[v{X}]settb=1/24,fps=24[vx]')
    fl.append(f'[vx][rest]xfade=transition=fade:duration={XFADE_FRAMES / 24}:offset={off}[tail]')
    fl.append('[head]settb=1/24,fps=24[head24]')
    fl.append('[head24][tail]concat=n=2:v=1:a=0[v]')
    os.makedirs('out/v3', exist_ok=True)
    vid = 'out/v3/video.mp4'
    subprocess.run(args + ['-filter_complex', ';'.join(fl), '-map', '[v]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-tune', 'film', '-pix_fmt', 'yuv420p', vid], check=True)
    master = 'out/jay-cloud_the-wingman_v3_60s_1080p.mp4'
    web = 'out/jay-cloud_the-wingman_v3_60s_1080p_web.mp4'
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-i', 'audio/mix_v3.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '320k', '-shortest', master], check=True)
    subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', vid, '-i', 'audio/mix_v3.wav', '-map', '0:v', '-map', '1:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '8M', '-bufsize', '16M', '-tune', 'film', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '192k', '-shortest', web], check=True)
    print('wrote', master, 'and', web)

if __name__ == '__main__':
    main()
