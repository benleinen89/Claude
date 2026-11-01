// Look-dev for the rigged glTF Jay: studio light, views ?cam=front|three|side|back|fly|wave|flyside
import * as THREE from 'three';
import { GJay, gFly, gWave } from '../gjay.js';
const shot = {
  name: 'gref', dur: 4,
  async init(ctx) {
    const scene = new THREE.Scene();
    const hdr = await ctx.loadHDR('studio_small_08');
    ctx.applySky(scene, hdr, { bg: false, envInt: 0.9, shMul: 1.0 });
    scene.background = new THREE.Color(0xe9edf3);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.4); key.position.set(-3, 5, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -1.5, right: 1.5, top: 2, bottom: -0.5, near: 0.5, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.6); rim.position.set(4, 4, -5);
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.6); fill.position.set(5, 1, 4);
    scene.add(key, rim, fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    this.g = await new GJay().load('/assets/jay_rig.glb');
    this.g.map(); console.log('[gjay] bones', JSON.stringify(this.g.names)); console.log('[gjay] map', JSON.stringify(this.g.B));
    scene.add(this.g.root);
    this.scene = scene; this.view = ctx.qs.get('cam') || 'three';
    this.camera = new THREE.PerspectiveCamera(28, ctx.W / ctx.H, 0.05, 100);
  },
  update(t) {
    const g = this.g, v = this.view;
    const yaw = { front: 0, three: 0.4, side: Math.PI / 2, back: Math.PI, fly: -Math.PI / 2, flyside: -Math.PI / 2, wave: 0.3 }[v] ?? 0;
    g.root.rotation.set(0, yaw, 0);
    g.root.position.set(0, v.startsWith('fly') ? 0.6 : 0, 0);
    g.pose(v.startsWith('fly') ? gFly(t) : v === 'wave' ? gWave(t) : {});
    g.root.updateMatrixWorld(true);
    const fly = v.startsWith('fly');
    const C = { flyfront: [-2.0, 1.25, 0.5, 0, 0.72, 0], flytop: [0.3, 2.6, 0.9, 0, 0.7, 0], flyside: [0.1, 0.85, 2.2, 0, 0.72, 0], fly: [0.9, 1.0, 2.0, 0, 0.72, 0], face: [0.15, 0.85, 1.3, 0, 0.82, 0] }[v] || [0.15, 0.62, 2.6, 0, 0.5, 0];
    this.camera.position.set(C[0], C[1], C[2]);
    this.camera.lookAt(C[3], C[4], C[5]);
    return { exposure: 1.0, bloom: 0.03, vignette: 0.0, grain: 0.0, ca: 0, sat: 1.04, contrast: 1.04, ao: 0.6, aoRadius: 0.15, shells: 0, focus: 3.3, aperture: 0 };
  },
};
export default shot;
