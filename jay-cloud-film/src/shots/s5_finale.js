// SHOT 5 — "One bird. One connected workplace." Calm returns. Jay turns to us and
// waves. The camera rises; every light in the campus lifts off as a mote and they
// gather in the night sky into the jay cloud bird mark.
import * as THREE from 'three';
import { CU, LAYOUT } from '../campus.js';
import { nightScene } from './night.js';
import { loadLogo } from '../jay.js';
import { kf, prog, smooth, easeOut, easeIn, easeInOut, setCam, shake, clamp, lerp, rngf, wobble } from '../anim.js';
import { fly, idle, blinks, mergePose, blendPose, ss } from '../jaypose.js';
import { GJay, gFly } from '../gjay.js';

const LOGO_C = new THREE.Vector3(0, 40, -22), LOGO_S = 24;
const N = 1400;

function inPoly(x, y, poly) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }

const shot = {
  name: 'finale', dur: 19.34,
  async init(ctx) {
    this.ctx = ctx;
    const { scene, campus, arcs } = await nightScene(ctx, { moonInt: 0.7 });
    // v2: the rigged Higgsfield Jay (animated here) replaces the code-built one for the climb and the fly-past
    if (ctx.qs.get('gjay')) {
      this.g = await new GJay().load('/assets/jay_rig.glb'); this.g.map(); scene.add(this.g.root);
      this.gLight = new THREE.PointLight(0xc4d6ff, 0, 9, 2); scene.add(this.gLight);   // his own soft key, like the motes lighting him
    }
    this.scene = scene; this.campus = campus; this.arcs = arcs;
    const logo = await loadLogo();
    const r = rngf(77);
    // targets: 75% fill, 25% outline
    const tgts = [];
    const outline = logo.flatMap((p) => p);
    while (tgts.length < N * 0.72) { const x = r() - 0.5, y = r() - 0.5; if (logo.some((p) => inPoly(x, y, p))) tgts.push([x, y, 0]); }
    while (tgts.length < N) { const p = outline[Math.floor(r() * outline.length)]; tgts.push([p[0], p[1], 1]); }
    // sources: windows, lamps, devices, pool, paths
    const hq = LAYOUT.hq, fc = LAYOUT.factory;
    const src = () => {
      const k = r();
      if (k < 0.4) return [hq.x + (r() - 0.5) * hq.w, 0.3 + r() * 2.3, hq.z + hq.d / 2 + 0.05];
      if (k < 0.55) return [fc.x + (r() - 0.5) * fc.w, 1.5 + r() * 0.4, fc.z + (r() - 0.5) * fc.d];
      if (k < 0.7) { const a = r() * 6.283; return [LAYOUT.pool.x + Math.cos(a) * 1.9 * r(), 0.1, LAYOUT.pool.y + Math.sin(a) * 1.9 * r()]; }
      return [(r() - 0.5) * 30, 0.2 + r() * 0.6, (r() - 0.5) * 22];
    };
    this.P = tgts.map((tg) => {
      const s = new THREE.Vector3(...src());
      const e = new THREE.Vector3(LOGO_C.x + tg[0] * LOGO_S, LOGO_C.y + tg[1] * LOGO_S, LOGO_C.z + (r() - 0.5) * 0.6);
      const c1 = s.clone().add(new THREE.Vector3((r() - 0.5) * 6, 6 + r() * 10, (r() - 0.5) * 6));
      const c2 = e.clone().add(new THREE.Vector3((r() - 0.5) * 18, -10 - r() * 10, 6 + r() * 8));
      return { s, e, c1, c2, t0: 8.6 + r() * 2.6 + (s.y > 1 ? 0 : 0.6), t1: 13.0 + r() * 2.4, out: tg[2], ph: r() * 6.28, sz: 0.6 + r() * 0.8 };
    });
    const g = new THREE.BufferGeometry();
    this.pos = new Float32Array(N * 3); this.col = new Float32Array(N * 3); this.size = new Float32Array(N);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.col, 3)); g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.points = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, vertexColors: true,
      uniforms: { uScale: { value: ctx.H * 0.5 } },
      vertexShader: 'attribute float aSize; varying vec3 vC; uniform float uScale; void main(){ vC = color; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aSize * uScale / -mv.z; gl_Position = projectionMatrix * mv; }',
      fragmentShader: 'varying vec3 vC; void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d); float a = exp(-r * r * 22.0) + 0.25 * exp(-r * r * 5.0); if (a < 0.01) discard; gl_FragColor = vec4(vC * a, a); }',
    }));
    this.points.frustumCulled = false; this.points.renderOrder = 12; scene.add(this.points);
    // constellation outline that draws on
    const lines = [];
    for (const poly of logo) { for (let i = 0; i < poly.length; i += 3) { const a = poly[i], b = poly[(i + 3) % poly.length]; lines.push(LOGO_C.x + a[0] * LOGO_S, LOGO_C.y + a[1] * LOGO_S, LOGO_C.z, LOGO_C.x + b[0] * LOGO_S, LOGO_C.y + b[1] * LOGO_S, LOGO_C.z); } }
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    const ord = new Float32Array(lines.length / 3); for (let i = 0; i < ord.length; i++) ord[i] = i / ord.length; lg.setAttribute('aO', new THREE.BufferAttribute(ord, 1));
    this.lineU = { uP: { value: 0 }, uA: { value: 0 } };
    this.outline = new THREE.LineSegments(lg, new THREE.ShaderMaterial({ uniforms: this.lineU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: 'attribute float aO; varying float vO; void main(){ vO = aO; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform float uP, uA; varying float vO; void main(){ if (vO > uP) discard; gl_FragColor = vec4(vec3(0.6, 1.2, 3.0) * uA, uA); }' }));
    scene.add(this.outline);
    this.camera = new THREE.PerspectiveCamera(32, ctx.W / ctx.H, 0.1, 600);
  },
  update(t) {
    const { campus, ctx } = this; const jay = ctx.jay;
    this.scene.add(campus.root); this.scene.add(jay.root);
    CU.uTime.value = t + 20; CU.uWaveR.value = 999; CU.uNight.value = 1 - 0.6 * ss(t, 9, 13); CU.uAlarm.value = 0;
    for (const d of campus.devices) { d.led.material.color.setRGB(0.15, 2.2, 0.6); if (d.kind === 'door') { d.leaves[0].position.x = -0.21; d.leaves[1].position.x = 0.21; } if (d.kind === 'turnstile') d.arms.rotation.x = 0; }
    campus.updateFlags(t); campus.barrier.rotation.z = 0;
    campus.musterSegs.forEach((m) => (m.material.opacity = 0.5 * (1 - ss(t, 0, 3))));
    // people strolling back, calmly
    const r = rngf(5);
    for (let i = 0; i < campus.N; i++) {
      const a0 = r() * 6.283, rad = 2.6 + r() * 3, sp = (0.12 + r() * 0.1) * (i % 2 ? 1 : -1);
      const a = a0 + t * sp / rad;
      const x = LAYOUT.pool.x + Math.cos(a) * rad * 1.4, z = LAYOUT.pool.y + Math.sin(a) * rad;
      const hide = i % 4 === 0;
      campus.setPerson(i, hide ? 0 : x, hide ? -60 : z, a + (sp > 0 ? 0 : Math.PI), t * Math.abs(sp) * 9, 0, hide ? 0.0001 : 1);
    }
    campus.commitPeople();
    // ---------------- Jay ----------------
    const jStand = new THREE.Vector3(0.8, 0, 6.2);
    let pose, jp = jStand.clone(), yaw = lerp(-0.9, 0.34, ss(t, 0.5, 1.6));
    const wave = ss(t, 2.0, 2.4) * (1 - ss(t, 5.2, 5.7));
    const wv = Math.sin((t - 2.0) * 2 * Math.PI * 1.6);
    const ground = mergePose(idle(t), {
      head: [kf(t, [[0.5, 0.05], [1.4, -0.06], [3, -0.02]]), kf(t, [[0.5, -0.7], [1.6, 0.0], [5.8, 0.05], [6.6, -0.25]]), kf(t, [[1.6, 0], [2.4, 0.16], [5.5, 0.1], [6.2, 0]])],
      eyes: [kf(t, [[0.5, -0.3], [1.5, 0]]), 0.02], jaw: kf(t, [[1.0, 0.18], [1.8, 0.42], [5.5, 0.4], [6.5, 0.3]]),
      lidL: Math.min(blinks(t, [1.2, 6.4]), 1 - ss(t, 5.15, 5.3) * (1 - ss(t, 5.55, 5.7))), lidR: blinks(t, [1.2, 6.4]),
      armL: { out: lerp(0.05, 1.15, wave), bend: lerp(0, 1.5, wave) + wave * 0.18 * wv, wrist: [0, wave * 0.4, wave * 0.25 * wv] },
      armR: { out: 0.1, fwd: 0.05 },
      torso: [0, 0.08 * wave, -0.03 * wave * wv],
      badge: [0, 0, 0.05 * wave * wv],
    });
    const tUp = 11.9;
    if (t < tUp) pose = ground;
    else if (t < 16.3) {
      const k = clamp((t - tUp) / 2.4);
      pose = blendPose(ground, fly(t, { freq: 2.4, pitch: 0.35, look: 0.6 }), ss(t, tUp, tUp + 0.3));
      jp = jStand.clone().add(new THREE.Vector3(-2 * easeIn(k), easeIn(k, 2) * 42, 6 * easeIn(k, 1.5)));
      yaw = lerp(0.34, -0.3, k);
    } else {
      // a final pass in front of the constellation: one bird, flying past the bird mark
      const k = clamp((t - 16.3) / 2.6);
      pose = fly(t, { freq: 1.6, glide: ss(t, 17.0, 17.4) * (1 - ss(t, 18.2, 18.5)), pitch: 0.15, bank: -0.15 });
      jp = new THREE.Vector3(lerp(19, -19, k), 33.5 + Math.sin(k * Math.PI) * 2.5, -8);
      yaw = -Math.PI / 2;
    }
    jay.pose(pose); jay.root.position.copy(jp); jay.root.rotation.set(0, yaw, 0); jay.root.scale.setScalar(t > 16.3 ? 1.1 : 0.85);
    jay.root.visible = t < tUp + 2.6 || t > 16.3;
    if (this.g) {
      const g = this.g; this.scene.add(g.root);
      // he appears once he is above the roofs (never a giant among the people) and climbs with the lights;
      // the bird mark then forms on its own
      const up = t >= tUp + 0.85 && t < tUp + 2.6;
      g.root.visible = up; this.gLight.intensity = 0;
      if (up) {
        const k = clamp((t - tUp) / 2.4);
        g.pose(gFly(t, { freq: 2.6, amp: 0.6 })); g.body.rotation.x = lerp(0.5, 0.9, k);
        g.root.position.copy(jp); g.root.rotation.set(0, -0.3 + 0.2 * k, 0); g.root.scale.setScalar(lerp(1.7, 2.6, ss(k, 0.35, 0.8)));
        this.gLight.position.copy(jp).add(new THREE.Vector3(0.5, 2.5, 4)); this.gLight.intensity = 260 * ss(t, tUp + 0.85, tUp + 1.1);
      }
      g.root.updateMatrixWorld(true);
    }
    // ---------------- motes -> logo ----------------
    const tmp = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      const p = this.P[i];
      let k = clamp((t - p.t0) / (p.t1 - p.t0));
      const e = easeInOut(k);
      const a = p.s, b = p.c1, c = p.c2, d = p.e; const u = 1 - e;
      tmp.set(0, 0, 0).addScaledVector(a, u * u * u).addScaledVector(b, 3 * u * u * e).addScaledVector(c, 3 * u * e * e).addScaledVector(d, e * e * e);
      if (k >= 1) tmp.add(new THREE.Vector3(Math.sin(t * 1.3 + p.ph) * 0.05, Math.cos(t * 1.1 + p.ph) * 0.05, 0));
      this.pos[i * 3] = tmp.x; this.pos[i * 3 + 1] = tmp.y; this.pos[i * 3 + 2] = tmp.z;
      const born = ss(t, p.t0 - 0.4, p.t0 + 0.2);
      const settled = ss(t, p.t1 - 0.3, p.t1 + 0.4);
      const tw = 0.75 + 0.25 * Math.sin(t * 4 + p.ph * 3);
      const warm = [2.4, 1.6, 0.8], blue = p.out ? [1.6, 2.6, 5.0] : [0.5, 1.2, 4.2];
      const fade = 1 - ss(t, 18.3, 19.2);
      for (let c2 = 0; c2 < 3; c2++) this.col[i * 3 + c2] = lerp(warm[c2], blue[c2], settled) * born * tw * fade;
      this.size[i] = p.sz * (p.out ? 0.75 : 1.0) * (0.5 + 0.5 * born) * (1 + 0.6 * ss(t, p.t1, p.t1 + 0.3) * (1 - ss(t, p.t1 + 0.3, p.t1 + 1.2)));
    }
    this.points.geometry.attributes.position.needsUpdate = true; this.points.geometry.attributes.color.needsUpdate = true; this.points.geometry.attributes.aSize.needsUpdate = true;
    this.lineU.uP.value = ss(t, 14.8, 16.6); this.lineU.uA.value = 0.6 * (1 - ss(t, 18.3, 19.2));
    // ---------------- camera ----------------
    const cam = this.camera; let P = {};
    if (t < 7.0) {
      const k = t / 7.0;
      const pos = new THREE.Vector3(lerp(2.6, 2.1, k), lerp(2.25, 2.15, k), lerp(11.4, 10.1, easeOut(k))).add(shake(t, 15, 0.5).multiplyScalar(0.012));
      setCam(cam, pos, jStand.clone().add(new THREE.Vector3(lerp(0.2, 0.35, wave), 2.05, 0)), 30);
      P = { focus: pos.distanceTo(jStand.clone().add(new THREE.Vector3(0, 2.2, 0.3))), aperture: 7.5, maxCoc: 14 };
    } else {
      const k = easeInOut(clamp((t - 7.0) / 7.5));
      const k2 = easeInOut(clamp((t - 11.5) / 5));
      const pos = new THREE.Vector3(lerp(1.3, 3, k), lerp(2.15, 13, k), lerp(10.1, 36, k));
      const tgt = new THREE.Vector3(lerp(0.9, 0, k), lerp(2.05, 0, k), lerp(6.2, -2, k)).lerp(LOGO_C, k2);
      setCam(cam, pos.add(shake(t, 16, 0.4).multiplyScalar(0.05)), tgt, lerp(30, 44, k));
      P = { focus: pos.distanceTo(tgt), aperture: lerp(7.5, 0.5, k), maxCoc: 12 };
      // v2 (Jay-less): no one stands in the foreground, so hold focus on the fountain plaza
      if (ctx.qs.get('nojay')) P = { focus: pos.distanceTo(new THREE.Vector3(0, 0.4, 1.5)), aperture: lerp(3.0, 0.5, k), maxCoc: 10 };
    }
    return { ...P, subframes: (t > 11.9 && t < 14.6) || t > 16.3 ? 2 : 1, shells: t < 7 ? 16 : 10, exposure: 1.1, bloom: 0.16 + 0.12 * ss(t, 12, 15), vignette: 0.5, sat: 1.15, contrast: 1.1, ao: 0.8, aoRadius: 0.6, tintShadow: [0.88, 0.93, 1.15], tintHigh: [1.06, 1.0, 0.94], fade: ss(t, 18.6, 19.3) };
  },
};
export default shot;
