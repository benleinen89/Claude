# jay cloud — "The Wingman" (60 s, 1080p24)

A one-minute 3D animated film about Jay, the jay cloud mascot. No text, no templates: every
model, shader, animation and camera move is generated from code in this folder and rendered
frame by frame.

## v3 (current cut): one story, carried by a drop of light

v3 tightens v2 into a single cause-and-effect story. The glowing drop the lake gives Jay is the thread:
he carries it through the door in the clouds and lets it fall into a grey, frozen workplace. On the music
hit it wakes everything up and connects every door, reader and person. That night the same connected
campus gets everyone out safely. Then Jay takes off, the campus lights rise with him, and they become the
jay cloud bird mark: the ending from v1/v2, unchanged.

Every shot is now a Higgsfield clip (GPT Image 2.5 keyframe from the mascot reference, then Kling 3.0 pro)
except the bird-mark finale, which is rendered by this engine. The music edit and its two hits
(splash at 28.56 s, "all safe" at 38.75 s) are the same as v1/v2. Sound effects are spotted in `audio/mix_v3.py`.

```bash
node render.mjs video --shot finale --from 13.875 --to 16.0 --nojay 1 --out out/v2/finale_mid.mp4 ...   # see edit_v3.py
python3 audio/mix_v3.py      # soundtrack -> audio/mix_v3.wav
python3 edit_v3.py           # conform + mux -> out/jay-cloud_the-wingman_v3_60s_1080p(.mp4|_web.mp4)
```

| Time | Beat | Source |
|---|---|---|
| 0:00 | Dawn on the lake: Jay asleep on the shore, light gathering under the water | Higgsfield (cA) |
| 0:05 | Jay wakes; the lake gives him a glowing drop | Higgsfield (c1) |
| 0:10 | He takes off over the water | Higgsfield (c2) |
| 0:16 | Across the cloud sea to the door | Higgsfield (c3) |
| 0:20 | The door opens for him; he flies into the light | Higgsfield (c4) |
| 0:23 | Out of the light, high above a grey, frozen campus; he lets the drop go | Higgsfield (cB) |
| 0:27 | The drop hits the pool on the music hit; light races out, colour floods back, every door, reader and person wakes up and connects | Higgsfield (c7) |
| 0:34 | That night: the alarm. Jay guides everyone out of the building | Higgsfield (cC) |
| 0:37 | Muster point: everyone is accounted for; "all safe" on the climax | Higgsfield (c5) |
| 0:40 | Jay's hello | Higgsfield (c6) |
| 0:46 | He takes off and the campus lights rise with him into the night sky | Higgsfield (cD) |
| 0:54 | The lights become the jay cloud bird mark | render |

v2 (`edit_v2.py`, `audio/mix_v2.py`, `render_v2_segments.sh`) and the rigged 3D Jay (`src/gjay.js`) are kept for reference.

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
