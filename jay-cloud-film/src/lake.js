// Phoksundo-inspired alpine lake at dawn: procedural ridged mountains with baked sun
// shadows (alpenglow), aerial perspective, a dawn sky dome, a mirror lake with ripples,
// and drifting mist.
import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { NOISE_GLSL } from './fur.js';

// ---------- 2D gradient noise (CPU) ----------
const PERM = new Uint8Array(512);
{ const p = new Uint8Array(256).map((_, i) => i); let s = 1337; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) PERM[i] = p[i & 255]; }
const G2 = Array.from({ length: 256 }, (_, i) => [Math.cos(i * 2.399963), Math.sin(i * 2.399963)]);
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * fx * (fx * (fx * 6 - 15) + 10), v = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
  const g = (i, j) => G2[PERM[(PERM[(ix + i) & 255] + iy + j) & 255]];
  const d = (i, j) => { const gg = g(i, j); return gg[0] * (fx - i) + gg[1] * (fy - j); };
  const a = d(0, 0), b = d(1, 0), c = d(0, 1), e = d(1, 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + e) * u * v) * 1.4;
}
function ridged(x, y, oct = 7) {
  let sum = 0, amp = 0.5, freq = 1, prev = 1, norm = 0;
  for (let i = 0; i < oct; i++) {
    let n = 1 - Math.abs(noise2(x * freq, y * freq)); n *= n;
    sum += n * amp * prev; norm += amp; prev = Math.min(1, n * 1.6);
    freq *= 2.03; amp *= 0.5;
  }
  return sum / norm;
}
function fbm(x, y, oct = 5) { let s = 0, a = 0.5, f = 1; for (let i = 0; i < oct; i++) { s += a * noise2(x * f, y * f); f *= 2.02; a *= 0.5; } return s; }
const sst = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const LAKE_R = 150;
export function heightAt(x, z) {
  const ang = Math.atan2(z, x);
  const r = Math.hypot(x * 1.15, z * 0.78) + fbm(Math.cos(ang) * 1.5 + 5, Math.sin(ang) * 1.5 + 5, 3) * 55;
  const shore = sst(LAKE_R - 12, LAKE_R + 60, r);
  const wx = x + fbm(x / 400, z / 400, 3) * 160, wz = z + fbm(x / 400 + 7, z / 400 + 3, 3) * 160;
  const rid = ridged(wx / 380, wz / 380, 6);
  const far = sst(LAKE_R + 15, LAKE_R + 420, r);
  let h = shore * shore * 28 + Math.pow(rid, 1.35) * (150 + 330 * sst(380, 1100, r)) * far + rid * 34 * shore;
  h -= (1 - shore) * 25;
  return h;
}

export class Lake {
  constructor(sunDir) { this.root = new THREE.Group(); this.sunDir = sunDir.clone().normalize(); this.U = {}; }

