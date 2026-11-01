// Turntable look-development shot for the mascot.
import * as THREE from 'three';
const shot = {
  name: 'lookdev', dur: 8,
  async init(ctx) {
    const { jay } = ctx;
    const scene = new THREE.Scene();
    const hdr = await ctx.loadHDR('studio_small_08');
    scene.environment = hdr.env; scene.environmentIntensity = 0.6; scene.userData.sh = hdr.sh; scene.userData.equirect = hdr.tex;
    scene.background = new THREE.Color(0x1b2233);
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6); key.position.set(-4, 6, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -3; key.shadow.camera.right = 3; key.shadow.camera.top = 4; key.shadow.camera.bottom = -1; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02; key.shadow.radius = 4;
    const rim = new THREE.DirectionalLight(0x9fc0ff, 2.0); rim.position.set(4, 3, -5);
    scene.add(key, rim);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(6, 64), new THREE.MeshStandardMaterial({ color: 0x2a3348, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    scene.add(jay.root);
    this.scene = scene; this.jay = jay; this.cam = ctx.qs.get('cam') || 'full';
    this.camera = new THREE.PerspectiveCamera(30, ctx.W / ctx.H, 0.1, 100);
  },
  update(t) {
    const face = this.cam === 'face';
    const r = face ? 4.2 : 9.5;
    this.camera.position.set(0, face ? 2.5 : 1.7, r);
    this.camera.lookAt(0, face ? 2.4 : 1.5, 0);
    this.jay.root.rotation.y = -0.35 + t * Math.PI / 4;
    this.jay.pose({ jaw: 0.25, armL: { sh: [0, 0, 1.2], el: [0, 0, 1.4], wr: [0, 0.4, 0] } });
    return { exposure: 1.0, bloom: 0.04, vignette: 0.3, focus: 9.5, aperture: 0 };
  },
};
export default shot;
