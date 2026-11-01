// Reference-match look-dev: Jay in the pose/angle of the brand render, studio lit,
// rendered portrait so it can be compared side by side with the reference image.
import * as THREE from 'three';
import { idle } from '../jaypose.js';
const shot = {
  name: 'ref', dur: 4,
  async init(ctx) {
    const { jay } = ctx;
    const scene = new THREE.Scene();
    const hdr = await ctx.loadHDR('studio_small_08');
    ctx.applySky(scene, hdr, { bg: false, envInt: 0.9, shMul: 1.0 });
    scene.background = new THREE.Color(0xe9edf3);
    const key = new THREE.DirectionalLight(0xfff4e8, 2.4); key.position.set(-3, 5, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: 0.5, far: 30 }); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.6); rim.position.set(4, 4, -5);
    const fill = new THREE.DirectionalLight(0xe8eeff, 0.6); fill.position.set(5, 1, 4);
    scene.add(key, rim, fill);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshStandardMaterial({ color: 0xdfe3ea, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    this.scene = scene; this.jay = jay; this.view = ctx.qs.get('cam') || 'ref';
    this.camera = new THREE.PerspectiveCamera(24, ctx.W / ctx.H, 0.1, 100);
  },
  update(t) {
    const jay = this.jay; this.scene.add(jay.root);
    const v = this.view;
    const yaw = v === 'front' ? 0 : v === 'side' ? Math.PI / 2 : v === 'back' ? Math.PI : 0.32;
    jay.root.position.set(0, 0, 0); jay.root.rotation.set(0, yaw, 0); jay.root.scale.setScalar(1);
    jay.pose({ ...idle(0, 0),
      head: [0.04, 0.12, -0.06], jaw: 0.3, eyes: [0.08, 0.02],
      armL: { out: 1.15, bend: 1.45, wrist: [0, 0.35, 0.1] }, armR: { out: 0.18, fwd: 0.05 },
      torso: [0, 0.06, 0], badge: [0, 0, 0.04],
    });
    const face = v === 'face', badge = v === 'badge';
    if (badge) { this.camera.position.set(0.5, 1.3, 4.0); this.camera.lookAt(0.1, 1.2, 0.4); }
    else { this.camera.position.set(face ? 0.4 : 0.6, face ? 2.4 : 1.55, face ? 5.2 : 11.5); this.camera.lookAt(0, face ? 2.35 : 1.5, 0); }
    this.jay.root.updateMatrixWorld(true);
    return { exposure: 1.0, bloom: 0.03, vignette: 0.0, grain: 0.0, ca: 0, sat: 1.04, contrast: 1.04, ao: 0.6, aoRadius: 0.25, shells: 24 };
  },
};
export default shot;