  build({ size = 2600, res = 480 } = {}) {
    const U = this.U = {
      uSunDir: { value: this.sunDir }, uSunCol: { value: new THREE.Color(3.6, 1.55, 0.95) },
      uSkyTop: { value: new THREE.Color(0.025, 0.06, 0.2) }, uSkyHor: { value: new THREE.Color(0.75, 0.48, 0.55) }, uSkyLow: { value: new THREE.Color(0.25, 0.3, 0.48) },
      uFogDen: { value: 0.00026 }, uFogH: { value: 110 }, uTime: { value: 0 }, uStars: { value: 0.4 }, uAmb: { value: new THREE.Color(0.32, 0.38, 0.6) },
      uExpo: { value: 1 },
    };
    // ---------------- terrain ----------------
    const N = res, step = size / N;
    const pos = new Float32Array((N + 1) * (N + 1) * 3), H = new Float32Array((N + 1) * (N + 1));
    for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) {
      const x = -size / 2 + i * step, z = -size / 2 + j * step;
      const h = heightAt(x, z); const k = j * (N + 1) + i; H[k] = h;
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
    }
    const idx = [];
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    // bake sun visibility (soft horizon test) + cavity AO
    const Hs = (x, z) => { const fi = (x + size / 2) / step, fj = (z + size / 2) / step; const i = Math.max(0, Math.min(N - 1, Math.floor(fi))), j = Math.max(0, Math.min(N - 1, Math.floor(fj))); const u = Math.min(1, Math.max(0, fi - i)), v = Math.min(1, Math.max(0, fj - j)); const k = j * (N + 1) + i; return (H[k] * (1 - u) + H[k + 1] * u) * (1 - v) + (H[k + N + 1] * (1 - u) + H[k + N + 2] * u) * v; };
    const sd = this.sunDir; const hl = Math.hypot(sd.x, sd.z); const tanE = sd.y / hl; const dx = sd.x / hl, dz = sd.z / hl;
    const vis = new Float32Array((N + 1) * (N + 1)), ao = new Float32Array((N + 1) * (N + 1));
    for (let k = 0; k < H.length; k++) {
      const x = pos[k * 3], z = pos[k * 3 + 2], h0 = H[k] + 0.5;
      let occ = 1; let d = step * 0.7;
      for (let s = 0; s < 70 && d < 1400; s++) { const hh = Hs(x + dx * d, z + dz * d); const ray = h0 + d * tanE; const diff = (hh - ray) / (d * 0.06 + 2); occ = Math.min(occ, sst(1, -1, diff)); if (occ <= 0) break; d *= 1.09; d += step * 0.3; }
      vis[k] = occ;
      const i = k % (N + 1), j = Math.floor(k / (N + 1));
      if (i > 1 && j > 1 && i < N - 1 && j < N - 1) { const lap = (H[k - 2] + H[k + 2] + H[k - 2 * (N + 1)] + H[k + 2 * (N + 1)]) * 0.25 - H[k]; ao[k] = Math.max(0.35, Math.min(1.05, 1 - lap * 0.045)); } else ao[k] = 1;
    }
    geo.setAttribute('aVis', new THREE.BufferAttribute(vis, 1)); geo.setAttribute('aAO', new THREE.BufferAttribute(ao, 1));
    const terrMat = new THREE.ShaderMaterial({
      uniforms: U,
      vertexShader: /* glsl */`attribute float aVis, aAO; varying vec3 vW, vN; varying float vVis, vAO;
        void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normal; vVis = aVis; vAO = aAO; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uSkyLow, uAmb; uniform float uFogDen, uFogH, uTime;
        varying vec3 vW, vN; varying float vVis, vAO;
        ${NOISE_GLSL}
        ${AERIAL_GLSL}
        void main(){
          vec3 n = normalize(vN);
          float slope = 1.0 - n.y;
          float h = vW.y;
          float nz = fbm3(vW * 0.035); float nz2 = fbm3(vW * 0.22);
          // detail normal from noise
          vec3 dn = vec3(fbm3(vW * 0.06 + 3.1) - 0.5, 0.0, fbm3(vW * 0.06 + 7.7) - 0.5) + 0.5 * vec3(vnoise3(vW * 0.35) - 0.5, 0.0, vnoise3(vW * 0.35 + 9.0) - 0.5);
          n = normalize(n + dn * 1.5 * (0.25 + slope));
          vec3 rock = mix(vec3(0.16, 0.14, 0.13), vec3(0.36, 0.31, 0.27), nz);
          rock *= 0.8 + 0.4 * fbm3(vec3(vW.x * 0.01, vW.y * 0.25, vW.z * 0.01));   // strata
          vec3 scree = vec3(0.45, 0.4, 0.34) * (0.8 + 0.3 * nz2);
          vec3 forest = mix(vec3(0.05, 0.09, 0.05), vec3(0.09, 0.13, 0.06), nz2);
          vec3 c = mix(scree, rock, smoothstep(0.25, 0.5, slope));
          float fm = smoothstep(0.62, 0.45, slope) * smoothstep(110.0, 40.0, h) * smoothstep(0.45, 0.6, fbm3(vW * 0.02 + 11.0)) * smoothstep(-2.0, 6.0, h);
          c = mix(c, forest, fm);
          float snowLine = 105.0 + nz * 60.0;
          float snow = smoothstep(snowLine, snowLine + 30.0, h) * smoothstep(0.82, 0.5, slope + nz2 * 0.2);
          c = mix(c, vec3(0.92, 0.94, 1.0), snow);
          float beach = smoothstep(4.0, 0.5, h);
          c = mix(c, vec3(0.5, 0.47, 0.42), beach * 0.7);
          float ndl = max(dot(n, uSunDir), 0.0);
          float sh = vVis;
          vec3 sky = mix(uSkyLow, uSkyTop, n.y * 0.5 + 0.5) * 1.1 + uAmb * 0.8;
          vec3 col = c * (uSunCol * ndl * sh + sky * vAO * (0.55 + 0.45 * n.y));
          col += c * uSunCol * 0.08 * snow * sh;  // snow glow / alpenglow lift
          col = aerial(col, vW);
          gl_FragColor = vec4(col, 1.0);
        }`,
    });
    this.terrain = new THREE.Mesh(geo, terrMat); this.terrain.userData.tag = 'terrain'; this.root.add(this.terrain);
    // ---------------- sky dome ----------------
    const skyMat = new THREE.ShaderMaterial({
      uniforms: U, side: THREE.BackSide, depthWrite: false,
      vertexShader: 'varying vec3 vD; void main(){ vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
      fragmentShader: /* glsl */`uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uSkyLow; uniform float uTime, uStars, uFogDen, uFogH; varying vec3 vD;
        ${NOISE_GLSL}
        ${AERIAL_GLSL}
        void main(){
          vec3 d = normalize(vD);
          vec3 c = skyCol(d);
          // high wispy clouds catching dawn light
          if (d.y > 0.0) {
            vec2 uv = d.xz / (d.y + 0.08) * 1.4;
            float cl = fbm3(vec3(uv * 1.3 + vec2(uTime * 0.01, 0.0), 1.0)); cl = smoothstep(0.52, 0.8, cl) * smoothstep(0.0, 0.25, d.y);
            float lit = pow(max(dot(d, uSunDir), 0.0), 3.0);
            c = mix(c, mix(vec3(0.75, 0.45, 0.55), vec3(1.6, 0.85, 0.6), lit * 0.8 + 0.2), cl * 0.75);
            // fading stars
            vec3 sp = floor(d * 420.0); float st = step(0.9975, fhash13(sp)) * fhash13(sp + 3.0);
            c += st * uStars * smoothstep(0.15, 0.6, d.y) * (1.0 - cl);
          }
          gl_FragColor = vec4(c, 1.0);
        }`,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 48, 24), skyMat); this.sky.frustumCulled = false; this.sky.renderOrder = -10; this.root.add(this.sky);
    // ---------------- water ----------------
    this.drops = Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0));
    const waterShader = {
      uniforms: Object.assign({ color: { value: new THREE.Color() }, tDiffuse: { value: null }, textureMatrix: { value: null }, uDrops: { value: this.drops }, uSwirl: { value: 0 } }, U),
      vertexShader: /* glsl */`uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vW;
        void main(){ vUv = textureMatrix * vec4(position, 1.0); vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: /* glsl */`uniform sampler2D tDiffuse; uniform vec4 uDrops[4]; uniform float uSwirl;
        uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uSkyLow; uniform float uTime, uFogDen, uFogH;
        varying vec4 vUv; varying vec3 vW;
        ${NOISE_GLSL}
        ${AERIAL_GLSL}
        void main(){
          vec2 p = vW.xz; vec2 g = vec2(0.0); float glow = 0.0;
          // gentle wind ripples (two scales)
          float t = uTime;
          g += (vec2(vnoise3(vec3(p * 0.9, t * 0.35)), vnoise3(vec3(p * 0.9 + 17.0, t * 0.35))) - 0.5) * 0.06;
          g += (vec2(vnoise3(vec3(p * 3.1, t * 0.6)), vnoise3(vec3(p * 3.1 + 5.0, t * 0.6))) - 0.5) * 0.025;
          for (int i = 0; i < 4; i++) { vec4 d = uDrops[i]; float tt = uTime - d.z; if (tt < 0.0 || tt > 9.0) continue;
            float r = length(p - d.xy); vec2 dir = (p - d.xy) / max(r, 1e-3);
            float env = exp(-pow((r - tt * 2.2) * 0.9, 2.0)) * exp(-tt * 0.35) + 0.6 * exp(-pow((r - tt * 1.5) * 1.3, 2.0)) * exp(-tt * 0.5);
            g += dir * cos(r * 4.0 - tt * 9.0) * env * 0.35 * d.w; glow += env * d.w * exp(-tt * 0.4); }
          // swirl around the birth point
          if (uSwirl > 0.0) { float r = length(p); vec2 tg = vec2(-p.y, p.x) / max(r, 0.01);
            float sw = uSwirl * exp(-r * 0.25) ; g += tg * sin(r * 3.0 - t * 6.0) * sw * 0.4 + p / max(r, 0.01) * cos(r * 5.0 - t * 8.0) * sw * 0.2; glow += sw * 0.6 * exp(-r * 0.5); }
          vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
          vec3 V = normalize(cameraPosition - vW);
          float fr = 0.02 + 0.98 * pow(1.0 - max(dot(n, V), 0.0), 5.0);
          vec2 ruv = vUv.xy / vUv.w + n.xz * 0.06;
          vec3 refl = texture2D(tDiffuse, ruv).rgb;
          // water body: Phoksundo turquoise, deeper blue far from shore
          float shoreD = length(vec2(vW.x * 1.15, vW.z * 0.78));
          vec3 deep = vec3(0.0, 0.07, 0.12), turq = vec3(0.02, 0.3, 0.34);
          vec3 body = mix(deep, turq, smoothstep(${LAKE_R - 90}.0, ${LAKE_R + 10}.0, shoreD) * 0.8 + 0.2);
          vec3 sky = mix(uSkyLow, uSkyTop, 0.5);
          body *= (0.35 + 0.5 * sky);
          vec3 col = mix(body, refl, fr);
          vec3 H = normalize(uSunDir + V); col += uSunCol * pow(max(dot(n, H), 0.0), 600.0) * 1.5;
          col += vec3(0.15, 0.75, 1.0) * glow * 0.9;
          col = aerial(col, vW);
          gl_FragColor = vec4(col, 1.0);
        }`,
    };
    this.water = new Reflector(new THREE.PlaneGeometry(4000, 4000), { textureWidth: 960, textureHeight: 540, clipBias: 0.002, shader: waterShader, multisample: 0 });
    this.water.rotation.x = -Math.PI / 2; this.water.position.y = 0; this.water.userData.tag = 'water'; this.root.add(this.water);
    this.water.material.uniforms.uDrops.value = this.drops;
    this.waterU = this.water.material.uniforms;
    // ---------------- mist sheets ----------------
    const mistMat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uSeed: { value: 0 }, uOp: { value: 0.5 } }, U), transparent: true, depthWrite: false,
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: /* glsl */`uniform float uTime, uSeed, uOp, uFogDen, uFogH; uniform vec3 uSunDir, uSunCol, uSkyTop, uSkyHor, uSkyLow; varying vec3 vW;
        ${NOISE_GLSL}
        ${AERIAL_GLSL}
        void main(){
          vec2 p = vW.xz * 0.012 + vec2(uTime * 0.008, uSeed);
          float m = fbm3(vec3(p, uSeed)) ; m = smoothstep(0.42, 0.85, m);
          float r = length(vW.xz); m *= smoothstep(900.0, 200.0, r) * smoothstep(8.0, 40.0, r);
          vec3 V = normalize(vW - cameraPosition);
          vec3 c = skyCol(normalize(vec3(V.x, 0.05, V.z))) * 0.95 + uSunCol * 0.06 * pow(max(dot(V, uSunDir), 0.0), 4.0);
          float a = m * uOp * smoothstep(0.0, 60.0, length(vW - cameraPosition)) * step(vW.y, cameraPosition.y - 0.5);
          gl_FragColor = vec4(c, a);
        }`,
    });
    this.mists = [];
    for (let i = 0; i < 2; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), mistMat.clone()); m.material.uniforms = Object.assign({}, U, { uSeed: { value: i * 3.7 }, uOp: { value: 0.16 } }); m.userData.tag = 'mist'; m.rotation.x = -Math.PI / 2; m.position.y = 1.2 + i * 3; m.renderOrder = 2; this.root.add(m); this.mists.push(m); }
    return this;
  }
}

// shared aerial perspective + sky colour (needs uSunDir/uSunCol/uSky*/uFogDen/uFogH)
export const AERIAL_GLSL = /* glsl */`
vec3 skyCol(vec3 d){
  float y = d.y;
  float toward = dot(normalize(vec2(d.x, d.z) + 1e-5), normalize(uSunDir.xz)) * 0.5 + 0.5;
  vec3 hor = mix(uSkyHor * vec3(0.85, 0.75, 1.0), uSkyHor * vec3(1.35, 1.0, 0.75), toward);
  vec3 c = mix(hor, uSkyTop, smoothstep(0.02, 0.5, y));
  // earth shadow band opposite the sun
  c = mix(c, uSkyLow * 0.9, (1.0 - toward) * (1.0 - smoothstep(0.0, 0.06, y)) * 0.7);
  c = mix(c, uSkyLow, smoothstep(0.0, -0.3, y));
  float sd = max(dot(d, uSunDir), 0.0);
  c += uSunCol * (pow(sd, 6.0) * 0.18 + pow(sd, 60.0) * 0.5) * smoothstep(-0.2, 0.1, y);
  c += uSunCol * pow(sd, 3000.0) * 20.0;
  return c;
}
vec3 aerial(vec3 col, vec3 w){
  vec3 d = w - cameraPosition; float dist = length(d); vec3 dir = d / max(dist, 1e-3);
  float hfac = exp(-max(min(w.y, cameraPosition.y), 0.0) / uFogH);
  float f = 1.0 - exp(-dist * uFogDen * (0.35 + 0.65 * hfac));
  vec3 fc = skyCol(normalize(vec3(dir.x, max(dir.y, 0.02) * 0.4, dir.z)));
  return mix(col, fc, clamp(f, 0.0, 1.0));
}`;
