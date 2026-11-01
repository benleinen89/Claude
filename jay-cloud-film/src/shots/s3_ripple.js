// SHOT 3 — "One change. Every system knows."
// Jay glides over a grey, frozen miniature workplace and lets the lake drop fall into
// the plaza pool. On the music hit the ripple becomes a wave of light: every door,
// reader, terminal, turnstile and window wakes up, and people start moving.
import * as THREE from 'three';
import { Campus, CU, LAYOUT, Arcs } from '../campus.js';
import { makeDrop, Splash, makeLightRing } from '../props.js';
import { kf, kfv, prog, smooth, easeOut, easeInOut, setCam, shake, clamp, lerp } from '../anim.js';
import { fly, land, idle, blinks, mergePose, blendPose, ss } from '../jaypose.js';

export const IMPACT = 2.04;          // local time of the drop hitting the pool (music hit)
export const WAVE_SPEED = 7.0;
export const JS = 0.1;   // Jay's scale in the campus: about one person tall
export function frameShadow(light, center, size, dist = 30) {
  const d = light.userData.dir || (light.userData.dir = light.position.clone().sub(light.target.position).normalize());
  light.target.position.copy(center); light.position.copy(center).addScaledVector(d, dist);
  const c = light.shadow.camera; c.left = -size; c.right = size; c.top = size; c.bottom = -size; c.near = 0.5; c.far = dist * 2.2; c.updateProjectionMatrix();
  light.target.updateMatrixWorld(); light.updateMatrixWorld();
}

export function routes() {
  const P = (pts) => { const c = new THREE.CurvePath(); for (let i = 1; i < pts.length; i++) c.add(new THREE.LineCurve3(new THREE.Vector3(pts[i - 1][0], 0, pts[i - 1][1]), new THREE.Vector3(pts[i][0], 0, pts[i][1]))); return c; };
  return [
    P([[-5, -2.4], [5, -2.0]]), P([[5, 5.4], [-5, 5.6]]), P([[-2.6, 2.2], [-6.5, -0.8], [-6.5, -3.9]]), P([[5.2, -3.6], [4.5, -1], [2.6, 2.8], [0.8, 6], [0, 9.6]]),
    P([[11, 7], [9, 7], [4, 5.2], [-1, 5.6]]), P([[2.6, 1.5], [0, 4.1], [-2.6, 1.5], [0, -1.1], [2.6, 1.5]]), P([[-22, 13.4], [22, 13.4]]), P([[2, 8.5], [-1.3, -2.8]]),
    P([[-12, 9], [-6, 6]]), P([[22, 13.9], [-22, 13.9]]), P([[13.5, 7.5], [9.6, 7.5], [9.6, 4], [7, 1]]), P([[-4.5, -2.8], [4.5, -2.8]]),
  ];
}

