// Above-the-clouds world: golden-hour sky dome, a billowing cloud sea (displaced
// surface with soft translucent shading), drifting wisps, and the 1908 door.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { NOISE_GLSL } from './fur.js';
import { radialTex } from './props.js';

const SKY_GLSL = /* glsl */`
uniform vec3 uSunDir, uSunCol, uZen, uHor, uLow; uniform float uFogDen;
vec3 skyCol(vec3 d){
  float y = d.y;
  float toward = dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(uSunDir.xz)) * 0.5 + 0.5;
  vec3 hor = mix(uHor * vec3(0.8, 0.85, 1.05), uHor * vec3(1.25, 1.0, 0.8), toward);
  vec3 c = mix(hor, uZen, pow(smoothstep(-0.02, 0.7, y), 0.7));
  c = mix(c, uLow, smoothstep(0.0, -0.25, y));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 8.0) * 0.25 + pow(sd, 90.0) * 0.6) + uSunCol * pow(sd, 2500.0) * 25.0;
  return c;
}
vec3 aerial(vec3 col, vec3 w){
  vec3 d = w - cameraPosition; float dist = length(d); vec3 dir = d / max(dist, 1e-3);
  float f = 1.0 - exp(-dist * uFogDen);
  return mix(col, skyCol(normalize(vec3(dir.x, max(dir.y, -0.05) * 0.3 + 0.02, dir.z))), clamp(f, 0.0, 1.0));
}`;

