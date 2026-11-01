# jay cloud — "The Wingman" (60 s, 1080p24)

A one-minute 3D animated film about Jay, the jay cloud mascot. No text, no templates: every
model, shader, animation and camera move is generated from code in this folder and rendered
frame by frame.

## v2 (current cut): Jay via Higgsfield

Feedback on v1 was that the code-built Jay looked poor and a bit scary, and that Jay is not a giant.
In v2 every shot of Jay acting is a Higgsfield clip: a GPT Image 2.5 keyframe made from the mascot
reference, animated with Kling 3.0 pro. Jay is child-height among people. The shots without Jay are still
rendered by this engine with `--nojay 1`. That covers the lock waking, the drop falling into the plaza pool
and the wave of light, the alarm, and the lights rising into the bird mark (the ending is unchanged apart
from Jay's fly-past). The music edit and hit points are the same as v1, and the sound effects are re-spotted
in `audio/mix_v2.py`.

```bash
./render_v2_segments.sh      # Jay-less rendered segments -> out/v2/*.mp4
python3 audio/mix_v2.py      # soundtrack -> audio/mix_v2.wav
python3 edit_v2.py           # conform + mux -> out/jay-cloud_the-wingman_v2_60s_1080p(.mp4|_web.mp4)
```

| Time | Shot | Source |
|---|---|---|
| 0:00 | Dawn on the lake; light gathers on the water | render |
| 0:05 | Jay wakes on a stone and catches a rising drop of the lake | Higgsfield |
| 0:10 | He flies off low over the water | Higgsfield |
| 0:16 | Over the golden cloud sea to the 1908 door | Higgsfield |
| 0:21 | The drop wakes the lock: gears, bolts | render |
| 0:22 | The door opens; Jay flies into the light | Higgsfield |
| 0:26 | The drop falls into the plaza pool; the wave wakes every door, reader and turnstile | render |
| 0:34 | Alarm; everyone streams to the muster point | render |
| 0:36 | Muster point: Jay reassures everyone; on the climax, all safe | Higgsfield |
| 0:40 | Jay's hello | Higgsfield |
| 0:47 | The campus lights lift off and become the jay cloud bird mark | render |

## Story (told only with pictures)

| Time | Shot | Idea from the jay cloud / Poksundo story |
|---|---|---|
| 0:00–0:16 | **Phoksundo.** Dawn on a turquoise Himalayan lake. Light gathers, the water rises and becomes Jay; the water runs off and his fur fluffs up. The lake hands him one glowing drop. | Poksundo is named after Phoksundo Lake in Nepal — the deep-blue lake at 3,600 m. Jay's blue comes from it. |
| 0:16–0:26 | **Heritage.** Jay bursts through a sea of golden clouds to a monumental 1908 door: oak, wrought-iron strap hinges, a brass lock with exposed precision gears. The drop wakes the lock; the door opens into light. | Roots in a 1908 merger of a Swiss locksmith and a German door-hinge maker; spun off in 2017 as a SaaS company (dormakaba → Poksundo). |
| 0:26–0:35 | **One change. Every system knows.** A grey, frozen miniature workplace. Jay drops the drop into the plaza pool on the music's big hit; a wave of light runs out and threads arc from the pool to every reader, door, terminal, kiosk, turnstile and window. People start moving. | "When HR moves, your workplace moves with it." Time · Access · Visitor, driven by one HR record. |
| 0:35–0:41 | **Know who's here. Know who's safe.** Night. The alarm turns everything red; everyone streams to the muster point as trails of light while Jay flies over; the count ring fills note by note and on the climax beat the last person is accounted for — all green. | Life Safety: evacuation accountability without paper lists. |
| 0:41–1:00 | **One bird. One connected workplace.** Jay turns to camera and waves (and winks). The camera rises; every light in the campus lifts off and gathers in the night sky into the jay cloud bird mark; Jay flies past it. | "Every workplace needs a wingman." |

## How it is made

- **Renderer:** three.js (r170) running in headless Chromium on a software GPU (SwiftShader),
  driven frame-by-frame by `render.mjs` (Playwright) and piped raw into ffmpeg.
- **Jay:** built from signed-distance fields meshed with Surface Nets (`src/sdf.js`, `src/jay.js`),
  painted per vertex (blue crown, white face, black bridle and eyeliner), with
  instanced shell fur lit per vertex (`src/fur.js`), glossy eyes with procedural iris and eyelids,
  a fleece hoodie with logo decal, zipper teeth, lanyard and badge, feathered wing-hands and a hierarchical
  rig with planted feet (`pose()` API, `src/jaypose.js`).
- **Worlds:** procedural ridged-noise Himalaya with baked sun visibility (alpenglow) and aerial
  perspective, mirror lake with ripples (`src/lake.js`); cellular-noise cloud sea and the 1908 door
  (`src/clouds.js`); miniature campus with a shared activation "wave" uniform, light threads,
  light-painting evacuation trails and a 1,400-mote logo formation (`src/campus.js`, `src/shots/`).
- **Post:** MSAA HDR → SSAO → bokeh depth of field → bloom mip-chain + anamorphic streak →
  AgX tone mapping, split-tone grade, vignette, grain (`src/post.js`). Motion blur via
  sub-frame accumulation on fast shots.
- **Sound:** `audio/mix.py` edits the music on bar lines (track 4.13–42.88 s + 163.22 s–end, cut on a
  downbeat so the climax lands on "all safe") and places ~100 real recorded sound effects frame-accurately,
  then loudness-normalises to −14 LUFS / −1 dBTP. No sound is synthesised.

## Re-render

```bash
npm install                 # three@0.170.0
./render_final.sh           # all shots at 1920x1080, then concat + mux
./render_final.sh ripple    # a single shot
node render.mjs still --shot finale --t 4.0 --w 1920 --h 1080   # stills for look-dev
```

See `CREDITS.md` for asset licences.
