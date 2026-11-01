// Shared night setup for the campus (alarm + finale).
import * as THREE from 'three';
import { Campus, CU, LAYOUT, Arcs } from '../campus.js';

export async function nightScene(ctx, { moonInt = 0.9 } = {}) {
  const scene = new THREE.Scene();
  const HN = 'rogland_clear_night';
  const hdr = await ctx.loadHDR(HN, ctx.yawFor(HN, -0.6, -0.8));
  ctx.applySky(scene, hdr, { envInt: 0.4, bgInt: 0.13, shMul: 0.7 });
  scene.fog = new THREE.FogExp2(new THREE.Color('#121a33'), 0.006);
  const moon = new THREE.DirectionalLight(0x9db4ff, moonInt); moon.position.copy(hdr.sun).multiplyScalar(45);
  moon.castShadow = true; moon.shadow.mapSize.set(4096, 4096);
  Object.assign(moon.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 1, far: 120 }); moon.shadow.bias = -0.0004; moon.shadow.normalBias = 0.03;
  scene.add(moon, moon.target);
  const campus = ctx.campus || (ctx.campus = new Campus().build());
  campus.root.updateMatrixWorld(true);
  for (const d of campus.devices) d.pos.setFromMatrixPosition(d.g.matrixWorld);
  // permanently connected threads
  const tg = [];
  for (const d of campus.devices) tg.push({ pos: d.pos.clone(), y: 0.32, t0: -100 });
  const hq = LAYOUT.hq, fc = LAYOUT.factory;
  tg.push({ pos: new THREE.Vector3(hq.x - 2.5, 0, hq.z + hq.d / 2), y: 1.6, t0: -100 }, { pos: new THREE.Vector3(hq.x + 2.5, 0, hq.z + hq.d / 2), y: 2.1, t0: -100 }, { pos: new THREE.Vector3(hq.x, 0, hq.z), y: 2.6, t0: -100 },
    { pos: new THREE.Vector3(fc.x + 1, 0, fc.z), y: 1.8, t0: -100 }, { pos: LAYOUT.kiosk.clone(), y: 0.45, t0: -100 }, { pos: new THREE.Vector3(-5.6, 0, -3.2), y: 0.38, t0: -100 },
    { pos: new THREE.Vector3(LAYOUT.muster.x, 0, LAYOUT.muster.y), y: 0.05, t0: -100 }, { pos: new THREE.Vector3(13.3, 0, 8), y: 0.3, t0: -100 });
  const arcs = new Arcs(LAYOUT.pool, tg, 6); arcs.flashes.forEach((f) => (f.visible = false));
  scene.add(arcs.mesh);
  // lamp glows
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.2, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  for (const [x, z] of [[-5.8, -3], [5.8, -3], [-5.8, 6.3], [5.8, 6.3], [-2, 9.2], [2, 9.2], [8, 8.8], [-8, 9]]) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: new THREE.Color(2.2, 1.5, 0.8), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
    s.position.set(x, 0.93, z); s.scale.setScalar(0.9); scene.add(s);
  }
  // starfield
  {
    const n = 2600, pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let sd = 9;
    const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const u = rnd() * 2 - 1, a = rnd() * Math.PI * 2; const y = Math.abs(u) * 0.95 + 0.05; const r = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * r * 400, y * 400, Math.sin(a) * r * 400], i * 3);
      const b = Math.pow(rnd(), 6) * 3 + 0.25; const w = rnd(); col.set([b * (0.8 + 0.2 * w), b * 0.9, b * (1.1 - 0.2 * w)], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const st = new THREE.Points(g, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    st.frustumCulled = false; st.renderOrder = -5; scene.add(st);
  }
  return { scene, campus, arcs, moon, glowTex };
}

// glowing light-painting trails behind evacuating people
export class Trails {
  constructor(n, seg = 14) {
    this.n = n; this.seg = seg;
    const verts = n * seg * 2;
    this.pos = new Float32Array(verts * 3); this.a = new Float32Array(verts);
    const idx = [];
    for (let i = 0; i < n; i++) for (let k = 0; k < seg - 1; k++) { const b = (i * seg + k) * 2; idx.push(b, b + 1, b + 2, b + 1, b + 3, b + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('aA', new THREE.BufferAttribute(this.a, 1)); g.setIndex(idx);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(1.6, 1.2, 0.5) } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
      vertexShader: 'attribute float aA; varying float vA; void main(){ vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform vec3 uColor; varying float vA; void main(){ gl_FragColor = vec4(uColor * vA, vA); }',
    });
    this.mesh = new THREE.Mesh(g, this.mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 8; this.g = g;
  }
  // pts(i, k) -> [x, z] position k steps back in time (k=0 now); alpha(i)
  update(fn) {
    const w = 0.035;
    for (let i = 0; i < this.n; i++) {
      const pts = []; for (let k = 0; k < this.seg; k++) pts.push(fn(i, k));
      for (let k = 0; k < this.seg; k++) {
        const p = pts[k], q = pts[Math.min(k + 1, this.seg - 1)], r = pts[Math.max(k - 1, 0)];
        let dx = q[0] - r[0], dz = q[1] - r[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
        const ww = w * (1 - k / this.seg);
        const b = (i * this.seg + k) * 2;
        this.pos.set([p[0] - dz * ww, 0.03, p[1] + dx * ww], b * 3); this.pos.set([p[0] + dz * ww, 0.03, p[1] - dx * ww], (b + 1) * 3);
        const al = (p[2] ?? 1) * Math.pow(1 - k / this.seg, 1.5);
        this.a[b] = al; this.a[b + 1] = al;
      }
    }
    this.g.attributes.position.needsUpdate = true; this.g.attributes.aA.needsUpdate = true;
  }
}