export class Clouds {
  constructor(sunDir) { this.root = new THREE.Group(); this.sunDir = sunDir.clone().normalize(); }
  build({ level = 60 } = {}) {
    this.level = level;
    const U = this.U = {
      uSunDir: { value: this.sunDir }, uSunCol: { value: new THREE.Color(3.0, 2.0, 1.2) },
      uZen: { value: new THREE.Color(0.04, 0.14, 0.45) }, uHor: { value: new THREE.Color(0.95, 0.62, 0.42) }, uLow: { value: new THREE.Color(0.55, 0.6, 0.75) },
      uFogDen: { value: 0.00045 }, uTime: { value: 0 },
    };
    // sky
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(8000, 48, 24), new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: `${SKY_GLSL}\nuniform float uTime; varying vec3 vD;\n${NOISE_GLSL}\nvoid main(){ vec3 d = normalize(vD); vec3 c = skyCol(d);
        if (d.y > 0.0) { vec2 uv = d.xz / (d.y + 0.1); float cl = smoothstep(0.55, 0.85, fbm3(vec3(uv * 0.9, 2.0))) * smoothstep(0.02, 0.3, d.y);
          float lit = pow(max(dot(d, uSunDir), 0.0), 4.0); c = mix(c, mix(vec3(1.0, 0.85, 0.8), uSunCol * 0.7, lit), cl * 0.5); }
        gl_FragColor = vec4(c, 1.0); }`,
    }));
    this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.root.add(this.sky);
    // cloud sea: displaced grid, denser near the centre
    const N = 420, S = 3000;
    const g = new THREE.PlaneGeometry(S, S, N, N); g.rotateX(-Math.PI / 2);
    // warp grid so resolution concentrates near origin
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i); const r = Math.hypot(x, z) / (S / 2); const k = Math.pow(r, 1.7) / Math.max(r, 1e-6); p.setX(i, x * k); p.setZ(i, z * k); }
    this.cloudMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uLevel: { value: level }, uHole: { value: new THREE.Vector3(0, 0, -1) }, uDoor: { value: new THREE.Vector3(0, 0, -1) } }, U), side: THREE.DoubleSide,
      vertexShader: `${NOISE_GLSL}\nuniform float uLevel, uTime; uniform vec3 uHole, uDoor; varying vec3 vW, vN; varying float vH;
        vec2 h22(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.xx + p3.yz) * p3.zy); }
        float dome(vec2 p){ vec2 i = floor(p), f = fract(p); float best = 0.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) { vec2 o = vec2(float(x), float(y)); vec2 r = h22(i + o); vec2 c = o + 0.15 + r * 0.7 - f;
            float rad = 0.55 + 0.35 * r.x; float d = dot(c, c) / (rad * rad); best = max(best, sqrt(max(0.0, 1.0 - d)) * (0.6 + 0.4 * r.y)); }
          return best; }
        float hgt(vec2 p){
          float h = dome(p / 70.0) * 34.0 + dome(p / 26.0 + 3.1) * 12.0 + dome(p / 9.0 + 7.7) * 3.5 + dome(p / 3.4 + 1.3) * 0.9;
          h += (vnoise3(vec3(p * 0.004, 1.0)) - 0.5) * 30.0 - 22.0;
          if (uHole.z > 0.0) h -= uHole.z * 46.0 * exp(-dot(p - uHole.xy, p - uHole.xy) / 160.0);
          if (uDoor.z > 0.0) { float d = length(p - uDoor.xy);
            h = mix(h, min(h, 1.0 + d * 0.12), smoothstep(60.0, 22.0, d));
            float mound = 9.4 - pow(max(d - 6.0, 0.0) / 16.0, 2.0) * 14.0 + (dome(p / 3.5) - 0.5) * 1.4 * smoothstep(9.0, 5.0, d);
            h = max(h, mound - 0.3); }
          return h; }
        void main(){ vec3 w = (modelMatrix * vec4(position, 1.0)).xyz;
          float e = 0.8; float h = hgt(w.xz); float hx = hgt(w.xz + vec2(e, 0.0)), hz = hgt(w.xz + vec2(0.0, e));
          vN = normalize(vec3(h - hx, e, h - hz));
          w.y = uLevel + h; vH = h; vW = w; gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }`,
      fragmentShader: `${SKY_GLSL}\nuniform float uTime, uLevel; varying vec3 vW, vN; varying float vH;\n${NOISE_GLSL}
        void main(){
          vec3 n = normalize(vN);
          vec3 V = normalize(cameraPosition - vW); bool under = cameraPosition.y < vW.y - 2.0;
          float ndl = dot(n, uSunDir);
          float wrap = max(0.0, (ndl + 0.5) / 1.5);
          float hgt = smoothstep(-25.0, 25.0, vH);
          vec3 amb = mix(vec3(0.38, 0.45, 0.68), vec3(0.75, 0.78, 0.9), n.y * 0.5 + 0.5) * (0.55 + 0.45 * hgt);
          vec3 c = amb * 0.62 + uSunCol * 0.38 * wrap * (0.55 + 0.45 * hgt);
          float fwd = pow(max(dot(-V, uSunDir), 0.0), 5.0);
          c += uSunCol * fwd * 0.5 * pow(1.0 - max(dot(n, V), 0.0), 2.0);
          c *= 0.92 + 0.16 * vnoise3(vW * 0.15);
          if (under) c = mix(vec3(0.3, 0.34, 0.44), vec3(0.85, 0.82, 0.85), smoothstep(-30.0, 5.0, vH));
          c = aerial(c, vW);
          if (any(isnan(c))) c = vec3(0.0);
          gl_FragColor = vec4(max(c, 0.0), 1.0);
        }`,
    });
    this.sea = new THREE.Mesh(g, this.cloudMat); this.sea.frustumCulled = false; this.root.add(this.sea);
    // wisps: soft sprites drifting over the sea
    const wispTex = this.wispTexture();
    this.wisps = [];
    let s = 7;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 70; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: wispTex, color: new THREE.Color(1.6, 1.35, 1.2), transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
      const a = rnd() * Math.PI * 2, r = 180 + rnd() * 500;
      sp.position.set(Math.cos(a) * r, level + 4 + rnd() * 18, Math.sin(a) * r - 120);
      sp.scale.set(60 + rnd() * 90, 18 + rnd() * 20, 1); sp.material.rotation = (rnd() - 0.5) * 0.3;
      sp.userData.v = 1 + rnd() * 2; sp.renderOrder = 3;
      this.root.add(sp); this.wisps.push(sp);
    }
    return this;
  }
  wispTexture() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
    for (let i = 0; i < 40; i++) {
      const cx = 40 + Math.random() * 176, cy = 44 + Math.random() * 40, r = 18 + Math.random() * 34;
      const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, 'rgba(255,255,255,0.22)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    }
    const t = new THREE.CanvasTexture(c); return t;
  }
  update(t) { this.U.uTime.value = t; for (const w of this.wisps) w.position.x += 0; }
}

