// Reusable motion vocabulary for Jay.
import { clamp, smooth, wobble } from './anim.js';

// natural blinks at given times (seconds); returns lid openness 0..1
export function blinks(t, times, dur = 0.16) {
  let lid = 1;
  for (const b of times) { const x = (t - b) / dur; if (x > 0 && x < 1) lid = Math.min(lid, Math.abs(1 - 2 * x) ** 1.4); }
  return lid;
}
// idle breathing / secondary motion
export function idle(t, amt = 1) {
  const br = Math.sin(t * 2.1) * 0.012 * amt;
  return { body: [br * 0.5, 0, 0], bodyPos: [0, br * 0.6, 0], head: [Math.sin(t * 1.3) * 0.02 * amt, Math.sin(t * 0.7) * 0.04 * amt, Math.sin(t * 0.9) * 0.02 * amt], badge: [Math.sin(t * 2.3) * 0.03, 0, Math.sin(t * 1.7) * 0.05], tail: [Math.sin(t * 1.9) * 0.04, 0, 0] };
}
// flight: flap phase (cycles), glide 0..1 (1 = wings held out), bank (rad)
export function fly(t, { freq = 2.2, glide = 0, bank = 0, pitch = 0.85, look = 0 } = {}) {
  const ph = t * freq * Math.PI * 2;
  const f = (1 - glide);
  const s = Math.sin(ph), c = Math.cos(ph);
  const out = 1.2 + f * 0.75 * s + glide * 0.05 * Math.sin(t * 3);
  const arm = { out, fwd: -0.15 + f * 0.25 * c, twist: 0.0, bend: -f * 0.35 * Math.max(0, -s), wrist: [f * 0.35 * c, 1.45, f * -0.3 * s] };
  return {
    plant: false, tuck: 1,
    body: [pitch, 0, bank], bodyPos: [0, f * -0.08 * s, 0],
    torso: [0.0, 0, 0],
    head: [-pitch * 0.85 + look, 0, -bank * 0.5],
    armL: arm, armR: arm,
    tail: [0.35 + f * 0.1 * c, 0, 0],
    crest: [-0.15 - f * 0.08 * s, 0, 0],
    badge: [-pitch * 0.9 + 0.15 * s * f, 0, 0],
    jaw: 0.12,
  };
}
// landing impulse: squash/settle after touchdown at t=0
export function land(t) {
  if (t < 0) return { bodyPos: [0, 0, 0], body: [0, 0, 0] };
  const w = wobble(t, 2.2, 5.5);
  return { bodyPos: [0, -0.18 * Math.exp(-6 * t) + w * 0.04, 0], body: [0.25 * Math.exp(-5 * t), 0, 0] };
}
// merge pose objects: arrays add, objects merge recursively, scalars take latest
export function mergePose(...ps) {
  const out = {};
  for (const p of ps) {
    if (!p) continue;
    for (const k in p) {
      const v = p[k];
      if (Array.isArray(v)) { out[k] = out[k] ? out[k].map((x, i) => x + (v[i] || 0)) : v.slice(); }
      else if (v && typeof v === 'object') out[k] = mergePose(out[k] || {}, v);
      else out[k] = v;
    }
  }
  return out;
}
// blend two poses (numbers/arrays lerped), t in 0..1
export function blendPose(a, b, t) {
  const out = {};
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  for (const k of keys) {
    const va = a?.[k], vb = b?.[k];
    if (Array.isArray(va) || Array.isArray(vb)) { const A = va || [0, 0, 0], B = vb || [0, 0, 0]; out[k] = A.map((x, i) => x + ((B[i] ?? 0) - x) * t); }
    else if ((va && typeof va === 'object') || (vb && typeof vb === 'object')) out[k] = blendPose(va || {}, vb || {}, t);
    else if (typeof va === 'number' || typeof vb === 'number') out[k] = (va ?? (k === 'tuck' ? 0 : k === 'jaw' ? 0.22 : 0)) + ((vb ?? (k === 'tuck' ? 0 : k === 'jaw' ? 0.22 : 0)) - (va ?? (k === 'tuck' ? 0 : k === 'jaw' ? 0.22 : 0))) * t;
    else out[k] = t < 0.5 ? va : vb;
  }
  return out;
}
export const ss = (t, a, b) => smooth(clamp((t - a) / (b - a)));
