// SHOT 1 — "Phoksundo". Dawn on a turquoise Himalayan lake. Light gathers at the
// centre, the water rises and becomes Jay; the water skin runs off to reveal fur.
// The lake hands him a single glowing drop, and he takes off.
import * as THREE from 'three';
import { LightProbeGenerator } from 'three/addons/lights/LightProbeGenerator.js';
import { Lake } from '../lake.js';
import { JU } from '../fur.js';
import { makeDrop, Splash } from '../props.js';
import { kf, kfv, prog, smooth, easeOut, easeIn, easeInOut, setCam, shake, clamp, lerp, elasticOut, spring, wobble } from '../anim.js';
import { fly, idle, blinks, mergePose, blendPose, ss } from '../jaypose.js';

const T = { rise: 6.4, formed: 8.4, drainA: 8.9, drainB: 10.9, eyes: 11.9, dropUp: 12.6, hold: 13.5, crouch: 14.25, launch: 14.62, end: 16.32 };

const shot = {
  name: 'lake', dur: 16.32,
  async init(ctx) {
    this.ctx = ctx;
    const scene = new THREE.Scene();
    const sunDir = new THREE.Vector3(-0.32, 0.16, 0.93).normalize();
    const lake = this.lake = new Lake(sunDir).build();
    scene.add(lake.root);
    // environment + SH from the actual sky/terrain
    const envScene = new THREE.Scene(); envScene.add(lake.sky.clone(), lake.terrain.clone());
    const cubeRT = new THREE.WebGLCubeRenderTarget(128, { type: THREE.HalfFloatType });
    const cubeCam = new THREE.CubeCamera(1, 6000, cubeRT); cubeCam.position.set(0, 4, 0); envScene.add(cubeCam);
    cubeCam.update(ctx.renderer, envScene);
    const probe = await LightProbeGenerator.fromCubeRenderTarget(ctx.renderer, cubeRT);
    scene.userData.sh = probe.sh.coefficients.map((v) => v.clone()); scene.userData.shMul = 1.0;
    scene.environment = ctx.pmrem.fromCubemap(cubeRT.texture).texture; scene.environmentIntensity = 1.0;
    const sun = new THREE.DirectionalLight(0xffb48a, 2.2); sun.position.copy(sunDir).multiplyScalar(60);
    sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 7, bottom: -2, near: 1, far: 140 }); sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
    scene.add(sun, sun.target);
    const fill = new THREE.DirectionalLight(0x6f8cff, 0.6); fill.position.set(-3, 4, -6); scene.add(fill);
    this.drop = makeDrop(0.16); scene.add(this.drop);
    this.splash = new Splash(140, '#cfefff', 0.05); scene.add(this.splash.mesh);
    this.splash2 = new Splash(90, '#cfefff', 0.045); scene.add(this.splash2.mesh);
    // spray shaken off the fur
    this.spray = new Splash(160, '#dff6ff', 0.025); scene.add(this.spray.mesh);
    this.scene = scene; this.sun = sun;
    this.camera = new THREE.PerspectiveCamera(32, ctx.W / ctx.H, 0.3, 9000);
  },
  update(t) {
    const { ctx, lake } = this; const jay = ctx.jay;
    this.scene.add(jay.root);
    const U = lake.U; U.uTime.value = t; U.uStars.value = 0.5 * (1 - ss(t, 0, 10));
    const wu = lake.waterU; for (const k of ['uTime', 'uSunDir', 'uSunCol', 'uSkyTop', 'uSkyHor', 'uSkyLow', 'uFogDen', 'uFogH']) wu[k].value = U[k].value;
    wu.uSwirl.value = ss(t, 3.8, 6.2) * (1 - ss(t, T.formed, T.formed + 1.5)) * 1.4;
    lake.drops[0].set(0, 0, T.rise, 1.4);            // column eruption
    lake.drops[1].set(0, 0, T.launch, 1.0);          // take-off splash
    lake.drops[2].set(0, 0.6, T.dropUp, 0.5);        // the drop leaving the water
    // ---------------- Jay: water birth ----------------
    const form = clamp((t - T.rise) / (T.formed - T.rise));
    const sY = t < T.rise ? 0.0001 : Math.max(0.0001, elasticOut(form * 0.95 + 0.05) * (1 - 0.0));
    const sXZ = t < T.rise ? 0.0001 : lerp(0.35, 1, easeOut(form)) + wobble(t - T.formed + 0.6, 1.6, 4) * 0.06;
    jay.root.visible = t >= T.rise;
    JU.uWaterAmt.value = t < T.drainB + 0.4 ? 1 : 0;
    JU.uWaterDir.value = -1;
    JU.uWaterY.value = lerp(3.4, -0.3, easeInOut(clamp((t - T.drainA) / (T.drainB - T.drainA))));
    JU.uFurGrow.value = lerp(0.55, 1.0, spring(t - T.drainA - 0.4, 1.2, 3.5));
    JU.uWaterColor.value.setRGB(0.01, 0.1, 0.16); JU.uGlowColor.value.setRGB(0.2, 0.85, 1.0);
    // ---------------- pose ----------------
    const look = kf(t, [[T.eyes, 0], [T.eyes + 0.6, 0.35], [T.eyes + 1.3, -0.25], [T.dropUp + 0.3, 0.0]]);
    const ground = mergePose(idle(t, 1), {
      lid: t < T.eyes ? 0.0 : Math.min(easeOut(clamp((t - T.eyes) / 0.35)), blinks(t, [T.eyes + 1.0])),
      head: [kf(t, [[T.eyes, 0.15], [T.eyes + 0.5, -0.05], [T.dropUp, 0.25], [T.hold, 0.3], [T.crouch, -0.45]]), look, kf(t, [[T.eyes + 0.4, 0], [T.eyes + 0.9, 0.12], [T.eyes + 1.5, -0.06], [T.dropUp, 0]])],
      jaw: kf(t, [[T.eyes, 0.04], [T.eyes + 0.5, 0.35], [T.dropUp, 0.2], [T.hold, 0.38]]),
      eyes: [look * 0.6, kf(t, [[T.dropUp, 0], [T.hold, 0.18], [T.crouch, -0.2]])],
      // shake-off: torso wiggle as the water leaves
      torso: [0, Math.sin((t - T.drainB) * 22) * 0.07 * Math.exp(-Math.max(0, t - T.drainB) * 2.5) * (t > T.drainB ? 1 : 0), 0],
      armL: { out: kf(t, [[T.dropUp, 0.05], [T.hold, 0.0]]), fwd: kf(t, [[T.dropUp, 0.0], [T.hold, 0.95]]), bend: kf(t, [[T.dropUp, 0], [T.hold, 0.6]]), wrist: [kf(t, [[T.dropUp, 0], [T.hold, -0.9]]), 0, 0] },
      armR: { out: kf(t, [[T.dropUp, 0.05], [T.hold, 0.0]]), fwd: kf(t, [[T.dropUp, 0.0], [T.hold, 0.95]]), bend: kf(t, [[T.dropUp, 0], [T.hold, 0.6]]), wrist: [kf(t, [[T.dropUp, 0], [T.hold, -0.9]]), 0, 0] },
      bodyPos: [0, -0.35 * ss(t, T.crouch, T.launch - 0.05), 0], body: [0.25 * ss(t, T.crouch, T.launch - 0.05), 0, 0],
    });
    const flight = fly(t, { freq: 2.6, glide: 0, pitch: 0.2, look: 0.5 });
    flight.armL.out += 0.3; flight.armR.out += 0.3;
    const pose = blendPose(ground, flight, ss(t, T.launch - 0.08, T.launch + 0.25));
    jay.pose(pose);
    const up = t > T.launch ? easeIn(clamp((t - T.launch) / 1.6), 2) * 34 + (t - T.launch) * 4 : 0;
    jay.root.position.set(0, -0.05 + up, 0);
    jay.root.rotation.set(0, 0, 0);
    jay.root.scale.set(sXZ, sY, sXZ);
    // ---------------- drop ----------------
    const handPos = new THREE.Vector3(0, 1.45, 0.75);
    if (t < T.dropUp) { this.drop.visible = false; }
    else {
      this.drop.visible = true;
      const k = easeInOut(clamp((t - T.dropUp) / (T.hold - T.dropUp)));
      const p = new THREE.Vector3(0, 0.15, 1.6).lerp(handPos, k);
      p.y += Math.sin(clamp((t - T.dropUp) / (T.hold - T.dropUp)) * Math.PI) * 0.9;
      if (t > T.launch) p.y += up; p.y += Math.sin(t * 3) * 0.02;
      this.drop.position.copy(p);
      this.drop.userData.halo.scale.setScalar(0.16 * 9 * (1 + 0.1 * Math.sin(t * 8)));
    }
    // ---------------- splashes ----------------
    this.splash.update((t - T.rise) * 0.8, new THREE.Vector3(0, 0, 0), 1.3);
    this.splash2.update((t - T.launch) * 0.9, new THREE.Vector3(0, 0, 0), 1.1);
    this.spray.update((t - T.drainB + 0.2) * 0.7, new THREE.Vector3(0, 1.4, 0), 0.9);
    // ---------------- camera ----------------
    const cam = this.camera; let P = {};
    if (t < 6.0) {
      const k = t / 6.0;
      const pos = new THREE.Vector3(lerp(-42, -9, easeInOut(k)), lerp(16, 4.2, easeInOut(k)), lerp(178, 52, easeInOut(k)));
      const tgt = new THREE.Vector3(lerp(-60, -2, easeInOut(k)), lerp(95, 4, easeInOut(k)), lerp(-700, -30, easeInOut(k)));
      setCam(cam, pos.add(shake(t, 3, 0.4).multiplyScalar(0.25)), tgt, 30, -0.02 + k * 0.02);
      P = { aperture: 0, focus: 200 };
    } else if (t < 11.6) {
      const k = (t - 6.0) / 5.6;
      const pos = new THREE.Vector3(lerp(9, 5.5, easeInOut(k)), lerp(2.2, 2.6, k), lerp(21, 13.5, easeInOut(k)));
      setCam(cam, pos.add(shake(t, 4, 0.5).multiplyScalar(0.04)), new THREE.Vector3(0, lerp(1.0, 1.7, ss(t, 6.4, 8.4)), 0), 30);
      P = { focus: pos.length(), aperture: 5, maxCoc: 10 };
    } else if (t < T.crouch) {
      const k = (t - 11.6) / (T.crouch - 11.6);
      const pos = new THREE.Vector3(lerp(1.6, 1.0, k), lerp(2.55, 2.35, k), lerp(6.4, 5.5, easeOut(k)));
      const tgt = new THREE.Vector3(0, lerp(2.4, 2.15, ss(t, T.dropUp, T.hold)), 0.2);
      setCam(cam, pos.add(shake(t, 5, 0.6).multiplyScalar(0.015)), tgt, 30);
      P = { focus: pos.distanceTo(new THREE.Vector3(0, 2.4, 0.4)), aperture: 6, maxCoc: 12 };
    } else {
      const k = (t - T.crouch) / (T.end - T.crouch);
      const pos = new THREE.Vector3(lerp(5, 6, k), lerp(1.6, 1.2, k), lerp(14, 15, k));
      const jy = jay.root.position.y;
      const tgt = new THREE.Vector3(0, lerp(1.8, 26, easeInOut(clamp((t - T.launch + 0.1) / 1.7))), 0);
      setCam(cam, pos.add(shake(t, 6, 1.2).multiplyScalar(0.03 + 0.08 * ss(t, T.launch, T.launch + 0.3) * Math.exp(-(t - T.launch) * 2))), tgt, 34);
      P = { focus: Math.max(8, pos.distanceTo(new THREE.Vector3(0, jy + 1.5, 0))), aperture: 3.5, maxCoc: 10 };
    }
    const fadeIn = 1 - ss(t, 0, 1.6);
    return { ...P, subframes: t > T.launch - 0.1 ? 2 : 1, shells: t < 6 ? 8 : 16, exposure: 1.05, bloom: 0.14, vignette: 0.45, sat: 1.18, contrast: 1.16, fade: fadeIn, ao: 0.6, aoRadius: 0.5, tintShadow: [0.92, 0.96, 1.08], tintHigh: [1.05, 1.0, 0.96] };
  },
};
export default shot;
