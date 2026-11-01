// SHOT 2 — "Heritage". Jay punches up through the cloud ceiling into a golden sea of
// clouds. A monumental 1908 door stands on the clouds: oak, iron strap hinges, a brass
// lock with exposed precision gears. The lake drop is the key. The door opens into light.
import * as THREE from 'three';
import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js';
import { Clouds, Door } from '../clouds.js';
import { JU } from '../fur.js';
import { makeDrop, radialTex } from '../props.js';
import { kf, kfv, prog, smooth, easeOut, easeIn, easeInOut, setCam, shake, clamp, lerp, spring, wobble } from '../anim.js';
import { fly, idle, land, blinks, mergePose, blendPose, ss } from '../jaypose.js';

const T = { burst: 0.45, land: 5.0, reach: 5.7, insert: 6.45, spinA: 6.6, boltA: 7.5, boltB: 8.0, open: 8.16, opened: 9.2, enter: 9.25, end: 10.2 };
const DOOR = new THREE.Vector3(0, 70, -42), DS = 1.4;

const shot = {
  name: 'sky', dur: 10.2,
  async init(ctx) {
    this.ctx = ctx;
    const scene = new THREE.Scene();
    const sunDir = new THREE.Vector3(0.25, 0.14, -0.96).normalize();
    const clouds = this.clouds = new Clouds(sunDir).build({ level: 60 });
    scene.add(clouds.root);
    const door = this.door = new Door().build();
    door.root.position.copy(DOOR); door.root.scale.setScalar(DS); scene.add(door.root);
    // cloud puffs hugging the door's base
    const puffMat = new THREE.SpriteMaterial({ map: radialTex(), color: new THREE.Color(1.0, 0.9, 0.85), transparent: true, opacity: 0.45, depthWrite: false });
    for (let i = 0; i < 0; i++) {
      const a = (i / 26) * Math.PI * 2, r = 3.2 + (i % 3) * 1.4;
      const sp = new THREE.Sprite(puffMat); sp.position.set(DOOR.x + Math.cos(a) * r, DOOR.y - 0.4 + (i % 4) * 0.25, DOOR.z + Math.sin(a) * r * 0.7 + 0.5);
      sp.scale.setScalar(4 + (i % 5) * 1.2); sp.renderOrder = 4; scene.add(sp);
    }
    // env + SH from sky/clouds
    clouds.cloudMat.uniforms.uDoor.value.set(DOOR.x, DOOR.z, 1);
    const envScene = new THREE.Scene(); envScene.add(clouds.sky.clone(), clouds.sea.clone());
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(1, 9000, cubeRT); cubeCam.position.set(0, 75, -30); envScene.add(cubeCam); cubeCam.update(ctx.renderer, envScene);
    const probe = await LightProbeGenerator.fromCubeRenderTarget(ctx.renderer, cubeRT);
    scene.userData.sh = probe.sh.coefficients.map((v) => v.clone()); scene.userData.shMul = 0.9;
    scene.environment = ctx.pmrem.fromCubemap(cubeRT.texture).texture; scene.environmentIntensity = 0.9;
    const sun = new THREE.DirectionalLight(0xffc690, 3.2); sun.position.copy(DOOR).add(sunDir.clone().multiplyScalar(60)); sun.target.position.copy(DOOR);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -10, right: 10, top: 10, bottom: -6, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    // warm light spilling from the open door
    this.spill = new THREE.PointLight(0xffd9a8, 0, 30, 1.5); this.spill.position.copy(DOOR).add(new THREE.Vector3(0, 3.3, 1.5)); scene.add(this.spill);
    this.drop = makeDrop(0.16); scene.add(this.drop);
    this.scene = scene;
    this.camera = new THREE.PerspectiveCamera(34, ctx.W / ctx.H, 0.3, 12000);
    this.lockW = new THREE.Vector3();
  },
  jayPos(t) {
    const stand = DOOR.clone().add(new THREE.Vector3(-0.35, 0.02, 2.0));
    if (t < T.burst + 0.5) return new THREE.Vector3(0, lerp(38, 67, easeOut(clamp(t / (T.burst + 0.5)), 2)), 40);
    if (t < T.land) {
      const k = (t - T.burst - 0.5) / (T.land - T.burst - 0.5);
      const a = new THREE.Vector3(0, 67, 40), b = new THREE.Vector3(2, 79, 12), c = stand;
      const e = easeInOut(k);
      return a.clone().lerp(b, e).lerp(b.clone().lerp(c, e), e);
    }
    if (t < T.enter) return stand;
    const k = easeIn(clamp((t - T.enter) / 0.95), 2);
    return stand.clone().add(new THREE.Vector3(0.3 * k, 1.2 * Math.sin(k * Math.PI) * 0.6, -6 * k));
  },
  update(t) {
    const { ctx, clouds, door } = this; const jay = ctx.jay;
    this.scene.add(jay.root);
    clouds.update(t);
    JU.uWaterAmt.value = 0; JU.uFurGrow.value = 1;
    clouds.cloudMat.uniforms.uHole.value.set(0, 40, (0.4 + 0.6 * ss(t, 0, 0.35)) * (1 - ss(t, 1.4, 3.2)));
    clouds.cloudMat.uniforms.uDoor.value.set(DOOR.x, DOOR.z, 1);
    // ---------------- door mechanics ----------------
    const spin = kf(t, [[T.spinA, 0], [T.open, Math.PI * 2.2, easeInOut]]);
    const bolts = ss(t, T.boltA, T.boltB);
    const open = easeInOut(clamp((t - T.open - 0.15) / (T.opened - T.open - 0.15)));
    const glow = ss(t, T.insert - 0.1, T.insert + 0.2) * (1 - 0.6 * ss(t, T.open, T.opened));
    door.set({ spin, bolts, open, glow });
    this.spill.intensity = open * 60;
    // ---------------- Jay ----------------
    const jp = this.jayPos(t);
    const fl = fly(t, { freq: 2.4, glide: ss(t, 3.0, 3.6) * (1 - ss(t, 4.4, 4.8)), pitch: t < T.burst + 0.3 ? 0.15 : 0.6, bank: kf(t, [[2.2, 0], [3.2, 0.25], [4.3, -0.15], [4.9, 0]]), look: t < T.burst ? -0.4 : 0.2 });
    const reachK = ss(t, T.reach, T.insert);
    const ground = mergePose(idle(t), land(t - T.land), {
      head: [kf(t, [[T.land, 0], [T.land + 0.5, -0.32], [T.reach, -0.15], [T.insert, -0.08], [T.open, -0.1], [T.opened, -0.2]]), kf(t, [[T.reach, 0], [T.insert, 0.12]]), 0],
      eyes: [0.05, kf(t, [[T.land, 0], [T.land + 0.5, 0.2], [T.insert, 0.0]])],
      lid: blinks(t, [T.land + 0.9, T.boltB + 0.2]),
      jaw: kf(t, [[T.land, 0.2], [T.insert, 0.15], [T.open + 0.3, 0.42]]),
      armL: { out: lerp(0.1, -0.05, reachK), fwd: lerp(0, 1.35, reachK) - 0.5 * ss(t, T.insert + 0.25, T.insert + 0.7), bend: lerp(0, 0.35, reachK), wrist: [lerp(0, -0.6, reachK), 0, 0] },
      armR: { out: 0.1, fwd: 0.1 * reachK },
      torso: [0, 0.15 * reachK, 0],
    });
    let pose;
    if (t < T.land - 0.3) pose = fl;
    else if (t < T.enter) pose = blendPose(fl, ground, ss(t, T.land - 0.3, T.land + 0.1));
    else pose = blendPose(ground, fly(t, { freq: 2.6, pitch: 0.5 }), ss(t, T.enter, T.enter + 0.35));
    jay.pose(pose);
    jay.root.position.copy(jp);
    const headTo = t < T.burst ? 0 : Math.atan2(DOOR.x - jp.x, DOOR.z - jp.z);
    jay.root.rotation.set(0, t < T.land ? lerp(0.25, headTo, ss(t, T.burst + 0.25, T.burst + 1.1)) : Math.PI, 0);
    jay.root.scale.setScalar(1);
    // ---------------- drop: in hand, then into the keyhole ----------------
    jay.root.updateMatrixWorld(true);
    const hand = new THREE.Vector3(); jay.parts.wristL.getWorldPosition(hand);
    door.lock.updateMatrixWorld(true);
    this.lockW.set(-0.15, 0.13, 0.15); door.lock.localToWorld(this.lockW);
    const carry = jp.clone().add(new THREE.Vector3(0, 1.5, -0.8));
    let dp = t < T.land ? carry : hand.clone().add(new THREE.Vector3(0, 0.05, -0.15));
    if (t > T.land - 0.4 && t < T.land + 0.2) dp = carry.clone().lerp(hand, ss(t, T.land - 0.4, T.land + 0.2));
    const ins = ss(t, T.insert - 0.25, T.insert + 0.12) * (1 - ss(t, T.insert + 0.45, T.insert + 1.0));
    dp.lerp(this.lockW.clone().add(new THREE.Vector3(0, 0, 0.12)), ins);
    this.drop.position.copy(dp);
    const touch = Math.exp(-Math.max(0, t - T.insert) * 4) * (t > T.insert ? 1 : 0);
    this.drop.scale.setScalar(1 + touch * 0.6);
    this.drop.userData.halo.scale.setScalar(0.16 * 9 * (1 + touch * 2.5));
    this.drop.visible = t < T.enter + 0.9;
    // ---------------- camera ----------------
    const cam = this.camera; let P = {}; let fadeW = 0;
    if (t < T.land - 0.15) {
      const k = t / (T.land - 0.15);
      const pos = new THREE.Vector3(lerp(10, 4, easeInOut(k)), lerp(64, 77, easeOut(k)), lerp(66, 18, easeInOut(k)));
      const hole = new THREE.Vector3(0, 63, 40);
      const tgt = hole.clone().lerp(jp, ss(t, 0.2, 0.9)).lerp(DOOR.clone().add(new THREE.Vector3(0, 3, 0)), 0.15 + 0.45 * ss(t, 1.2, 4.6));
      setCam(cam, pos.add(shake(t, 8, 0.8).multiplyScalar(0.1 + 0.25 * Math.exp(-Math.abs(t - T.burst) * 4))), tgt, lerp(40, 34, k), kf(t, [[0.5, 0.03], [1.5, -0.05], [3.2, 0.03], [4.4, 0]]));
      P = { focus: pos.distanceTo(jp), aperture: 3, maxCoc: 8 };
      fadeW = 0.6 * (1 - ss(t, 0, 0.25));
    } else if (t < T.insert + 0.05) {
      const k = (t - T.land + 0.15) / (T.insert + 0.2 - T.land);
      const pos = DOOR.clone().add(new THREE.Vector3(lerp(5.2, 4.2, k), lerp(2.2, 3.0, k), lerp(8.5, 6.5, easeOut(k))));
      const tgt = jp.clone().add(new THREE.Vector3(0.4, lerp(2.2, 2.9, k), -1));
      setCam(cam, pos.add(shake(t, 9, 0.6).multiplyScalar(0.02)), tgt, 34);
      P = { focus: pos.distanceTo(jp.clone().add(new THREE.Vector3(0, 2.4, 0))), aperture: 6, maxCoc: 12 };
    } else if (t < T.open) {
      const k = (t - T.insert) / (T.open - T.insert);
      const lc = this.lockW.clone();
      const pos = lc.clone().add(new THREE.Vector3(lerp(1.0, 0.75, k), lerp(-0.2, 0.05, k), lerp(2.0, 1.55, easeOut(k))));
      setCam(cam, pos.add(shake(t, 10, 0.5).multiplyScalar(0.004)), lc.clone().add(new THREE.Vector3(0.35, -0.05, 0)), 30, -0.05);
      P = { focus: pos.distanceTo(lc) * 0.98, aperture: 9, maxCoc: 14 };
    } else {
      const k = (t - T.open) / (T.end - T.open);
      const pos = DOOR.clone().add(new THREE.Vector3(lerp(1.5, 0.4, k), lerp(4.2, 3.6, k), lerp(14, 4.5, easeIn(k, 2))));
      setCam(cam, pos.add(shake(t, 11, 1.0).multiplyScalar(0.03)), DOOR.clone().add(new THREE.Vector3(0, 3.2, -2)), lerp(38, 46, k));
      P = { focus: pos.distanceTo(jp.clone().add(new THREE.Vector3(0, 2, 0))), aperture: 3, maxCoc: 8 };
      fadeW = ss(t, 9.75, 10.2);
    }
    return { ...P, subframes: (t < T.land - 0.1 || t > T.enter) ? 2 : 1, shells: t < T.land - 0.15 ? 12 : 16, exposure: 0.88 + 0.3 * open, bloom: 0.12 + 0.3 * open, vignette: 0.42, sat: 1.15, contrast: 1.15, fade: fadeW, fadeCol: [1, 0.97, 0.92], ao: 0.6, aoRadius: 0.5, tintShadow: [0.92, 0.95, 1.1], tintHigh: [1.08, 1.0, 0.9] };
  },
};
export default shot;