// ---------------------------------------------------------------------------
// The 1908 door: oak planks, wrought-iron strap hinges with rivets, a brass lock
// case with exposed precision gears, sliding bolts, and a keyhole that drinks the drop.
function woodTex() {
  const c = document.createElement('canvas'); c.width = 1024; c.height = 2048; const x = c.getContext('2d');
  const planks = 6;
  for (let p = 0; p < planks; p++) {
    const x0 = p * 1024 / planks, w = 1024 / planks;
    const base = [92 + Math.random() * 18, 58 + Math.random() * 10, 34 + Math.random() * 8];
    x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`; x.fillRect(x0, 0, w, 2048);
    for (let i = 0; i < 260; i++) { // grain
      const gx = x0 + Math.random() * w; x.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 14},${10},${0.08 + Math.random() * 0.18})`;
      x.lineWidth = 0.6 + Math.random() * 2.2; x.beginPath(); x.moveTo(gx, 0);
      for (let y = 0; y <= 2048; y += 64) x.lineTo(gx + Math.sin(y * 0.004 + i) * 6 + Math.sin(y * 0.02 + i * 3) * 1.5, y); x.stroke();
    }
    for (let k = 0; k < 3; k++) { const ky = Math.random() * 2048, kx = x0 + w * (0.3 + Math.random() * 0.4); const g = x.createRadialGradient(kx, ky, 0, kx, ky, 26); g.addColorStop(0, 'rgba(25,12,5,0.8)'); g.addColorStop(1, 'rgba(25,12,5,0)'); x.fillStyle = g; x.beginPath(); x.ellipse(kx, ky, 12, 30, 0, 0, 7); x.fill(); }
    x.fillStyle = 'rgba(15,8,3,0.85)'; x.fillRect(x0, 0, 4, 2048); x.fillStyle = 'rgba(255,220,180,0.06)'; x.fillRect(x0 + 4, 0, 3, 2048);
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}
function gearShape(R, teeth, toothH, holeR) {
  const s = new THREE.Shape();
  const n = teeth * 4;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2; const ph = i % 4; const r = ph === 1 || ph === 2 ? R + toothH : R;
    const aa = a + (ph === 1 ? 0.15 : ph === 2 ? -0.15 : 0) * (Math.PI * 2 / teeth) * 0.5;
    const px = Math.cos(aa) * r, py = Math.sin(aa) * r; i ? s.lineTo(px, py) : s.moveTo(px, py);
  }
  const h = new THREE.Path(); h.absarc(0, 0, holeR, 0, Math.PI * 2, true); s.holes.push(h);
  // spokes as cut-outs
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; const c = new THREE.Path(); const rr = R * 0.6; c.absarc(Math.cos(a) * rr, Math.sin(a) * rr, R * 0.18, 0, Math.PI * 2, true); if (R > 0.12) s.holes.push(c); }
  return s;
}
export class Door {
  constructor() { this.root = new THREE.Group(); }
  build() {
    const W = 2.8, H = 4.8, T = 0.18;
    const wood = new THREE.MeshStandardMaterial({ map: woodTex(), roughness: 0.75, metalness: 0 });
    const iron = new THREE.MeshStandardMaterial({ color: '#2a2724', roughness: 0.55, metalness: 0.85 });
    const brass = new THREE.MeshStandardMaterial({ color: '#c9a55a', roughness: 0.28, metalness: 1 });
    const brassDark = new THREE.MeshStandardMaterial({ color: '#8a6a32', roughness: 0.4, metalness: 1 });
    const stone = new THREE.MeshStandardMaterial({ color: '#cfc6b8', roughness: 0.85 });
    // frame: stone jambs + lintel with an arch-ish keystone
    const frame = new THREE.Group(); this.root.add(frame);
    const jamb = new RoundedBoxGeometry(0.5, H + 0.3, 0.6, 3, 0.05);
    const fl = new THREE.Mesh(jamb, stone); fl.position.set(-W / 2 - 0.25, (H + 0.3) / 2, 0); const fr = fl.clone(); fr.position.x = W / 2 + 0.25;
    const lint = new THREE.Mesh(new RoundedBoxGeometry(W + 1.3, 0.55, 0.7, 3, 0.06), stone); lint.position.set(0, H + 0.55, 0);
    const key = new THREE.Mesh(new RoundedBoxGeometry(0.45, 0.75, 0.75, 3, 0.05), stone); key.position.set(0, H + 0.7, 0.02);
    const step = new THREE.Mesh(new RoundedBoxGeometry(W + 1.6, 0.3, 1.4, 3, 0.06), stone); step.position.set(0, -0.15, 0.2);
    frame.add(fl, fr, lint, key, step);
    frame.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
    // door leaf on a hinge pivot at left edge
    const hinge = this.hinge = new THREE.Group(); hinge.position.set(-W / 2, 0, 0); this.root.add(hinge);
    const leaf = new THREE.Group(); leaf.position.set(W / 2, 0, 0); hinge.add(leaf);
    const slab = new THREE.Mesh(new RoundedBoxGeometry(W - 0.04, H, T, 2, 0.02), [wood, wood, wood, wood, wood, wood]);
    slab.position.y = H / 2; slab.castShadow = slab.receiveShadow = true; leaf.add(slab);
    // strap hinges with rivets
    const straps = [];
    for (const y of [0.7, H - 0.7]) {
      const st = new RoundedBoxGeometry(2.1, 0.16, 0.04, 2, 0.015); st.translate(-W / 2 + 1.05, y, T / 2 + 0.02); straps.push(st);
      const tip = new THREE.CylinderGeometry(0.12, 0.12, 0.04, 24); tip.rotateX(Math.PI / 2); tip.translate(-W / 2 + 2.1, y, T / 2 + 0.02); straps.push(tip);
      for (let i = 0; i < 6; i++) { const r = new THREE.SphereGeometry(0.03, 10, 6); r.translate(-W / 2 + 0.2 + i * 0.36, y, T / 2 + 0.045); straps.push(r); }
      const knuckle = new THREE.CylinderGeometry(0.07, 0.07, 0.4, 16); knuckle.translate(-W / 2 - 0.02, y, 0); straps.push(knuckle);
    }
    const strapM = new THREE.Mesh(mergeGeometries(straps.map((g) => (g.index ? g.toNonIndexed() : g))), iron); strapM.castShadow = true; leaf.add(strapM);
    // brass lock case (glass-fronted so the mechanism is visible)
    const LC = this.lockCenter = new THREE.Vector3(0.55, 2.25, T / 2);
    const lock = this.lock = new THREE.Group(); lock.position.copy(LC); leaf.add(lock);
    const plate = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.25, 0.06, 3, 0.03), brassDark); plate.position.z = 0.03; plate.castShadow = true; lock.add(plate);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.035, 10, 4, Math.PI * 2), brass); rim.rotation.z = Math.PI / 4; rim.scale.set(1, 1.05, 1); rim.position.z = 0.07; lock.add(rim);
    const gears = this.gears = [];
    const mk = (R, teeth, x, y, z, mat, ratio) => {
      const ge = new THREE.ExtrudeGeometry(gearShape(R, teeth, R * 0.14, R * 0.12), { depth: 0.025, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 6 });
      const m = new THREE.Mesh(ge, mat); m.position.set(x, y, z); m.castShadow = true; lock.add(m); gears.push({ m, ratio }); return m;
    };
    mk(0.3, 24, -0.15, 0.12, 0.07, brass, 1); mk(0.17, 14, 0.28, 0.33, 0.075, brass, -1.75); mk(0.13, 11, 0.3, -0.12, 0.08, brassDark, -2.3);
    mk(0.09, 8, -0.32, -0.35, 0.08, brass, 3.3); mk(0.2, 16, 0.1, -0.38, 0.065, brassDark, -1.5);
    // keyhole escutcheon + keyhole glow
    const esc = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), brass); esc.rotation.x = Math.PI / 2; esc.position.set(-0.15, 0.12, 0.12); lock.add(esc);
    const khShape = new THREE.Shape(); khShape.absarc(0, 0.02, 0.028, 0, Math.PI * 2); const kh2 = new THREE.Shape(); kh2.moveTo(-0.014, 0.0); kh2.lineTo(0.014, 0.0); kh2.lineTo(0.022, -0.075); kh2.lineTo(-0.022, -0.075); kh2.closePath();
    this.keyGlowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.02, 0.02, 0.02) });
    const kh = new THREE.Mesh(new THREE.ShapeGeometry([khShape, kh2]), this.keyGlowMat); kh.position.set(-0.15, 0.13, 0.137); lock.add(kh);
    // bolts sliding into the right jamb
    this.bolts = [];
    for (const y of [-0.45, 0.45]) {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 20), brass); b.rotation.z = Math.PI / 2; b.position.set(0.95, y, 0.07); b.castShadow = true; lock.add(b); this.bolts.push(b);
    }
    // ring pull
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.025, 12, 40), iron); ring.position.set(0.55, 1.45, T / 2 + 0.06); leaf.add(ring);
    // light behind the door (revealed when it opens)
    const light = this.portal = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.2, 4.2) }));
    light.position.set(0, H / 2, -0.12); this.root.add(light);
    const halo = this.halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex(), color: new THREE.Color(3, 2.4, 1.6), blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, opacity: 0 }));
    halo.position.set(0, H / 2, 0.3); halo.scale.set(12, 12, 1); this.root.add(halo);
    this.W = W; this.H = H;
    return this;
  }
  // unlock: 0..1 gear spin, bolts 0..1 retracted, open 0..1 swing
  set({ spin = 0, bolts = 0, open = 0, glow = 0 }) {
    for (const g of this.gears) g.m.rotation.z = spin * g.ratio;
    this.bolts.forEach((b) => (b.position.x = 0.95 - bolts * 0.75));
    this.hinge.rotation.y = -open * 1.9;
    this.keyGlowMat.color.setRGB(0.02 + glow * 1.5, 0.02 + glow * 4.5, 0.02 + glow * 8);
    this.halo.material.opacity = Math.min(1, open * 1.6);
    this.halo.scale.setScalar(6 + open * 26);
  }
}