const shot = {
  name: 'ripple', dur: 8.18,
  async init(ctx) {
    this.ctx = ctx;
    const scene = new THREE.Scene();
    const HN = 'belfast_sunset_puresky';
    const hdr = await ctx.loadHDR(HN, ctx.yawFor(HN, -0.92, -0.38));
    ctx.applySky(scene, hdr, { envInt: 0.38, bgInt: 0.9, shMul: 0.45 });
    scene.fog = new THREE.FogExp2(new THREE.Color('#8f8fae'), 0.008);
    const sun = new THREE.DirectionalLight(0xffa860, 5.0); sun.position.copy(hdr.sun).setY(0.32).normalize().multiplyScalar(45); sun.target.position.set(0, 0, 0);
    sun.userData.dir = sun.position.clone().normalize();
    sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 });
    sun.shadow.bias = -0.0002; sun.shadow.normalBias = 0.004; sun.shadow.radius = 2;
    scene.add(sun, sun.target);
    const campus = this.campus = ctx.campus || (ctx.campus = new Campus().build());
    scene.add(campus.root);
    campus.root.updateMatrixWorld(true);
    for (const d of campus.devices) d.pos.setFromMatrixPosition(d.g.matrixWorld);
    this.drop = makeDrop(0.035); scene.add(this.drop);
    this.splash = new Splash(110); scene.add(this.splash.mesh);
    this.ring = makeLightRing(); scene.add(this.ring);
    this.poolLight = new THREE.PointLight(0x58c8ff, 0, 5, 1.6); this.poolLight.position.set(LAYOUT.pool.x, 0.25, LAYOUT.pool.y); scene.add(this.poolLight);
    this.routes = routes();
    // light threads: pool -> every device / building, timed to arrive with the wave
    const tg = [];
    const at = (x, z) => IMPACT + Math.hypot(x - LAYOUT.pool.x, z - LAYOUT.pool.y) / WAVE_SPEED * 1.12;
    for (const d of campus.devices) tg.push({ pos: d.pos.clone(), y: d.kind === 'door' ? 0.32 : 0.33 });
    const hq = LAYOUT.hq, fc = LAYOUT.factory;
    tg.push({ pos: new THREE.Vector3(hq.x - 2.5, 0, hq.z + hq.d / 2), y: 1.6 }, { pos: new THREE.Vector3(hq.x + 2.5, 0, hq.z + hq.d / 2), y: 2.1 }, { pos: new THREE.Vector3(hq.x, 0, hq.z), y: 2.6 },
      { pos: new THREE.Vector3(fc.x + 1, 0, fc.z), y: 1.8 }, { pos: new THREE.Vector3(fc.x + 2.5, 0, fc.z + fc.d / 2), y: 0.6 },
      { pos: LAYOUT.kiosk.clone(), y: 0.45 }, { pos: new THREE.Vector3(-5.6, 0, -3.2), y: 0.38 }, { pos: new THREE.Vector3(LAYOUT.muster.x, 0, LAYOUT.muster.y), y: 0.05 },
      { pos: new THREE.Vector3(13.3, 0, 8), y: 0.3 });
    for (const t of tg) t.t0 = IMPACT + 0.05;
    this.arcs = new Arcs(LAYOUT.pool, tg, WAVE_SPEED / 1.12); scene.add(this.arcs.group);
    this.scene = scene; this.sun = sun;
    this.camera = new THREE.PerspectiveCamera(35, ctx.W / ctx.H, 0.01, 260);
    this.jayPath = [
      [0.0, [-5.6, 2.3, -3.4], null], [0.55, [-3.4, 1.85, -1.4]], [IMPACT - 1.0, [-1.05, 1.45, 0.95]], [1.62, [0.8, 0.85, 2.85]], [2.35, [1.45, 0, 4.05], easeOut],
    ];
  },
  jayAt(t) { return kfv(t, this.jayPath, (x) => x); },
  update(t) {
    const { campus, ctx } = this; const jay = ctx.jay;
    this.scene.add(jay.root); this.scene.add(campus.root);
    CU.uTime.value = t; CU.uAlarm.value = 0; CU.uNight.value = 0;
    for (const d of campus.devices) if (d.kind === 'turnstile') d.arms.rotation.x = 0;
    campus.musterSegs.forEach((m) => (m.material.opacity = 0));
    // ---------------- wave ----------------
    const wr = t < IMPACT ? -1 : (t - IMPACT) * WAVE_SPEED * (0.6 + 0.4 * smooth(clamp((t - IMPACT) / 1.5)));
    CU.uWaveC.value.copy(LAYOUT.pool); CU.uWaveR.value = wr; CU.uDesat.value = 0.88;
    const actAt = (x, z) => IMPACT + Math.hypot(x - LAYOUT.pool.x, z - LAYOUT.pool.y) / WAVE_SPEED * 1.12;
    this.ring.visible = wr > 0;
    if (wr > 0) { this.ring.position.set(LAYOUT.pool.x, 0, LAYOUT.pool.y); this.ring.scale.set(wr, 0.5 + 0.4 * Math.exp(-wr * 0.05), wr); this.ring.material.uniforms.uAlpha.value = 0.9 * Math.exp(-wr * 0.045) * clamp((t - IMPACT) * 6); }
    // ---------------- drop + splash ----------------
    const tRel = IMPACT - 1.0;
    const noJay = !!ctx.qs.get('nojay');
    const jp = this.jayAt(t);
    const heading = (() => { const a = this.jayAt(t - 0.05), b = this.jayAt(t + 0.05); return Math.atan2(b.x - a.x, b.z - a.z); })();
    const carry = (tt) => { const p = this.jayAt(tt); const a = this.jayAt(tt - 0.05), b = this.jayAt(tt + 0.05); const h = Math.atan2(b.x - a.x, b.z - a.z); return new THREE.Vector3(p.x + Math.sin(h) * 0.085, p.y + 0.1, p.z + Math.cos(h) * 0.085); };
    // Jay-less cut (v2): the drop falls out of the sky by itself, straight into the pool
    const fall = (tt) => { const x = clamp(tt / IMPACT); return new THREE.Vector3(lerp(0.9, LAYOUT.pool.x, smooth(x)), lerp(5.2, 0.04, Math.pow(x, 1.6)), lerp(-0.6, LAYOUT.pool.y, smooth(x))); };
    if (noJay) { this.drop.position.copy(fall(t)); this.drop.visible = t < IMPACT; }
    else if (t < tRel) { this.drop.position.copy(carry(t)); this.drop.visible = true; }
    else if (t < IMPACT) {
      const s0 = carry(tRel); const x = (t - tRel) / (IMPACT - tRel);
      this.drop.position.set(lerp(s0.x, LAYOUT.pool.x, smooth(x)), lerp(s0.y, 0.04, x * x), lerp(s0.z, LAYOUT.pool.y, smooth(x)));
      this.drop.visible = true;
    } else this.drop.visible = false;
    this.drop.rotation.set(0, 0, 0);
    const pulse = 1 + 0.08 * Math.sin(t * 9);
    this.drop.userData.halo.scale.setScalar(0.035 * 9 * pulse); this.drop.userData.light.distance = 0.8; this.drop.userData.light.intensity = 0.06;
    this.splash.update(t - IMPACT, new THREE.Vector3(LAYOUT.pool.x, 0.03, LAYOUT.pool.y), 0.45);
    campus.waterU.uDrops.value[0].set(LAYOUT.pool.x, LAYOUT.pool.y, IMPACT, 1.0);
    // ---------------- devices ----------------
    for (const d of campus.devices) {
      const ta = actAt(d.pos.x, d.pos.z);
      const on = clamp((t - ta) / 0.25);
      d.led.material.color.setRGB(lerp(2.0, 0.15, on), lerp(0.12, 2.2, on), lerp(0.08, 0.6, on));
      if (d.kind === 'door') { const o = easeInOut(clamp((t - ta - 0.3) / 0.8)); d.leaves[0].position.x = -0.21 - o * 0.36; d.leaves[1].position.x = 0.21 + o * 0.36; }
      if (d.kind === 'turnstile') d.arms.rotation.x = Math.max(0, t - ta - 0.2) * 3.2;
    }
    this.arcs.update(t); campus.updateFlags(t);
    this.poolLight.intensity = t > IMPACT ? 1.4 * (0.55 + 0.45 * Math.exp(-(t - IMPACT) * 1.5)) : 0;
    campus.barrier.rotation.z = easeInOut(clamp((t - actAt(13.3, 8) - 0.4) / 1.2)) * 1.35;
    // ---------------- people ----------------
    const R = this.routes;
    for (const p of campus.people) {
      const route = R[p.i % R.length]; const L = route.getLength();
      const dir = p.i % 3 === 0 ? -1 : 1;
      const s0 = (p.seed * 0.85 + 0.05) * L;
      const start = route.getPointAt(clamp(s0 / L));
      const ta = actAt(start.x, start.z) + p.seed * 0.35;
      const walkT = Math.max(0, t - ta);
      const speed = 0.2 + p.seed * 0.08;
      let s = s0 + dir * walkT * speed; s = ((s % L) + L) % L;
      const pos = route.getPointAt(s / L), tan = route.getTangentAt(s / L).multiplyScalar(dir);
      const ph = walkT > 0 ? walkT * 3.4 : 0;
      // a little hop of joy when the wave reaches them
      const hop = Math.max(0, Math.sin(clamp((t - ta + 0.25) / 0.35) * Math.PI)) * 0.025;
      const blocked = this.clearZone && Math.hypot(pos.x - this.clearZone.x, pos.z - this.clearZone.y) < 1.1;
      campus.setPerson(p.i, pos.x, pos.z, Math.atan2(tan.x, tan.z), ph, hop, blocked ? 0.0001 : 1);
    }
    campus.commitPeople();
    // ---------------- Jay ----------------
    const tLand = 2.35;
    const flight = fly(t, { freq: 2.0, glide: ss(t, 0.3, 0.7) * (1 - ss(t, 1.45, 1.75)), bank: kf(t, [[0, -0.3], [0.9, 0.25], [1.6, -0.2], [2.2, 0]]), pitch: kf(t, [[0, 0.8], [1.6, 0.7], [2.2, 0.15]]) });
    const ground = mergePose(idle(t - tLand), land(t - tLand), {
      head: [kf(t, [[2.4, 0.15], [3.2, 0.25], [5, -0.05], [8, -0.12]]), kf(t, [[2.4, 0.0], [4.0, 0.25], [6.5, -0.2], [8.2, 0.1]]), 0],
      armL: { out: kf(t, [[2.4, 0.9], [3.0, 0.15], [5.6, 0.1], [6.0, 0.5], [6.4, 0.2]]), bend: kf(t, [[5.6, 0], [6.0, 1.6], [6.6, 1.2]]), fwd: kf(t, [[5.6, 0], [6.0, 0.6], [6.8, 0.5]]) },
      armR: { out: kf(t, [[2.4, 0.9], [3.0, 0.15]]) }, jaw: kf(t, [[2.4, 0.15], [3.0, 0.35], [6.0, 0.4]]),
      lid: blinks(t, [3.75, 5.2, 7.4]), eyes: [kf(t, [[3, 0.0], [4.0, 0.1], [6, -0.12]]), -0.05],
    });
    const pose = t < tLand - 0.25 ? flight : blendPose(flight, ground, ss(t, tLand - 0.25, tLand + 0.15));
    jay.pose(pose);
    const yawFly = heading, yawGround = Math.atan2(LAYOUT.pool.x - 1.45, LAYOUT.pool.y - 4.05) - 0.5;
    jay.root.position.copy(jp);
    jay.root.rotation.set(0, lerp(yawFly, yawGround, ss(t, 1.9, 2.8)), 0);
    jay.root.scale.setScalar(JS);
    // ---------------- camera ----------------
    const cam = this.camera; let P = {};
    if (noJay && t < IMPACT - 0.08) {
      // ride down with the falling drop over the grey, frozen plaza
      const d = fall(t), x = clamp(t / IMPACT);
      const pos = d.clone().add(new THREE.Vector3(lerp(0.55, 0.42, x), lerp(1.1, 0.5, x), lerp(-1.5, -0.95, x))).add(shake(t, 1, 0.7).multiplyScalar(0.01));
      const look = d.clone().lerp(new THREE.Vector3(LAYOUT.pool.x, 0, LAYOUT.pool.y), lerp(0.55, 0.3, x));
      setCam(cam, pos, look, lerp(44, 38, x), kf(t, [[0, 0.06], [1.2, -0.03], [1.9, 0]]));
      P = { focus: pos.distanceTo(d), aperture: 4, maxCoc: 12 };
      frameShadow(this.sun, new THREE.Vector3(d.x, 0, d.z), lerp(6, 3, x));
    } else if (noJay && t >= 3.0 && t < 4.85) {
      // the wave reaches the HQ entrance: the doors slide open, readers turn green, people step out
      const k = (t - 3.0) / (4.85 - 3.0);
      const door = LAYOUT.hqDoor;
      const pos = door.clone().add(new THREE.Vector3(lerp(1.75, 1.45, easeOut(k)), lerp(0.3, 0.26, k), lerp(2.35, 1.95, easeOut(k)))).add(shake(t, 3, 0.9).multiplyScalar(0.003));
      const tgt = door.clone().add(new THREE.Vector3(0.05, 0.24, 0));
      setCam(cam, pos, tgt, 34);
      P = { focus: pos.distanceTo(tgt), aperture: 6, maxCoc: 12 };
      frameShadow(this.sun, door.clone().add(new THREE.Vector3(0.8, 0, 1.2)), 2.4);
      this.clearZone = null;
    } else if (t < IMPACT - 0.08) {
      // chase: over Jay's shoulder as he glides over the grey plaza, then down with the drop
      const a = this.jayAt(Math.min(t, 1.5) - 0.05), b = this.jayAt(Math.min(t, 1.5) + 0.05);
      const fwd = b.clone().sub(a).setY(0).normalize(); const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
      const jw = this.jayAt(Math.min(t, 1.5));
      const pos = jw.clone().addScaledVector(fwd, -0.95).addScaledVector(right, 0.32).add(new THREE.Vector3(0, 0.34, 0)).add(shake(t, 1, 0.8).multiplyScalar(0.012));
      const look = jw.clone().addScaledVector(fwd, 1.2).add(new THREE.Vector3(0, -0.45, 0)).lerp(this.drop.position, ss(t, 1.0, 1.7) * 0.85);
      setCam(cam, pos, look, 40, kf(t, [[0, 0.05], [1.0, -0.04], [1.9, 0]]));
      P = { focus: cam.position.distanceTo(t < 1.1 ? jw : this.drop.position), aperture: 5, maxCoc: 12 };
      frameShadow(this.sun, new THREE.Vector3(jw.x, 0, jw.z).addScaledVector(fwd, 1.2), 3.5);
    } else if (t < 4.85) {
      if (t < 3.0) {
        // low across the pool: the splash, the ring racing out, people waking up
        const k = (t - IMPACT) / (3.0 - IMPACT);
        const pos = new THREE.Vector3(lerp(-0.95, -0.82, k), lerp(0.3, 0.27, easeOut(k)), lerp(-1.85, -1.6, k)).add(shake(t, 2, 1.3).multiplyScalar(0.004 + 0.012 * Math.exp(-(t - IMPACT) * 3)));
        setCam(cam, pos, new THREE.Vector3(0.15, 0.12, 2.0), 34);
        P = { focus: pos.distanceTo(new THREE.Vector3(0, 0.1, 1.5)), aperture: 4.5, maxCoc: 12 };
        frameShadow(this.sun, new THREE.Vector3(0.0, 0, 1.6), 4.5);
        this.clearZone = new THREE.Vector2(pos.x, pos.z);
      } else {
        // reverse: Jay on the rim, lit by the pool, as the wave passes and people come alive behind him
        const k = (t - 3.0) / (4.85 - 3.0);
        const jpos = new THREE.Vector3(1.45, 0, 4.05);
        const face = new THREE.Vector3(LAYOUT.pool.x - 1.45, 0, LAYOUT.pool.y - 4.05).normalize();
        const side = new THREE.Vector3(-face.z, 0, face.x);
        const pos = jpos.clone().addScaledVector(face, lerp(0.95, 0.78, easeOut(k))).addScaledVector(side, 0.16).add(new THREE.Vector3(0, lerp(0.21, 0.23, k), 0)).add(shake(t, 3, 0.9).multiplyScalar(0.003));
        setCam(cam, pos, jpos.clone().add(new THREE.Vector3(0, 0.22, 0)).addScaledVector(side, -0.05), 30);
        P = { focus: pos.distanceTo(jpos.clone().add(new THREE.Vector3(0, 0.23, 0))), aperture: 7, maxCoc: 14 };
        frameShadow(this.sun, jpos, 1.6);
        this.clearZone = null;
      }
    } else {
      this.clearZone = null;
      // crane up from behind Jay to the whole campus coming alive
      const k = easeInOut((t - 4.85) / (8.18 - 4.85));
      const pos = new THREE.Vector3(lerp(1.75, 3.5, k), lerp(0.26, 10.5, k), lerp(4.95, 17, k));
      const tgt = new THREE.Vector3(lerp(0.9, -0.5, k), lerp(0.2, 0, k), lerp(2.6, -1.5, k));
      setCam(cam, pos, tgt, lerp(40, 42, k));
      P = { focus: pos.distanceTo(k < 0.3 ? new THREE.Vector3(1.45, 0.2, 4.05) : tgt), aperture: lerp(5, 11, k), maxCoc: 12 };
      frameShadow(this.sun, new THREE.Vector3(lerp(1.0, 0, k), 0, lerp(3.5, -1, k)), lerp(5, 26, k));
    }
    // impact flash
    const fl = Math.exp(-Math.max(0, t - IMPACT) * 6) * (t > IMPACT ? 1 : 0);
    return { ...P, exposure: 1.25 + fl * 0.6, bloom: 0.12 + fl * 0.25, vignette: 0.42, sat: 1.15, contrast: 1.14, ao: 0.9, aoRadius: t > 4.85 ? 0.5 : 0.06, tintShadow: [0.9, 0.96, 1.1], tintHigh: [1.07, 1.0, 0.92], subframes: t < IMPACT ? 2 : 1, shells: 16 };
  },
};
export default shot;
