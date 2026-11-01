// Tiny deterministic animation toolkit.
import * as THREE from 'three';

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const prog = (t, a, b) => clamp((t - a) / (b - a));
export const smooth = (x) => x * x * (3 - 2 * x);
export const smoother = (x) => x * x * x * (x * (x * 6 - 15) + 10);
export const easeOut = (x, p = 3) => 1 - Math.pow(1 - x, p);
export const easeIn = (x, p = 3) => Math.pow(x, p);
export const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const backOut = (x, s = 1.70158) => 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2);
export const elasticOut = (x) => (x === 0 || x === 1 ? x : Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * (2 * Math.PI) / 3) + 1);
// damped spring response to a step at t=0 (0 -> 1 with overshoot)
export const spring = (t, freq = 3, damp = 4) => (t <= 0 ? 0 : 1 - Math.exp(-damp * t) * Math.cos(freq * 2 * Math.PI * t));
// decaying wobble after an impulse at t=0
export const wobble = (t, freq = 4, damp = 5) => (t <= 0 ? 0 : Math.exp(-damp * t) * Math.sin(freq * 2 * Math.PI * t));

// scalar keyframes: [[t, v, ease?], ...] ; ease applies to the segment ending at that key
export function kf(t, keys, defEase = smooth) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    if (t <= keys[i][0]) {
      const [t0, v0] = keys[i - 1], [t1, v1, e] = keys[i];
      const x = (t - t0) / (t1 - t0);
      return lerp(v0, v1, (e || defEase)(x));
    }
  }
  return keys[keys.length - 1][1];
}
// vector keyframes through a centripetal Catmull-Rom spline with time remapping
export function spline(points) {
  const c = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
  return c;
}
export function kfv(t, keys, defEase = smooth) { // keys: [[t, [x,y,z], ease?]]
  const out = [0, 0, 0];
  for (let k = 0; k < 3; k++) out[k] = kf(t, keys.map(([tt, v, e]) => [tt, v[k], e]), defEase);
  return new THREE.Vector3(...out);
}
// camera helper: set position/target/fov/roll
export function setCam(cam, pos, target, fov = null, roll = 0) {
  cam.position.copy(pos);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(target);
  if (fov) { cam.fov = fov; cam.updateProjectionMatrix(); }
}
// smooth noise for handheld camera shake (deterministic)
export function shake(t, seed = 0, f = 1.3) {
  const n = (x) => Math.sin(x) * 0.5 + Math.sin(x * 2.17 + 1.3) * 0.3 + Math.sin(x * 4.73 + 2.1) * 0.2;
  return new THREE.Vector3(n(t * f + seed), n(t * f * 1.1 + seed + 10), n(t * f * 0.9 + seed + 20));
}
export function rngf(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }
