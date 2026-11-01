// Small shared props: the glowing lake drop, splash crowns, light rings.
import * as THREE from 'three';
import { rngf } from './anim.js';

// The drop of Phoksundo water Jay carries through the film.
export function makeDrop(r = 0.12) {
  const g = new THREE.Group();
  const shellMat = new THREE.MeshPhysicalMaterial({ color: '#7fd8ff', roughness: 0.02, metalness: 0, transmission: 0, transparent: true, opacity: 0.55, clearcoat: 1, emissive: '#2aa8ff', emissiveIntensity: 1.2 });
  const geo = new THREE.SphereGeometry(r, 48, 32);
  // teardrop: pull the top up
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > 0) { const k = y / r; p.setY(i, y * (1 + 0.55 * k * k)); const s = 1 - 0.35 * k * k; p.setX(i, p.getX(i) * s); p.setZ(i, p.getZ(i) * s); } }
  geo.computeVertexNormals();
  const shell = new THREE.Mesh(geo, shellMat);
  const core = new THREE.Mesh(new THREE.SphereGeometry(r * 0.55, 24, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3.2) }));
  g.add(shell, core);
  // soft additive halo sprite
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(), color: new THREE.Color(0.25, 0.7, 1.6), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  halo.scale.setScalar(r * 9); g.add(halo);
  const light = new THREE.PointLight(0x5cc8ff, 2.5, 4, 2); g.add(light);
  g.userData = { shell, core, halo, light, r };
  return g;
}

let _radial = null;
export function radialTex() {
  if (_radial) return _radial;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const x = c.getContext('2d'); const gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.2, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.5, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
  _radial = new THREE.CanvasTexture(c); return _radial;
}

// Analytic splash: instanced droplets thrown up in a crown, all a function of time since impact.
export class Splash {
  constructor(n = 90, color = '#bfefff', size = 0.035) {
    this.n = n;
    const geo = new THREE.SphereGeometry(size, 10, 8);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, emissive: '#3ab6ff', emissiveIntensity: 0.6, transparent: true, opacity: 0.9 }), n);
    this.mesh.frustumCulled = false;
    const r = rngf(99);
    this.p = Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + r() * 0.2;
      const crown = i < n * 0.7;
      const sp = crown ? 1.1 + r() * 0.9 : 0.2 + r() * 0.4;
      const up = crown ? 2.2 + r() * 1.6 : 4 + r() * 2.5;
      return { a, sp, up, s: 0.5 + r() * 0.9 };
    });
  }
  update(t, origin, scale = 1) {
    const M = new THREE.Matrix4();
    for (let i = 0; i < this.n; i++) {
      const q = this.p[i];
      if (t < 0 || t > 2.2) { M.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, M); continue; }
      const x = Math.cos(q.a) * q.sp * t, z = Math.sin(q.a) * q.sp * t;
      const y = q.up * t - 4.9 * t * t;
      const vis = y < -0.05 ? 0 : 1;
      const s = q.s * vis * scale * (1 - t / 2.3);
      M.compose(new THREE.Vector3(origin.x + x * scale, origin.y + Math.max(y, 0) * scale, origin.z + z * scale), new THREE.Quaternion(), new THREE.Vector3(s, s * (1 + Math.abs(q.up - 9.8 * t) * 0.08), s));
      this.mesh.setMatrixAt(i, M);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

// expanding wall of light (wavefront)
export function makeLightRing(color = new THREE.Color(0.3, 0.8, 2.0)) {
  const geo = new THREE.CylinderGeometry(1, 1, 1, 160, 1, true); geo.translate(0, 0.5, 0);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: color }, uAlpha: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform vec3 uColor; uniform float uAlpha; varying vec2 vUv; void main(){ float a = pow(1.0 - vUv.y, 2.2) * uAlpha; gl_FragColor = vec4(uColor * a, a); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.renderOrder = 10;
  return m;
}
