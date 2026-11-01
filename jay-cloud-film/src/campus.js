// The miniature workplace: HQ, factory, gatehouse, plaza with a reflecting pool,
// muster lawn, trees, lamps, cars and ~60 little people. Everything listens to a
// shared "wave" (the ripple from Jay's drop) and an alarm uniform.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { NOISE_GLSL } from './fur.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const CU = { // campus-wide uniforms
  uWaveC: { value: new THREE.Vector2(0, 0) },
  uWaveR: { value: -1 },          // radius of the activation front
  uWaveW: { value: 1.2 },
  uAlarm: { value: 0 },           // 0..1 red alarm mood
  uAlarmT: { value: 0 },
  uNight: { value: 0 },           // window glow amount independent of wave
  uTime: { value: 0 },
  uDesat: { value: 0.85 },        // how grey the world is before the wave
};

const WAVE_PARS = /* glsl */`
uniform vec2 uWaveC; uniform float uWaveR, uWaveW, uAlarm, uAlarmT, uNight, uDesat, uTime;
varying vec3 vWPos;
float waveAct(vec2 p){ return smoothstep(0.0, 1.0, (uWaveR - length(p - uWaveC)) / 1.5 + 0.5); }
float waveFront(vec2 p){ float d = length(p - uWaveC) - uWaveR; return exp(-d * d / (uWaveW * uWaveW * 0.22)) * step(0.0, uWaveR) * step(uWaveR, 200.0); }
`;

