// Entry: sets up renderer + post, builds shots, exposes deterministic __render(t).
import * as THREE from 'three';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';
import { Post } from './post.js';
import { Jay } from './jay.js';
import { JU, shFromEquirect } from './fur.js';
import { SHOTS, EXTRA } from './shots/index.js';

const qs = new URLSearchParams(location.search);
const W = +qs.get('w') || 1920, H = +qs.get('h') || 1080;
const MSAA = qs.has('msaa') ? +qs.get('msaa') : 4;
const SHELLS = qs.has('shells') ? +qs.get('shells') : 20;
const ONLY = qs.get('shot');

const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, alpha: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1);
renderer.setSize(W, H);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.NoToneMapping;
renderer.outputColorSpace = THREE.LinearSRGBColorSpace; // final pass writes display values itself
document.body.appendChild(renderer.domElement);

const post = new Post(renderer, W, H, { samples: MSAA });
const pmrem = new THREE.PMREMGenerator(renderer);
const hdrCache = {};
const SUNS = { // brightest direction in each HDRI (measured offline), unrotated
  belfast_sunset_puresky: [0.791, 0.035, 0.611], kiara_1_dawn: [0.691, 0.069, 0.719], kloofendal_48d_partly_cloudy_puresky: [0.555, 0.742, 0.377],
  kloppenheim_06_puresky: [0.756, 0.081, 0.650], qwantani_dusk_2_puresky: [0.763, 0.182, 0.620], rogland_clear_night: [0.815, 0.557, -0.161], studio_small_08: [0.553, 0.418, 0.721],
};
// yaw (radians) rotates the sky about +Y; use scene.backgroundRotation/environmentRotation = (0, yaw, 0)
async function loadHDR(name, yaw = 0) {
  const key = name + '@' + yaw.toFixed(4);
  if (!hdrCache[key]) {
    let base = hdrCache[name];
    if (!base) {
      const tex = await new RGBELoader().loadAsync(`/assets/hdri/${name}.hdr`);
      tex.mapping = THREE.EquirectangularReflectionMapping;
      const env = pmrem.fromEquirectangular(tex).texture;
      base = hdrCache[name] = { tex, env };
    }
    const s0 = SUNS[name] || [0, 1, 0];
    const c = Math.cos(yaw), si = Math.sin(yaw);
    const sun = new THREE.Vector3(s0[0] * c + s0[2] * si, s0[1], -s0[0] * si + s0[2] * c);
    hdrCache[key] = { ...base, sh: shFromEquirect(base.tex, yaw), sun, yaw };
  }
  return hdrCache[key];
}
// yaw needed to bring an HDRI's sun to a desired azimuth (direction vector x,z)
function yawFor(name, dx, dz) { const s0 = SUNS[name]; return Math.atan2(s0[2], s0[0]) - Math.atan2(dz, dx); }
function applySky(scene, hdr, { bg = true, envInt = 1, bgInt = 1, shMul = null } = {}) {
  scene.environment = hdr.env; scene.environmentIntensity = envInt; scene.environmentRotation.set(0, hdr.yaw, 0);
  if (bg) { scene.background = hdr.tex; scene.backgroundIntensity = bgInt; scene.backgroundRotation.set(0, hdr.yaw, 0); }
  scene.userData.sh = hdr.sh; scene.userData.equirect = hdr.tex; scene.userData.shMul = shMul ?? envInt;
}

const ctx = { THREE, renderer, W, H, loadHDR, yawFor, applySky, pmrem, JU, msaa: MSAA > 0, shells: SHELLS, qs };
let timeline = [];

window.__ready = (async () => {
  const jay = new Jay();
  await jay.build({ shells: SHELLS, msaa: MSAA > 0, quality: +(qs.get('q') || 1) });
  ctx.jay = jay; window.__jay = jay;
  let t0 = 0;
  for (const S of (ONLY && EXTRA.some((e) => e.name === ONLY) ? EXTRA : SHOTS)) {
    if (ONLY && S.name !== ONLY) { t0 += S.dur; continue; }
    await S.init(ctx);
    timeline.push({ S, t0, t1: t0 + S.dur });
    t0 += S.dur;
  }
  // compile everything up front
  for (const e of timeline) { e.S.update(0, e.t0); renderer.compile(e.S.scene, e.S.camera); }
  return { duration: t0, shots: timeline.map((e) => [e.S.name, e.t0, e.t1]) };
})();

let frameNo = 0;
window.__render = (t, fps = 24) => {
  const e = timeline.find((x) => t >= x.t0 - 1e-6 && t < x.t1 - 1e-6) || timeline[timeline.length - 1];
  const lt = t - e.t0;
  // post params from the shot at the exact frame time
  const P = e.S.update(lt, t) || {};
  if (qs.get('dbgcam')) { const v = qs.get('dbgcam').split(',').map(Number); e.S.camera.position.set(v[0], v[1], v[2]); e.S.camera.up.set(0, 1, 0); e.S.camera.lookAt(v[3], v[4], v[5]); if (v[6]) { e.S.camera.fov = v[6]; e.S.camera.updateProjectionMatrix(); } P.aperture = 0; }
  if (qs.get('hide')) for (const n of qs.get('hide').split(',')) e.S.scene.traverse((o) => { if (o.userData.tag === n) o.visible = false; });
  if (ctx.jay) ctx.jay.setShells(Math.round(Math.min(SHELLS, P.shells ?? SHELLS)));
  if (qs.get('nojay') && ctx.jay) { ctx.jay.root.visible = false; for (const e2 of timeline) e2.S.drop && (e2.S.drop.visible = e2.S.drop.visible); }
  const shutter = P.shutter ?? 0.5; // fraction of frame
  const subs = P.subframes || 1;
  post.render((i, n) => {
    if (n > 1) {
      const dt = ((i + 0.5) / n - 0.5) * shutter / fps;
      e.S.update(lt + dt, t + dt);
      if (qs.get('nojay') && ctx.jay) ctx.jay.root.visible = false;
    }
    JU.uTime.value = t;
    return { scene: e.S.scene, camera: e.S.camera };
  }, { ...P, frame: frameNo++ });
  return true;
};

window.__grab = () => {
  const gl = renderer.getContext();
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  // base64 in chunks
  let s = '';
  const CH = 0x8000;
  for (let i = 0; i < px.length; i += CH) s += String.fromCharCode.apply(null, px.subarray(i, i + CH));
  return btoa(s);
};
window.__stats = () => { let v = 0, t = 0, n = 0; window.__jay?.root.traverse((o) => { if (o.isMesh) { n++; const g = o.geometry; const ic = g.isInstancedBufferGeometry ? g.instanceCount : 1; v += g.attributes.position.count * ic; t += (g.index ? g.index.count / 3 : g.attributes.position.count / 3) * ic; } }); return { meshes: n, verts: v, tris: t }; };
