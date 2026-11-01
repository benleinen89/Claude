// SHOT 4 — "Know who's here. Know who's safe." Night. The alarm goes red. Everyone
// streams out to the muster point as trails of light while Jay flies over; the count
// ring fills, and on the climax beat the last person is accounted for: all green.
import * as THREE from 'three';
import { CU, LAYOUT } from '../campus.js';
import { nightScene, Trails } from './night.js';
import { kf, prog, smooth, easeOut, easeIn, easeInOut, setCam, shake, clamp, lerp, rngf, spring, wobble } from '../anim.js';
import { fly, idle, land, blinks, mergePose, blendPose, ss } from '../jaypose.js';
import { radialTex } from '../props.js';

export const ALL_SAFE = 4.05;   // local time of the last person counted (film 38.75)
const ALARM = 0.35;
const M = LAYOUT.muster;

function poly(pts) { const c = new THREE.CurvePath(); for (let i = 1; i < pts.length; i++) c.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1][0], 0, pts[i - 1][1]), new THREE.Vector3(pts[i][0], 0, pts[i][1]))); return c; }

const shot = {
  name: 'alarm', dur: 6.09,
  async init(ctx) {
    this.ctx = ctx;
    const { scene, campus, arcs } = await nightScene(ctx, { moonInt: 0.8 });
    this.scene = scene; this.campus = campus; this.arcs = arcs;
    // red beacons
    this.beacons = [];
    for (const p of [[LAYOUT.hq.x + 3.6, 2.62, LAYOUT.hq.z + 1.6], [LAYOUT.factory.x - 3.8, 2.0, LAYOUT.factory.z + 2.2]]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.01, 0.01) }));
      b.position.set(...p); scene.add(b);
      const l = new THREE.PointLight(0xff2a1a, 0, 22, 1.6); l.position.set(p[0], p[1] + 0.3, p[2] + 0.4); scene.add(l);
      const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(), color: new THREE.Color(3, 0.2, 0.1), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
      h.position.set(...p); h.scale.setScalar(1.5); scene.add(h);
      this.beacons.push({ b, l, h });
    }
    this.greenLight = new THREE.PointLight(0x30ff90, 0, 16, 1.5); this.greenLight.position.set(M.x, 1.2, M.y); scene.add(this.greenLight);
    this.burst = new THREE.Mesh(new THREE.RingGeometry(0.9, 1.0, 96), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.5, 1.2), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.burst.rotation.x = -Math.PI / 2; this.burst.position.set(M.x, 0.04, M.y); scene.add(this.burst);
    // evacuation plan
    const sources = [
      [[-6.5, -3.6], [-6.5, -0.8], [-7.6, 2.5], [-8.4, 5.4]],
      [[5.2, -3.6], [4.5, -1.0], [1.5, 3.2], [-3.5, 5.2], [-7.0, 6.5]],
      [[12.5, 7.4], [6.0, 6.4], [-2.0, 6.8], [-6.6, 7.9]],
    ];
    const r = rngf(42); const N = campus.N;
    const order = Array.from({ length: N }, (_, i) => i).sort(() => r() - 0.5);
    const speed = 1.55;
    this.plan = [];
    for (let i = 0; i < N; i++) {
      const src = sources[i % 3];
      const row = Math.floor(i / 16), k = i % 16;
      const ang = (k / 16) * Math.PI * 2 + row * 0.2 + 0.4;
      const rad = 0.55 + row * 0.33;
      const slot = [M.x + Math.cos(ang) * rad, M.y + Math.sin(ang) * rad];
      const path = poly([...src, slot]);
      const L = path.getLength();
      const rank = order.indexOf(i);
      const A = 1.5 + (ALL_SAFE - 1.5) * Math.pow(rank / (N - 1), 0.85);
      this.plan.push({ path, L, A, start: A - L / speed, speed, slot, face: Math.atan2(M.x - slot[0], M.y - slot[1]) });
    }
    this.trails = new Trails(N, 10); scene.add(this.trails.mesh);
    this.camera = new THREE.PerspectiveCamera(34, ctx.W / ctx.H, 0.1, 500);
  },
  update(t) {
    const { campus, ctx } = this; const jay = ctx.jay;
    this.scene.add(campus.root); this.scene.add(jay.root);
    CU.uTime.value = t; CU.uWaveR.value = 999; CU.uNight.value = 1;
    const safeK = ss(t, ALL_SAFE, ALL_SAFE + 0.9);
    const alarm = ss(t, ALARM, ALARM + 0.15) * (1 - safeK);
    CU.uAlarm.value = alarm; CU.uAlarmT.value = t;
    // devices: doors held open, readers green, turnstiles free
    for (const d of campus.devices) { d.led.material.color.setRGB(0.15, 2.2, 0.6); if (d.kind === 'door') { d.leaves[0].position.x = -0.57; d.leaves[1].position.x = 0.57; } }
    campus.barrier.rotation.z = 1.35; campus.updateFlags(t);
    const strobe = Math.pow(0.5 + 0.5 * Math.sin(t * 9.5), 3);
    for (const B of this.beacons) { B.l.intensity = alarm * (12 + 30 * strobe); B.b.material.color.setRGB(0.3 + 4 * alarm * strobe, 0.02, 0.02); B.h.material.opacity = alarm * (0.3 + 0.7 * strobe); B.h.scale.setScalar(1 + 2.5 * strobe * alarm); }
    this.greenLight.intensity = safeK * 18 * (1 - 0.5 * ss(t, ALL_SAFE + 0.5, 6));
    const bk = clamp((t - ALL_SAFE) / 1.3); this.burst.visible = t > ALL_SAFE;
    this.burst.scale.setScalar(1.5 + easeOut(bk) * 14); this.burst.material.opacity = (1 - bk) * 1.2;
    // people
    let arrived = 0;
    const posAt = (p, tt) => {
      const s = (tt - p.start) * p.speed;
      if (s <= 0) return null;
      if (s >= p.L) return [p.slot[0], p.slot[1], 0];
      const q = p.path.getPointAt(s / p.L); return [q.x, q.z, 1];
    };
    for (let i = 0; i < campus.N; i++) {
      const p = this.plan[i];
      const a = posAt(p, t);
      if (!a) { campus.setPerson(i, 0, -50, 0, 0, 0, 0.0001); continue; }
      if (a[2] === 0) arrived++;
      let rot = p.face, ph = 0, lift = 0;
      if (a[2]) { const b = posAt(p, t + 0.05) || a; rot = Math.atan2(b[0] - a[0], b[1] - a[1]); ph = (t - p.start) * p.speed * 9; }
      if (t > ALL_SAFE) { const j = t - ALL_SAFE - (i % 5) * 0.06; lift = j > 0 && j < 0.5 ? Math.sin(j / 0.5 * Math.PI) * 0.09 : 0; }
      campus.setPerson(i, a[0], a[1], rot, ph, lift);
    }
    campus.commitPeople();
    this.trails.update((i, k) => { const p = this.plan[i]; const a = posAt(p, t - k * 0.06); if (!a) { const z = posAt(p, t) || [0, -50]; return [z[0], z[1], 0]; } const sNow = (t - p.start) * p.speed; const fin = 1 - ss(sNow, p.L - 1.6, p.L - 0.6); return [a[0], a[1], (a[2] ? 1 : 0.0) * fin * (1 - safeK)]; });
    this.trails.mat.uniforms.uColor.value.setRGB(1.8 * (1 - safeK) + 0.3 * safeK, 1.1 + 0.9 * safeK, 0.4 + 0.5 * safeK);
    const segs = Math.floor((arrived / campus.N) * 12 + 1e-6);
    campus.musterSegs.forEach((m, i) => { const on = i < segs ? 1 : 0; m.material.opacity = on * (0.85 + 0.15 * Math.sin(t * 6 + i)) + (t > ALL_SAFE ? 0.4 * (1 - bk) : 0); });
    // ---------------- Jay ----------------
    const jStand = new THREE.Vector3(2.4, 0, 5.2), jLand = new THREE.Vector3(-6.9, 0, 4.9);
    let jp, pose, yaw;
    if (t < 1.25) {
      jp = jStand;
      pose = mergePose(idle(t), {
        head: [kf(t, [[0.5, 0], [0.75, -0.18]]), kf(t, [[0.5, 0.15], [0.8, -0.85]]), 0],
        eyes: [kf(t, [[0.5, 0], [0.8, -0.3]]), -0.1], lid: blinks(t, [0.95]), jaw: kf(t, [[0.5, 0.25], [0.8, 0.08]]),
        armL: { out: kf(t, [[0.6, 0], [1.0, 0.5]]) }, armR: { out: kf(t, [[0.6, 0], [1.0, 0.5]]) },
        bodyPos: [0, -0.25 * ss(t, 0.95, 1.2), 0],
      });
      yaw = -0.4;
    } else if (t < ALL_SAFE + 0.25) {
      const k = (t - 1.25) / (ALL_SAFE + 0.25 - 1.25);
      jp = new THREE.Vector3(lerp(jStand.x, jLand.x, easeInOut(k)), Math.sin(k * Math.PI) * 6.5 + (1 - k) * 0, lerp(jStand.z, jLand.z, easeInOut(k)));
      pose = fly(t, { freq: 2.6, glide: ss(t, 2.0, 2.5) * (1 - ss(t, 3.4, 3.8)), pitch: 0.7, bank: kf(t, [[1.3, 0.2], [2.5, -0.15], [3.6, 0.1]]) });
      yaw = Math.atan2(jLand.x - jStand.x, jLand.z - jStand.z);
    } else {
      jp = jLand;
      const lt = t - ALL_SAFE - 0.25;
      pose = mergePose(idle(t), land(lt), {
        head: [kf(t, [[4.4, 0.1], [4.9, -0.1]]), kf(t, [[4.4, 0], [5.0, 0.35]]), 0], lid: blinks(t, [5.4]), jaw: kf(t, [[4.4, 0.2], [4.8, 0.45]]),
        armL: { out: kf(t, [[4.4, 0.8], [4.7, 1.25], [6.1, 1.3]]), bend: kf(t, [[4.4, 0], [4.8, 1.4]]), wrist: [0, kf(t, [[4.6, 0], [4.9, 0.5]]), 0] },
        armR: { out: kf(t, [[4.4, 0.8], [4.8, 0.15]]) },
      });
      pose = blendPose(fly(t, { pitch: 0.3 }), pose, ss(t, ALL_SAFE + 0.1, ALL_SAFE + 0.4));
      yaw = -0.95;
    }
    jay.pose(pose);
    jay.root.position.copy(jp); jay.root.rotation.set(0, yaw, 0); jay.root.scale.setScalar(0.85);
    // ---------------- camera ----------------
    const cam = this.camera; let P = {};
    if (t < 1.25) {
      const k = t / 1.25;
      const pos = new THREE.Vector3(lerp(5.6, 5.0, k), lerp(2.0, 1.9, k), lerp(11.2, 10.4, k)).add(shake(t, 12, 1.3).multiplyScalar(0.01 + 0.04 * alarm));
      setCam(cam, pos, jStand.clone().add(new THREE.Vector3(-0.3, 1.9, 0)), 32);
      P = { focus: pos.distanceTo(jStand) , aperture: 6, maxCoc: 12 };
    } else if (t < ALL_SAFE - 0.1) {
      const k = (t - 1.25) / (ALL_SAFE - 0.1 - 1.25);
      const pos = new THREE.Vector3(lerp(0, -3, k), lerp(14, 11, k), lerp(17, 15, k));
      setCam(cam, pos.add(shake(t, 13, 0.7).multiplyScalar(0.05)), new THREE.Vector3(lerp(-3.5, -7, k), 0, lerp(2.5, 5.5, k)), 38);
      P = { focus: pos.distanceTo(new THREE.Vector3(-6, 0, 5)), aperture: 10, maxCoc: 12 };
    } else {
      const k = (t - ALL_SAFE + 0.1) / (6.09 - ALL_SAFE + 0.1);
      const pos = new THREE.Vector3(lerp(-13.6, -13.0, k), lerp(0.85, 1.05, k), lerp(10.2, 9.6, k)).add(shake(t, 14, 1.0).multiplyScalar(0.015));
      setCam(cam, pos, new THREE.Vector3(lerp(-8.4, -8.0, k), lerp(0.9, 1.4, k), lerp(6.6, 6.2, k)), 30);
      P = { focus: pos.distanceTo(new THREE.Vector3(M.x, 0.3, M.y)), aperture: 6, maxCoc: 12 };
    }
    const red = alarm * (0.6 + 0.4 * strobe);
    return { ...P, subframes: (t > 1.25 && t < ALL_SAFE) ? 2 : 1, shells: (t > 1.25 && t < ALL_SAFE - 0.1) ? 8 : 14, exposure: 1.1 + 0.4 * safeK * (1 - ss(t, ALL_SAFE + 0.5, 6)), bloom: 0.16 + 0.2 * safeK * (1 - bk), vignette: 0.5, sat: 1.15, contrast: 1.12, ao: 0.8, aoRadius: 0.6,
      tintShadow: [0.85 + 0.25 * red, 0.92 - 0.1 * red, 1.15 - 0.2 * red], tintHigh: [1.05 + 0.1 * red, 1.0, 0.95] };
  },
};
export default shot;