// patch a standard material so it greys out until the wave passes, and glows on the front
export function wavePatch(mat, { emissiveOn = null, glowFront = 0.0, key = '', grid = false } = {}) {
  const ex = { uEmOn: { value: emissiveOn ? new THREE.Color(emissiveOn) : new THREE.Color(0, 0, 0) }, uGlowFront: { value: glowFront } };
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, CU, ex);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
        vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
        #ifdef USE_INSTANCING
          vWPos = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
        #endif`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${WAVE_PARS}\nuniform vec3 uEmOn; uniform float uGlowFront;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float act = waveAct(vWPos.xz);
        float lg = dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11));
        vec3 greyC = mix(diffuseColor.rgb, vec3(lg) * vec3(0.86, 0.92, 1.04), uDesat) * (1.0 - 0.28 * uDesat);
        diffuseColor.rgb = mix(greyC, diffuseColor.rgb * vec3(1.04, 1.0, 0.96), act);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += uEmOn * act;
        totalEmissiveRadiance += vec3(0.25, 0.7, 1.0) * waveFront(vWPos.xz) * uGlowFront;
        ${grid ? `{ float dd = length(vWPos.xz - uWaveC); float behind = uWaveR - dd;
          float trail = behind > 0.0 && uWaveR < 200.0 ? exp(-behind * 0.45) : 0.0;
          vec2 gq = abs(fract(vWPos.xz / 0.55 + 0.5) - 0.5); float line = 1.0 - smoothstep(0.0, 0.05, min(gq.x, gq.y));
          float pave = smoothstep(0.5, 0.62, dot(diffuseColor.rgb, vec3(0.33)));
          totalEmissiveRadiance += vec3(0.3, 0.75, 1.0) * trail * line * pave * 2.5; }` : ''}`);
  };
  mat.customProgramCacheKey = () => 'wave' + key + (emissiveOn ? 'E' : '') + (grid ? 'G' : '');
  return mat;
}

function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
function rng(seed) { let s = seed >>> 0; return () => ((s = Math.imul(s ^ (s >>> 15), 2246822519) + 0x9e3779b9 >>> 0) / 4294967296); }

// Layout (x right, z towards camera). Units: person ~0.26 tall, Jay ~3.
export const LAYOUT = {
  pool: new THREE.Vector2(0, 1.5),
  hq: { x: -6.5, z: -6, w: 9, d: 4.6, floors: 5 },
  factory: { x: 8.5, z: -6.5, w: 9, d: 6 },
  gate: { x: 11, z: 7 },
  muster: new THREE.Vector2(-9, 7.5),
  kiosk: new THREE.Vector3(-1.4, 0, -3.2),
  hqDoor: new THREE.Vector3(-6.5, 0, -3.7),
  facDoor: new THREE.Vector3(5.2, 0, -3.5),
};

export class Campus {
  constructor() { this.root = new THREE.Group(); this.root.name = 'campus'; this.people = []; this.devices = []; }

  build() {
    const R = this.root, L = LAYOUT;
    // ---------------- ground (painted layout) ----------------
    const GS = 80; // ground size
    const groundTex = canvasTex(4096, 4096, (ctx, w, h) => {
      const S = w / GS; const X = (x) => (x + GS / 2) * S, Z = (z) => (z + GS / 2) * S;
      // grass base with mottling
      ctx.fillStyle = '#6f9a4c'; ctx.fillRect(0, 0, w, h);
      const r = rng(7);
      for (let i = 0; i < 9000; i++) { ctx.fillStyle = `rgba(${40 + r() * 60},${90 + r() * 70},${30 + r() * 30},${0.08 + r() * 0.1})`; const s = 8 + r() * 60; ctx.beginPath(); ctx.arc(r() * w, r() * h, s, 0, 7); ctx.fill(); }
      const pave = (x0, z0, x1, z1, col, rad = 0) => { ctx.fillStyle = col; ctx.beginPath(); ctx.roundRect(X(x0), Z(z0), (x1 - x0) * S, (z1 - z0) * S, rad * S); ctx.fill(); };
      // roads
      pave(-40, 9.5, 40, 12.5, '#4a4d52'); pave(13.5, -40, 16.5, 40, '#4a4d52');
      ctx.strokeStyle = '#e8e2c8'; ctx.lineWidth = 0.08 * S; ctx.setLineDash([0.8 * S, 0.8 * S]);
      ctx.beginPath(); ctx.moveTo(X(-40), Z(11)); ctx.lineTo(X(40), Z(11)); ctx.moveTo(X(15), Z(-40)); ctx.lineTo(X(15), Z(40)); ctx.stroke(); ctx.setLineDash([]);
      // parking
      pave(17, -12, 30, 6, '#55585d');
      ctx.strokeStyle = '#d9d9d2'; ctx.lineWidth = 0.06 * S;
      for (let i = 0; i < 12; i++) { const z = -11 + i * 1.4; ctx.beginPath(); ctx.moveTo(X(17.3), Z(z)); ctx.lineTo(X(20.3), Z(z)); ctx.moveTo(X(26.7), Z(z)); ctx.lineTo(X(29.7), Z(z)); ctx.stroke(); }
      // plaza (light stone) + tile joints
      pave(-5.5, -3.6, 5.5, 6.5, '#cfc8bb', 0.6);
      ctx.strokeStyle = 'rgba(120,110,95,0.35)'; ctx.lineWidth = 0.025 * S;
      for (let x = -5.5; x <= 5.5; x += 0.55) { ctx.beginPath(); ctx.moveTo(X(x), Z(-3.6)); ctx.lineTo(X(x), Z(6.5)); ctx.stroke(); }
      for (let z = -3.6; z <= 6.5; z += 0.55) { ctx.beginPath(); ctx.moveTo(X(-5.5), Z(z)); ctx.lineTo(X(5.5), Z(z)); ctx.stroke(); }
      // paths
      const path = (pts, wdt, col = '#d8d1c3') => { ctx.strokeStyle = col; ctx.lineWidth = wdt * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z)))); ctx.stroke(); };
      path([[-6.5, -3.4], [-6.5, -1], [-3, 1.5]], 1.4);
      path([[5.2, -3.4], [4.5, -1], [3, 1.5]], 1.4);
      path([[4, 5], [9, 7], [13.5, 7]], 1.3);
      path([[-4, 5], [-7, 7], [-9, 7.5]], 1.3);
      path([[0, 6], [0, 9.5]], 1.6);
      // muster lawn ring
      ctx.strokeStyle = 'rgba(240,240,230,0.9)'; ctx.lineWidth = 0.12 * S; ctx.beginPath(); ctx.arc(X(L.muster.x), Z(L.muster.y), 2.2 * S, 0, 7); ctx.stroke();
      // gate area
      pave(9.5, 5.5, 13.5, 9.5, '#bdb6a8', 0.3);
    });
    groundTex.wrapS = groundTex.wrapT = THREE.ClampToEdgeWrapping;
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(GS, GS, 1, 1),
      wavePatch(new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95 }), { glowFront: 4.0, key: 'g', grid: true }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; R.add(ground);
    // far ground fading into haze
    const far = new THREE.Mesh(new THREE.CircleGeometry(400, 48), new THREE.MeshStandardMaterial({ color: '#5f8a45', roughness: 1 }));
    far.rotation.x = -Math.PI / 2; far.position.y = -0.02; far.receiveShadow = true; R.add(far);

    // ---------------- reflecting pool ----------------
    {
      const rim = new THREE.Mesh(new THREE.TorusGeometry(2.0, 0.045, 12, 128), wavePatch(new THREE.MeshStandardMaterial({ color: '#e6e1d6', roughness: 0.6 }), { key: 'rim' }));
      rim.scale.set(1, 1, 0.75); rim.rotation.x = Math.PI / 2; rim.position.set(L.pool.x, 0.034, L.pool.y); rim.castShadow = rim.receiveShadow = true; R.add(rim);
      const basin = new THREE.Mesh(new THREE.CircleGeometry(2.0, 96), new THREE.MeshStandardMaterial({ color: '#1d3b52', roughness: 0.8 }));
      basin.rotation.x = -Math.PI / 2; basin.position.set(L.pool.x, 0.005, L.pool.y); R.add(basin);
      this.poolWater = new THREE.Mesh(new THREE.CircleGeometry(1.95, 128), this.waterMaterial());
      this.poolWater.rotation.x = -Math.PI / 2; this.poolWater.position.set(L.pool.x, 0.03, L.pool.y); R.add(this.poolWater);
    }

    // ---------------- buildings ----------------
    this.buildHQ(); this.buildFactory(); this.buildGate(); this.buildKiosk();
    this.buildTrees(); this.buildLamps(); this.buildCars(); this.buildPeople(); this.buildMuster(); this.buildProps();
    R.traverse((o) => { if (o.isMesh && o.castShadow === undefined) o.castShadow = true; });
    return this;
  }

  waterMaterial() {
    const m = new THREE.MeshPhysicalMaterial({ color: '#0b3550', roughness: 0.04, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.02 });
    this.waterU = { uDrops: { value: Array.from({ length: 4 }, () => new THREE.Vector4(0, 0, -100, 0)) } };
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, CU, this.waterU);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
        .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>\n${WAVE_PARS}\nuniform vec4 uDrops[4];\n${NOISE_GLSL}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
          { vec2 p = vWPos.xz; vec2 g = vec2(0.0); float glow = 0.0;
            for (int i = 0; i < 4; i++) { vec4 d = uDrops[i]; float t = uTime - d.z; if (t < 0.0 || t > 6.0) continue;
              float r = length(p - d.xy); vec2 dir = (p - d.xy) / max(r, 1e-3);
              float k = 14.0; float ph = r * k - t * 9.0;
              float env = exp(-pow((r - t * 0.65) * 2.2, 2.0)) * exp(-t * 0.6) * d.w + exp(-r * 6.0) * exp(-t * 3.0) * d.w;
              g += dir * cos(ph) * env * 0.9; glow += env; }
            g += vec2(fbm3(vec3(p * 3.0, uTime * 0.3)) - 0.5, fbm3(vec3(p * 3.0 + 9.0, uTime * 0.3)) - 0.5) * 0.08;
            vec3 nW = normalize(vec3(-g.x, 1.0, -g.y));
            normal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);
            vGlow = glow; }`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          totalEmissiveRadiance += vec3(0.2, 0.75, 1.0) * (vGlow * 1.5 + waveAct(vWPos.xz) * 0.08);`)
        .replace('#include <common>', '#include <common>\nfloat vGlow = 0.0;');
    };
    return m;
  }

  // glass office HQ with lit floors, mullions, entrance door + reader
  buildHQ() {
    const { x, z, w, d, floors } = LAYOUT.hq; const FH = 0.5;
    const g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const winTex = canvasTex(1024, 512, (ctx, W, H) => {
      ctx.fillStyle = '#1b2733'; ctx.fillRect(0, 0, W, H);
      const r = rng(3);
      for (let f = 0; f < floors; f++) for (let i = 0; i < 24; i++) {
        const lit = r() < 0.75; const wx = i * W / 24, wy = H - (f + 1) * H / floors;
        const gr = ctx.createLinearGradient(0, wy, 0, wy + H / floors);
        gr.addColorStop(0, lit ? '#fff1d0' : '#2b3a4a'); gr.addColorStop(1, lit ? '#ffd79a' : '#1f2b38');
        ctx.fillStyle = gr; ctx.fillRect(wx + 2, wy + 8, W / 24 - 4, H / floors - 16);
        if (lit && r() < 0.5) { ctx.fillStyle = 'rgba(40,40,60,0.6)'; ctx.fillRect(wx + 6 + r() * 20, wy + H / floors * 0.45, 8, H / floors * 0.4); }
      }
    });
    const glass = wavePatch(new THREE.MeshPhysicalMaterial({ color: '#9fb6c9', roughness: 0.08, metalness: 0.2, clearcoat: 1, emissive: '#ffffff', emissiveMap: winTex, emissiveIntensity: 0.0, map: winTex }),
      { emissiveOn: '#000000', key: 'hqglass' });
    // emissive windows turn on with the wave: we drive emissiveIntensity via material + wave in shader
    glass.onBeforeCompile = ((orig) => (sh) => { orig(sh); sh.fragmentShader = sh.fragmentShader.replace('totalEmissiveRadiance += uEmOn * act;', 'totalEmissiveRadiance += texture2D(emissiveMap, vEmissiveMapUv).rgb * (act * 1.6 + uNight * 1.2) * (1.0 - uAlarm * 0.4) + vec3(1.0, 0.05, 0.03) * uAlarm * (0.5 + 0.5 * sin(uAlarmT * 9.0)) * 0.6;'); })(glass.onBeforeCompile);
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, floors * FH, d), [glass, glass, null, null, glass, glass].map((m) => m || wavePatch(new THREE.MeshStandardMaterial({ color: '#d9dde2', roughness: 0.7 }), { key: 'roof' })));
    body.position.y = floors * FH / 2; body.castShadow = body.receiveShadow = true; g.add(body);
    // slab bands + mullions
    const frameMat = wavePatch(new THREE.MeshStandardMaterial({ color: '#eef0f2', roughness: 0.5 }), { key: 'frame' });
    const slabs = [];
    for (let f = 0; f <= floors; f++) { const s = new THREE.BoxGeometry(w + 0.12, 0.07, d + 0.12); s.translate(0, f * FH, 0); slabs.push(s); }
    for (let i = 0; i <= 24; i++) for (const zz of [d / 2 + 0.03, -d / 2 - 0.03]) { const m = new THREE.BoxGeometry(0.035, floors * FH, 0.04); m.translate(-w / 2 + i * w / 24, floors * FH / 2, zz); slabs.push(m); }
    const frame = new THREE.Mesh(mergeGeometries(slabs), frameMat); frame.castShadow = true; frame.receiveShadow = true; g.add(frame);
    // roof details
    const roofStuff = new THREE.Mesh(mergeGeometries([new THREE.BoxGeometry(1.6, 0.4, 1.2).translate(2, floors * FH + 0.2, -0.5), new THREE.BoxGeometry(0.9, 0.25, 0.9).translate(-2.5, floors * FH + 0.12, 0.6),
      new THREE.CylinderGeometry(0.25, 0.25, 0.3, 16).translate(-1, floors * FH + 0.15, -1)]), frameMat);
    roofStuff.castShadow = true; g.add(roofStuff);
    // entrance canopy + sliding doors
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.06, 1.0), frameMat); canopy.position.set(0, 0.62, d / 2 + 0.5); canopy.castShadow = true; g.add(canopy);
    this.addDoor(g, new THREE.Vector3(0, 0, d / 2 + 0.02), 'hq');
    this.hq = g;
  }

  addDoor(parent, pos, name) {
    const g = new THREE.Group(); g.position.copy(pos); parent.add(g);
    const glassM = new THREE.MeshPhysicalMaterial({ color: '#cfe6ff', roughness: 0.05, transparent: true, opacity: 0.35, metalness: 0.1 });
    const fr = wavePatch(new THREE.MeshStandardMaterial({ color: '#30353c', roughness: 0.4, metalness: 0.6 }), { key: 'df' });
    const leaves = [];
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.03), glassM); l.position.set(s * 0.21, 0.28, 0.01); g.add(l); leaves.push(l); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.06, 0.06), fr); top.position.set(0, 0.58, 0.02); g.add(top);
    // reader: dark slab with a status ring
    const reader = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.025), new THREE.MeshStandardMaterial({ color: '#15181c', roughness: 0.3 }));
    reader.position.set(0.58, 0.3, 0.03); g.add(reader);
    const led = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 8, 24), new THREE.MeshBasicMaterial({ color: '#ff3020' }));
    led.position.set(0.58, 0.31, 0.045); g.add(led);
    this.devices.push({ name, kind: 'door', g, leaves, led, pos: new THREE.Vector3().setFromMatrixPosition(g.matrixWorld), open: 0 });
  }

  buildFactory() {
    const { x, z, w, d } = LAYOUT.factory;
    const g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const wall = wavePatch(new THREE.MeshStandardMaterial({ color: '#d2d6da', roughness: 0.8 }), { key: 'fw' });
    const accent = wavePatch(new THREE.MeshStandardMaterial({ color: '#2f5fd8', roughness: 0.6 }), { key: 'fa' });
    const H = 1.4;
    const base = new THREE.Mesh(new RoundedBoxGeometry(w, H, d, 3, 0.05), wall); base.position.y = H / 2; base.castShadow = base.receiveShadow = true; g.add(base);
    // corrugation via thin ribs
    const ribs = [];
    for (let i = 0; i < 60; i++) { const r = new THREE.BoxGeometry(0.03, H, 0.03); r.translate(-w / 2 + (i + 0.5) * w / 60, H / 2, d / 2 + 0.01); ribs.push(r); }
    const rib = new THREE.Mesh(mergeGeometries(ribs), wall); rib.castShadow = true; g.add(rib);
    const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.18, d + 0.04), accent); band.position.y = H - 0.1; g.add(band);
    // sawtooth roof with skylights
    const teeth = [], sky = [];
    const n = 6;
    for (let i = 0; i < n; i++) {
      const shp = new THREE.Shape(); const zw = d / n;
      shp.moveTo(0, 0); shp.lineTo(zw, 0); shp.lineTo(zw, 0.55); shp.lineTo(0, 0);
      const ge = new THREE.ExtrudeGeometry(shp, { depth: w, bevelEnabled: false }); ge.rotateY(Math.PI / 2); ge.translate(-w / 2, H, d / 2 - i * zw - zw);
      teeth.push(ge);
      const sg = new THREE.PlaneGeometry(w * 0.98, 0.5); sg.rotateY(0); sg.translate(0, H + 0.27, d / 2 - i * zw - zw - 0.005 + zw); sky.push(sg);
    }
    const roof = new THREE.Mesh(mergeGeometries(teeth), wavePatch(new THREE.MeshStandardMaterial({ color: '#b8bec6', roughness: 0.7, side: THREE.DoubleSide }), { key: 'fr' }));
    roof.castShadow = roof.receiveShadow = true; g.add(roof);
    const skyMat = wavePatch(new THREE.MeshStandardMaterial({ color: '#7d93a8', roughness: 0.1, metalness: 0.3, emissive: '#000000' }), { emissiveOn: '#ffd9a0', key: 'fsky' });
    const skyl = new THREE.Mesh(mergeGeometries(sky), skyMat); g.add(skyl);
    // big roller door + chimney
    const roll = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.95, 0.04), wavePatch(new THREE.MeshStandardMaterial({ color: '#8b939c', roughness: 0.6, metalness: 0.4 }), { key: 'roll' }));
    roll.position.set(2.5, 0.48, d / 2 + 0.03); g.add(roll);
    const chim = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 2.6, 20), wall); chim.position.set(-3.5, 1.3, -1.5); chim.castShadow = true; g.add(chim);
    const chimBand = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.18, 20), accent); chimBand.position.set(-3.5, 2.4, -1.5); g.add(chimBand);
    this.addDoor(g, new THREE.Vector3(-3.3, 0, d / 2 + 0.02), 'fac');
    this.factory = g;
  }

  buildGate() {
    const { x, z } = LAYOUT.gate;
    const g = new THREE.Group(); g.position.set(x, 0, z); this.root.add(g);
    const m = wavePatch(new THREE.MeshStandardMaterial({ color: '#e9ebee', roughness: 0.6 }), { key: 'gate' });
    const hut = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.7, 1.1, 3, 0.04), m); hut.position.set(1.2, 0.35, 0); hut.castShadow = hut.receiveShadow = true; g.add(hut);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 1.4), wavePatch(new THREE.MeshStandardMaterial({ color: '#2f5fd8', roughness: 0.5 }), { key: 'gr' }));
    roof.position.set(1.2, 0.74, 0); roof.castShadow = true; g.add(roof);
    // turnstiles: three posts with rotating arms
    this.turnstiles = [];
    const steel = new THREE.MeshStandardMaterial({ color: '#c7ccd2', roughness: 0.25, metalness: 0.9 });
    for (let i = 0; i < 3; i++) {
      const t = new THREE.Group(); t.position.set(-0.6, 0, -0.9 + i * 0.6); g.add(t);
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.32, 16), steel); post.position.y = 0.16; t.add(post);
      const arms = new THREE.Group(); arms.position.y = 0.26; t.add(arms);
      for (let k = 0; k < 3; k++) { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.28, 8), steel); a.rotation.z = Math.PI / 2; a.position.x = 0.14; const piv = new THREE.Group(); piv.rotation.x = k * 2.094; piv.add(a); arms.add(piv); }
      arms.rotation.z = -0.5;
      const led = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 8), new THREE.MeshBasicMaterial({ color: '#ff3020' })); led.position.set(0, 0.33, 0); t.add(led);
      this.turnstiles.push({ t, arms, led });
      this.devices.push({ name: 'turn' + i, kind: 'turnstile', g: t, led, pos: new THREE.Vector3(x - 0.6, 0, z - 0.9 + i * 0.6), arms });
    }
    // barrier arm
    const bar = new THREE.Group(); bar.position.set(2.3, 0.3, 1.0); g.add(bar);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 0.05), new THREE.MeshStandardMaterial({ color: '#e33', roughness: 0.5 })); arm.position.x = 1.2; bar.add(arm);
    this.barrier = bar;
  }

  buildKiosk() { // visitor kiosk + time terminal on the plaza
    const p = LAYOUT.kiosk;
    const mk = (pos, rotY, h) => {
      const g = new THREE.Group(); g.position.copy(pos); g.rotation.y = rotY; this.root.add(g);
      const body = new THREE.Mesh(new RoundedBoxGeometry(0.28, h, 0.12, 3, 0.02), wavePatch(new THREE.MeshStandardMaterial({ color: '#eef0f3', roughness: 0.35 }), { key: 'kb' }));
      body.position.y = h / 2; body.castShadow = true; g.add(body);
      const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.16), wavePatch(new THREE.MeshStandardMaterial({ color: '#0b0f16', roughness: 0.15, emissive: '#000000' }), { emissiveOn: '#3d7bff', key: 'ks' }));
      screen.position.set(0, h - 0.13, 0.062); screen.rotation.x = -0.15; g.add(screen);
      return g;
    };
    this.kiosk = mk(p, 0.3, 0.5);
    this.terminal = mk(new THREE.Vector3(-5.6, 0, -3.2), 0, 0.42);
  }

  buildTrees() {
    const r = rng(11);
    const spots = [];
    const add = (x, z, s = 1) => spots.push([x, z, s]);
    for (let i = 0; i < 9; i++) add(-12 + i * 3.2, 14.5 + r() * 0.8, 0.9 + r() * 0.4);
    for (let i = 0; i < 6; i++) add(-18 + r() * 3, -12 + i * 4, 1 + r() * 0.5);
    for (let i = 0; i < 8; i++) add(-14 + i * 4.5 + r(), -14 - r() * 3, 1.1 + r() * 0.5);
    add(-3.2, -2.5, 0.8); add(3.4, -2.6, 0.8); add(-4.8, 5.6, 0.75); add(4.9, 5.4, 0.75);
    add(-12.5, 4, 1); add(-13.5, 11.5, 0.9); add(6.5, 3.5, 0.9); add(9.5, 1.5, 0.85);
    for (let i = 0; i < 30; i++) { const a = r() * Math.PI * 2, d = 26 + r() * 18; add(Math.cos(a) * d, Math.sin(a) * d * 0.8, 1.2 + r() * 0.8); }
    this.treeSpots = spots;
    // foliage: lumpy merged spheres with vertex colour; trunk cylinder
    const lumps = [];
    for (let k = 0; k < 7; k++) { const sg = new THREE.IcosahedronGeometry(0.42 + r() * 0.15, 3); sg.translate((r() - 0.5) * 0.6, 1.25 + (r() - 0.3) * 0.5, (r() - 0.5) * 0.6); lumps.push(sg); }
    const fol = mergeGeometries(lumps.map((g) => g.toNonIndexed()));
    // jitter + colour
    const pos = fol.attributes.position; const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i); const t = Math.min(1, Math.max(0, (y - 0.9) / 1.0));
      const c = new THREE.Color().setHSL(0.27 + r() * 0.03, 0.45, 0.2 + t * 0.16 + r() * 0.03);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    fol.setAttribute('color', new THREE.BufferAttribute(col, 3)); fol.computeVertexNormals();
    const folMat = wavePatch(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true }), { key: 'tree' });
    const trunk = new THREE.CylinderGeometry(0.07, 0.1, 1.0, 8); trunk.translate(0, 0.5, 0);
    const trunkMat = wavePatch(new THREE.MeshStandardMaterial({ color: '#6b4f3a', roughness: 0.9 }), { key: 'trunk' });
    const im1 = new THREE.InstancedMesh(fol, folMat, spots.length), im2 = new THREE.InstancedMesh(trunk, trunkMat, spots.length);
    const M = new THREE.Matrix4();
    spots.forEach(([x, z, s], i) => { M.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, r() * 6, 0)), new THREE.Vector3(s, s * (0.9 + r() * 0.3), s)); im1.setMatrixAt(i, M); im2.setMatrixAt(i, M); });
    im1.castShadow = im2.castShadow = true; im1.receiveShadow = true;
    this.root.add(im1, im2);
  }

  buildLamps() {
    const pts = [[-5.8, -3], [5.8, -3], [-5.8, 6.3], [5.8, 6.3], [-2, 9.2], [2, 9.2], [8, 8.8], [-8, 9]];
    const pole = new THREE.CylinderGeometry(0.025, 0.03, 0.9, 8); pole.translate(0, 0.45, 0);
    const head = new THREE.SphereGeometry(0.07, 16, 8); head.translate(0, 0.92, 0);
    const pm = new THREE.InstancedMesh(pole, wavePatch(new THREE.MeshStandardMaterial({ color: '#2c3036', roughness: 0.5, metalness: 0.5 }), { key: 'lp' }), pts.length);
    const hm = new THREE.InstancedMesh(head, wavePatch(new THREE.MeshStandardMaterial({ color: '#fff6e0', emissive: '#000000' }), { emissiveOn: '#ffd7a0', key: 'lh' }), pts.length);
    const M = new THREE.Matrix4(); pts.forEach(([x, z], i) => { M.makeTranslation(x, 0, z); pm.setMatrixAt(i, M); hm.setMatrixAt(i, M); });
    pm.castShadow = true; this.root.add(pm, hm);
  }

  buildProps() {
    const wood = wavePatch(new THREE.MeshStandardMaterial({ color: '#a8754a', roughness: 0.7 }), { key: 'wood' });
    const stone = wavePatch(new THREE.MeshStandardMaterial({ color: '#bdb5a6', roughness: 0.85 }), { key: 'stone' });
    const benches = [], planters = [];
    for (const [x, z, r] of [[-3.6, 0.2, 0.5], [3.6, 0.2, -0.5], [-3.4, 3.6, -0.4], [3.4, 3.6, 0.4], [-1.5, 5.8, 0], [1.5, 5.8, 0]]) {
      const b = new THREE.BoxGeometry(0.5, 0.04, 0.16); b.translate(0, 0.12, 0); const l1 = new THREE.BoxGeometry(0.04, 0.12, 0.14); l1.translate(-0.2, 0.06, 0); const l2 = l1.clone(); l2.translate(0.4, 0, 0);
      const bb = new THREE.BoxGeometry(0.5, 0.12, 0.03); bb.translate(0, 0.2, -0.07);
      const g = mergeGeometries([b, l1, l2, bb]); g.rotateY(r); g.translate(x, 0, z); benches.push(g);
    }
    for (const [x, z] of [[-5, -3], [5, -3], [-5, 6], [5, 6], [-2.6, -3.1], [2.6, -3.1]]) { const p = new RoundedBoxGeometry(0.6, 0.22, 0.6, 2, 0.03); p.translate(x, 0.11, z); planters.push(p); }
    const bm = new THREE.Mesh(mergeGeometries(benches), wood); bm.castShadow = true; this.root.add(bm);
    const pm = new THREE.Mesh(mergeGeometries(planters.map((g) => (g.index ? g.toNonIndexed() : g))), stone); pm.castShadow = pm.receiveShadow = true; this.root.add(pm);
    // shrubs in planters
    const shrub = new THREE.IcosahedronGeometry(0.24, 2);
    const sm = new THREE.InstancedMesh(shrub, wavePatch(new THREE.MeshStandardMaterial({ color: '#4f7f3a', roughness: 0.9, flatShading: true }), { key: 'shrub' }), 6);
    [[-5, -3], [5, -3], [-5, 6], [5, 6], [-2.6, -3.1], [2.6, -3.1]].forEach(([x, z], i) => sm.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.3, z), new THREE.Quaternion(), new THREE.Vector3(1, 0.8, 1))));
    sm.castShadow = true; this.root.add(sm);
    // flag poles with blue flags bearing the bird mark
    const flagTex = canvasTex(256, 160, (ctx, w, h) => { ctx.fillStyle = '#1f55e0'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.beginPath(); ctx.moveTo(w * 0.38, h * 0.78); ctx.lineTo(w * 0.52, h * 0.38); ctx.lineTo(w * 0.62, h * 0.3); ctx.lineTo(w * 0.66, h * 0.36); ctx.lineTo(w * 0.6, h * 0.42); ctx.lineTo(w * 0.56, h * 0.64); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * 0.36, h * 0.3); ctx.lineTo(w * 0.5, h * 0.42); ctx.lineTo(w * 0.44, h * 0.6); ctx.closePath(); ctx.fill(); });
    this.flags = [];
    for (const [x, z] of [[-4.2, -3.3], [-3.6, -3.3], [-3.0, -3.3]]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.3, 6), new THREE.MeshStandardMaterial({ color: '#ddd', metalness: 0.8, roughness: 0.3 })); pole.position.set(x, 0.65, z); pole.castShadow = true; this.root.add(pole);
      const fg = new THREE.PlaneGeometry(0.42, 0.26, 12, 4); fg.translate(0.21, 0, 0);
      const flag = new THREE.Mesh(fg, wavePatch(new THREE.MeshStandardMaterial({ map: flagTex, side: THREE.DoubleSide, roughness: 0.8 }), { key: 'flag' })); flag.position.set(x + 0.012, 1.15, z); flag.castShadow = true; this.root.add(flag);
      this.flags.push({ flag, base: fg.attributes.position.array.slice() });
    }
    // solar panels on the factory roof teeth are implied by skylights; add rooftop PV field on HQ
    const pv = []; const { x, z, w, d, floors } = LAYOUT.hq;
    for (let i = 0; i < 5; i++) for (let j = 0; j < 2; j++) { const g = new THREE.BoxGeometry(0.9, 0.03, 0.5); g.rotateX(-0.35); g.translate(x - 3.6 + i * 1.0, floors * 0.5 + 0.12, z + 1.2 + j * 0.7); pv.push(g); }
    const pvm = new THREE.Mesh(mergeGeometries(pv), wavePatch(new THREE.MeshStandardMaterial({ color: '#1c2b4a', roughness: 0.2, metalness: 0.6 }), { key: 'pv' })); pvm.castShadow = true; this.root.add(pvm);
  }
  updateFlags(t) {
    for (const { flag, base } of this.flags || []) {
      const a = flag.geometry.attributes.position;
      for (let i = 0; i < a.count; i++) { const x = base[i * 3], y = base[i * 3 + 1]; a.setZ(i, Math.sin(x * 14 - t * 7 + y * 3) * 0.03 * x / 0.42); }
      a.needsUpdate = true; flag.geometry.computeVertexNormals();
    }
  }

  buildCars() {
    const r = rng(5);
    const body = new THREE.BoxGeometry(0.55, 0.16, 1.05); body.translate(0, 0.14, 0);
    const cab = new THREE.BoxGeometry(0.48, 0.14, 0.55); cab.translate(0, 0.28, -0.05);
    const g = mergeGeometries([body, cab]);
    const cols = ['#c0392b', '#ecf0f1', '#2c3e50', '#2f5fd8', '#7f8c8d', '#f1c40f', '#ecf0f1', '#16a085'];
    const spots = [];
    for (let i = 0; i < 12; i++) if (r() < 0.75) spots.push([18.8, -11 + i * 1.4 + 0.7]);
    for (let i = 0; i < 12; i++) if (r() < 0.6) spots.push([28.2, -11 + i * 1.4 + 0.7]);
    const im = new THREE.InstancedMesh(g, wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.25, metalness: 0.4 }), { key: 'car' }), spots.length);
    const M = new THREE.Matrix4(); spots.forEach(([x, z], i) => { M.compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)), new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, M); im.setColorAt(i, new THREE.Color(cols[i % cols.length])); });
    im.castShadow = true; this.root.add(im);
  }

  buildMuster() {
    const L = LAYOUT.muster;
    // sign post with a green "assembly" pictogram panel (no text): four arrows into a figure
    const g = new THREE.Group(); g.position.set(L.x - 2.6, 0, L.y - 1.2); this.root.add(g);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.8, 8), new THREE.MeshStandardMaterial({ color: '#888', metalness: 0.8, roughness: 0.3 })); post.position.y = 0.4; g.add(post);
    const tex = canvasTex(256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#12924a'; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fff';
      for (let k = 0; k < 4; k++) { ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(k * Math.PI / 2); ctx.beginPath(); ctx.moveTo(-14, -112); ctx.lineTo(14, -112); ctx.lineTo(14, -80); ctx.lineTo(28, -80); ctx.lineTo(0, -55); ctx.lineTo(-28, -80); ctx.lineTo(-14, -80); ctx.closePath(); ctx.fill(); ctx.restore(); }
      for (const [dx, dy] of [[-22, 0], [22, 0], [0, -16]]) { ctx.beginPath(); ctx.arc(w / 2 + dx, h / 2 + dy - 12, 9, 0, 7); ctx.fill(); ctx.fillRect(w / 2 + dx - 9, h / 2 + dy, 18, 26); }
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.36), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15 }));
    panel.position.set(0, 0.85, 0.025); g.add(panel);
    // count ring: segments that light up as people are accounted for
    this.musterSegs = [];
    const N = 12;
    for (let i = 0; i < N; i++) {
      const a0 = (i / N) * Math.PI * 2 + 0.03, a1 = ((i + 1) / N) * Math.PI * 2 - 0.03;
      const geo = new THREE.RingGeometry(2.35, 2.55, 16, 1, a0, a1 - a0);
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#1fd17a', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(L.x, 0.02, L.y); this.root.add(m); this.musterSegs.push(m);
    }
  }

  buildPeople() {
    // little stylised people (~0.27 tall, Jay ~0.3): torso, head, hair, two arms, two legs
    const r = rng(21);
    const shirts = ['#e76f51', '#2a9d8f', '#e9c46a', '#f4f1de', '#f4a261', '#8ab17d', '#6d597a', '#b56576', '#3d5a80', '#ee6c4d', '#98c1d9', '#ffb703', '#ffffff', '#81b29a'];
    const pants = ['#2b2f3a', '#3d405b', '#5c677d', '#22223b', '#8d8d8d', '#a68a64', '#283044'];
    const skin = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#f3d1b5'];
    const hairC = ['#2b1d14', '#4a3123', '#0f0f10', '#7a5230', '#c49a6c', '#d9c3a0', '#5a5a5a'];
    const N = 64;
    const torsoG = new THREE.CapsuleGeometry(0.043, 0.07, 6, 14); torsoG.scale(1, 1, 0.78); torsoG.translate(0, 0.168, 0);
    const headG = new THREE.SphereGeometry(0.034, 20, 14); headG.translate(0, 0.252, 0.002);
    const hairG = new THREE.SphereGeometry(0.0365, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.58); hairG.scale(1, 0.95, 1.02); hairG.translate(0, 0.256, -0.004);
    const legG = new THREE.CapsuleGeometry(0.019, 0.085, 4, 10); legG.translate(0, -0.052, 0);
    const armG = new THREE.CapsuleGeometry(0.0135, 0.075, 4, 8); armG.translate(0, -0.044, 0);
    const mk = (g, mat) => { const m = new THREE.InstancedMesh(g, mat, N); m.castShadow = true; m.receiveShadow = true; this.root.add(m); return m; };
    this.pBody = mk(torsoG, wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.75 }), { key: 'pb' }));
    this.pHead = mk(headG, wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.55 }), { key: 'ph' }));
    this.pHair = mk(hairG, wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.7 }), { key: 'phr' }));
    const legMat = wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.8 }), { key: 'pl' });
    this.pLegL = mk(legG, legMat); this.pLegR = mk(legG, legMat);
    const armMat = wavePatch(new THREE.MeshStandardMaterial({ roughness: 0.75 }), { key: 'pa' });
    this.pArmL = mk(armG, armMat); this.pArmR = mk(armG, armMat);
    for (let i = 0; i < N; i++) {
      const sc = new THREE.Color(shirts[i % shirts.length]), pc = new THREE.Color(pants[Math.floor(r() * pants.length)]);
      this.pBody.setColorAt(i, sc); this.pArmL.setColorAt(i, sc); this.pArmR.setColorAt(i, sc);
      this.pHead.setColorAt(i, new THREE.Color(skin[Math.floor(r() * skin.length)]));
      this.pHair.setColorAt(i, new THREE.Color(hairC[Math.floor(r() * hairC.length)]));
      this.pLegL.setColorAt(i, pc); this.pLegR.setColorAt(i, pc);
      this.people.push({ i, seed: r(), h: 0.94 + r() * 0.14, path: null, x: 0, z: 0, rot: 0, walk: 0, hidden: false });
    }
    this.N = N;
  }

  // place person i at (x,z) facing rot, walk phase w (0 = standing), lift = jump, cheer 0..1 raises arms
  setPerson(i, x, z, rot, w, lift = 0, scale = 1, cheer = 0) {
    const p = this.people[i];
    // nobody walks on water: hide anyone whose route crosses the reflecting pool
    if (Math.hypot(x - LAYOUT.pool.x, z - LAYOUT.pool.y) < 2.2) scale = 0.0001;
    const sc = scale * (p ? p.h : 1);
    const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), S = new THREE.Vector3(sc, sc, sc);
    const moving = w ? 1 : 0;
    const bob = Math.abs(Math.sin(w * Math.PI)) * 0.008 * moving + lift;
    Q.setFromEuler(new THREE.Euler(0.06 * moving, rot, 0));
    M.compose(new THREE.Vector3(x, bob, z), Q, S);
    this.pBody.setMatrixAt(i, M); this.pHead.setMatrixAt(i, M); this.pHair.setMatrixAt(i, M);
    const sw = Math.sin(w * Math.PI) * 0.55 * moving;
    const part = (mesh, px, py, rx, rz) => mesh.setMatrixAt(i, M.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(px, py, 0), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, 0, rz)), new THREE.Vector3(1, 1, 1))));
    part(this.pLegL, 0.022, 0.112, sw, 0); part(this.pLegR, -0.022, 0.112, -sw, 0);
    const up = cheer * 2.6;
    part(this.pArmL, 0.056, 0.212, -sw * 0.9, 0.12 + up); part(this.pArmR, -0.056, 0.212, sw * 0.9, -0.12 - up);
  }
  commitPeople() { for (const m of [this.pBody, this.pHead, this.pHair, this.pLegL, this.pLegR, this.pArmL, this.pArmR]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; } }
}

// Light threads from the pool (the HR system) to every device the wave reaches.
export class Arcs {
  constructor(from, targets, speed) {
    const geos = [];
    targets.forEach((tg, k) => {
      const a = new THREE.Vector3(from.x, 0.1, from.y), b = tg.pos.clone(); b.y = tg.y ?? 0.35;
      const dist = a.distanceTo(b);
      const mid = a.clone().lerp(b, 0.5); mid.y = Math.max(a.y, b.y) + 0.6 + dist * 0.28;
      const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
      const g = new THREE.TubeGeometry(curve, 64, 0.035, 5, false);
      const n = g.attributes.position.count;
      const t0 = new Float32Array(n).fill(tg.t0), dur = new Float32Array(n).fill(dist / speed);
      g.setAttribute('aT0', new THREE.BufferAttribute(t0, 1)); g.setAttribute('aDur', new THREE.BufferAttribute(dur, 1));
      geos.push(g);
    });
    const geo = mergeGeometries(geos);
    this.u = { uTime: CU.uTime, uFade: { value: 1 }, uColor: { value: new THREE.Color(0.35, 0.85, 2.4) } };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.u, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aT0, aDur; varying float vU, vT0, vDur; varying vec3 vN, vV;
        void main(){ vU = uv.x; vT0 = aT0; vDur = aDur; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalMatrix * normal; vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime, uFade; uniform vec3 uColor; varying float vU, vT0, vDur; varying vec3 vN, vV;
        void main(){
          float p = (uTime - vT0) / vDur;
          if (p <= 0.0 || vU > p) discard;
          float head = exp(-pow((vU - p) * 18.0, 2.0)) * step(p, 1.05) * 4.0;
          float pulse = pow(0.5 + 0.5 * sin((vU * 6.0 - uTime * 2.2) * 6.2832), 8.0) * step(1.0, p);
          float edge = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.5);
          float a = (0.35 + 0.65 * edge) * (0.5 + head + pulse * 1.5) * uFade;
          gl_FragColor = vec4(uColor * a, a);
        }`,
    });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.frustumCulled = false; this.mesh.renderOrder = 9;
    // flashes where threads land
    this.flashes = targets.map((tg) => {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: new THREE.Color(0.4, 1.6, 1.0), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      sp.position.copy(tg.pos); sp.position.y = tg.y ?? 0.35; sp.userData.t1 = tg.t0 + new THREE.Vector3(from.x, 0.1, from.y).distanceTo(sp.position) / speed; return sp;
    });
    this.group = new THREE.Group(); this.group.add(this.mesh, ...this.flashes);
  }
  update(t) {
    for (const f of this.flashes) { const x = t - f.userData.t1; const k = x < 0 ? 0 : Math.exp(-x * 3.5) * Math.min(1, x * 20); f.material.opacity = k; f.scale.setScalar(0.3 + 1.6 * k); f.visible = k > 0.01; }
  }
}
let _rad = null;
function radial() {
  if (_rad) return _rad;
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); _rad = new THREE.CanvasTexture(c); return _rad;
}
