// Shell-fur + "made of lake water" material patches for the mascot.
import * as THREE from 'three';

// Uniforms shared by every Jay material (water birth effect, rim light, time)
export const JU = {
  uTime: { value: 0 },
  uWaterY: { value: -100 },      // world-space height of the water->fur front
  uWaterAmt: { value: 0 },       // 0 = normal, 1 = water front active
  uWaterDir: { value: 1 },       // +1: water above the front, -1: water below it
  uWaterColor: { value: new THREE.Color(0.0, 0.11, 0.2) },
  uGlowColor: { value: new THREE.Color(0.25, 0.85, 1.0) },
  uRimColor: { value: new THREE.Color(0.55, 0.7, 1.0) },
  uRimAmt: { value: 0.35 },
  uFurGrow: { value: 1.0 },
  uWind: { value: new THREE.Vector3(0, 0, 0) },
};

export const NOISE_GLSL = /* glsl */`
vec3 fhash33(vec3 p){ p = fract(p * vec3(.1031, .1030, .0973)); p += dot(p, p.yxz + 33.33); return fract((p.xxy + p.yxx) * p.zyx); }
float fhash13(vec3 p){ p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
float vnoise3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(fhash13(i), fhash13(i + vec3(1,0,0)), f.x), mix(fhash13(i + vec3(0,1,0)), fhash13(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fhash13(i + vec3(0,0,1)), fhash13(i + vec3(1,0,1)), f.x), mix(fhash13(i + vec3(0,1,1)), fhash13(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm3(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * vnoise3(p); p = p * 2.03 + 7.1; a *= 0.5; } return s; }
`;

const WATER_PARS = /* glsl */`
uniform float uTime, uWaterY, uWaterAmt, uWaterDir, uRimAmt, uFurGrow;
uniform vec3 uWaterColor, uGlowColor, uRimColor;
varying float vWY;
varying vec3 vObj;
`;

function addUniforms(shader, extra) {
  Object.assign(shader.uniforms, JU, extra || {});
}

// generic patch for every non-fur Jay material (hoodie, beak, eyes...)
export function patchSolid(mat, { rim = 1, fuzz = 0, decal = null } = {}) {
  const extra = { uRimMul: { value: rim }, uFuzz: { value: fuzz } };
  if (decal) Object.assign(extra, { uDecal: { value: decal.tex }, uDecalC: { value: decal.center }, uDecalS: { value: decal.size } });
  mat.onBeforeCompile = (shader) => {
    addUniforms(shader, extra);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\nvarying float vWY; varying vec3 vObj;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>\nvObj = position; vWY = (modelMatrix * vec4(position, 1.0)).y;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${WATER_PARS}\nuniform float uRimMul, uFuzz;\n${decal ? 'uniform sampler2D uDecal; uniform vec2 uDecalC; uniform vec2 uDecalS;' : ''}\n${NOISE_GLSL}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float wm = uWaterAmt * smoothstep(-0.04, 0.04, (vWY - uWaterY) * uWaterDir);
        ${decal ? `{ vec2 duv = (vObj.xy - uDecalC) / uDecalS + 0.5;
            if (vObj.z > 0.0 && duv.x > 0.0 && duv.x < 1.0 && duv.y > 0.0 && duv.y < 1.0) {
              vec4 dc = texture2D(uDecal, duv); diffuseColor.rgb = mix(diffuseColor.rgb, dc.rgb, dc.a); } }` : ''}
        if (uFuzz > 0.0) { float fz = fbm3(vObj * 180.0); diffuseColor.rgb *= 0.86 + 0.28 * fz; }
        diffuseColor.rgb = mix(diffuseColor.rgb, uWaterColor, wm);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.03, wm);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\nmetalnessFactor = mix(metalnessFactor, 0.0, wm);`)
      .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `
        vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
        { vec3 V = normalize(vViewPosition); float ndv = saturate(dot(normal, V));
          outgoingLight += uRimColor * pow(1.0 - ndv, 3.0) * uRimAmt * uRimMul * 0.5;
          if (uWaterAmt > 0.0) {
            float cau = pow(fbm3(vObj * 7.0 + vec3(0.0, -uTime * 0.6, uTime * 0.3)), 3.0);
            outgoingLight += wm * (uGlowColor * (0.25 * cau + 0.6 * pow(1.0 - ndv, 2.5)));
            float edge = uWaterAmt * (1.0 - smoothstep(0.0, 0.035, abs(vWY - uWaterY)));
            outgoingLight += edge * uGlowColor * 3.0; } }`);
  };
  mat.customProgramCacheKey = () => 'solid' + (decal ? 'D' : '');
  return mat;
}

// ---------------------------------------------------------------------------
// Fur: fully custom shader. Lighting is evaluated per vertex (directional lights
// with a shadow-map lookup, up to 4 point lights, SH ambient, sheen and rim), the
// fragment stage only cuts strands. This is ~3x cheaper than per-pixel PBR on
// a software rasteriser and looks right for plush.
const MAXP = 4;
export const FL = { // fur lighting uniforms, refreshed per frame from the scene
  uDirN: { value: 0 },
  uDirDir: { value: [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 1, 0)] },
  uDirCol: { value: [new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0), new THREE.Color(0, 0, 0)] },
  uPtN: { value: 0 },
  uPtPos: { value: Array.from({ length: MAXP }, () => new THREE.Vector3()) },
  uPtCol: { value: Array.from({ length: MAXP }, () => new THREE.Color(0, 0, 0)) },
  uPtDist: { value: new Array(MAXP).fill(10) },
  uSH: { value: Array.from({ length: 9 }, () => new THREE.Vector3()) },
  uSHMul: { value: 1 },
  uShadowMap: { value: null }, uShadowMat: { value: new THREE.Matrix4() }, uShadowOn: { value: 0 }, uShadowTexel: { value: new THREE.Vector2(1 / 2048, 1 / 2048) }, uShadowBias: { value: -0.0005 },
  uEquirect: { value: null }, uEnvMul: { value: 1 },
};
const _v = new THREE.Vector3();
export function updateFurLights(scene) {
  let nd = 0, np = 0, sh = null;
  scene.traverseVisible((o) => {
    if (o.isDirectionalLight && nd < 3) {
      FL.uDirDir.value[nd].copy(o.position).sub(o.target.position).normalize();
      FL.uDirCol.value[nd].copy(o.color).multiplyScalar(o.intensity);
      if (o.castShadow && o.shadow.map && !sh) sh = o;
      nd++;
    } else if (o.isPointLight && np < MAXP) {
      o.getWorldPosition(FL.uPtPos.value[np]); FL.uPtCol.value[np].copy(o.color).multiplyScalar(o.intensity); FL.uPtDist.value[np] = o.distance || 10; np++;
    }
  });
  FL.uDirN.value = nd; FL.uPtN.value = np;
  if (sh) {
    FL.uShadowMap.value = sh.shadow.map.texture; FL.uShadowMat.value.copy(sh.shadow.matrix); FL.uShadowOn.value = 1;
    FL.uShadowTexel.value.set(1 / sh.shadow.mapSize.x, 1 / sh.shadow.mapSize.y); FL.uShadowBias.value = sh.shadow.bias;
  } else FL.uShadowOn.value = 0;
  const shc = scene.userData.sh;
  if (shc) for (let i = 0; i < 9; i++) FL.uSH.value[i].copy(shc[i]);
  FL.uSHMul.value = scene.userData.shMul ?? (scene.environmentIntensity ?? 1);
  FL.uEquirect.value = scene.userData.equirect || null;
}

const FUR_VERT = /* glsl */`
#include <common>
#include <packing>
#include <fog_pars_vertex>
attribute vec3 color; attribute float aux;
uniform float uFurLen, uShells, uLayerOffset, uGravity, uFurGrow, uSheen, uRimAmt, uRev;
uniform vec3 uComb, uWind, uRimColor;
uniform int uDirN, uPtN;
uniform vec3 uDirDir[3]; uniform vec3 uDirCol[3];
uniform vec3 uPtPos[${MAXP}]; uniform vec3 uPtCol[${MAXP}]; uniform float uPtDist[${MAXP}];
uniform vec3 uSH[9]; uniform float uSHMul;
uniform sampler2D uShadowMap; uniform mat4 uShadowMat; uniform float uShadowOn, uShadowBias; uniform vec2 uShadowTexel;
varying float vLayer, vAux, vWY; varying vec3 vRoot, vRootN, vCol, vDiff, vSpec, vWN, vWV;
vec3 shIrr(vec3 n){
  float x = n.x, y = n.y, z = n.z;
  vec3 r = uSH[0] * 0.886227 + uSH[1] * 1.023328 * y + uSH[2] * 1.023328 * z + uSH[3] * 1.023328 * x
    + uSH[4] * 0.858086 * x * y + uSH[5] * 0.858086 * y * z + uSH[6] * (0.743125 * z * z - 0.247708)
    + uSH[7] * 0.858086 * x * z + uSH[8] * 0.429043 * (x * x - y * y);
  return max(r, vec3(0.0));
}
float shadowAt(vec3 wp, vec3 wn){
  if (uShadowOn < 0.5) return 1.0;
  vec4 sc = uShadowMat * vec4(wp + wn * 0.03, 1.0); sc.xyz /= sc.w; sc.z += uShadowBias;
  if (sc.x < 0.0 || sc.x > 1.0 || sc.y < 0.0 || sc.y > 1.0 || sc.z > 1.0) return 1.0;
  float s = 0.0;
  for (int i = -1; i <= 1; i++) for (int j = -1; j <= 1; j++)
    s += step(sc.z, unpackRGBAToDepth(texture2D(uShadowMap, sc.xy + vec2(float(i), float(j)) * uShadowTexel * 1.6)));
  return s / 9.0;
}
void main(){
  float li = float(gl_InstanceID);
  float layer = uLayerOffset > 0.5 ? (uShells - li) / uShells : 0.0;   // outermost shell first (early-z)
  vLayer = layer; vRoot = position; vRootN = normal; vAux = aux; vCol = color;
  float fl = uFurLen * aux * uFurGrow;
  vec3 bend = (uComb * uGravity + uWind) * layer * layer;
  vec3 p = position + normalize(normal + bend) * fl * layer;
  vec4 wp4 = modelMatrix * vec4(p, 1.0);
  vec3 wp = wp4.xyz;
  vWY = (modelMatrix * vec4(position, 1.0)).y;
  vec3 N = normalize(mat3(modelMatrix) * normal);
  vec3 V = normalize(cameraPosition - wp);
  vWN = N; vWV = V;
  float ao = mix(0.75, 1.0, layer);
  vec3 diff = shIrr(N) * uSHMul * ao * (1.0 / 3.14159);
  vec3 spec = vec3(0.0);
  float shd = shadowAt(wp, N);
  for (int i = 0; i < 3; i++) {
    if (i >= uDirN) break;
    vec3 L = uDirDir[i];
    float ndl = dot(N, L);
    float w = max(0.0, (ndl + 0.35) / 1.35);                 // wrapped diffuse: light bleeds into plush
    float s = i == 0 ? shd : 1.0;
    diff += uDirCol[i] * w * s * (1.0 / 3.14159);
    vec3 H = normalize(L + V);
    spec += uDirCol[i] * s * (pow(max(dot(N, H), 0.0), 18.0) * 0.06 + pow(1.0 - max(dot(N, V), 0.0), 3.0) * max(ndl + 0.3, 0.0) * 0.18 * uSheen);
  }
  for (int i = 0; i < ${MAXP}; i++) {
    if (i >= uPtN) break;
    vec3 d = uPtPos[i] - wp; float dist = length(d); vec3 L = d / dist;
    float att = pow(clamp(1.0 - pow(dist / uPtDist[i], 4.0), 0.0, 1.0), 2.0) / max(dist * dist, 0.01);
    float w = max(0.0, (dot(N, L) + 0.35) / 1.35);
    diff += uPtCol[i] * w * att * (1.0 / 3.14159);
    spec += uPtCol[i] * att * pow(1.0 - max(dot(N, V), 0.0), 3.0) * 0.12 * uSheen;
  }
  float ndv = max(dot(N, V), 0.0);
  spec += uRimColor * pow(1.0 - ndv, 3.0) * uRimAmt * 0.25 * (0.3 + 0.7 * layer) + shIrr(-V) * uSHMul * (1.0 / 3.14159) * pow(1.0 - ndv, 4.0) * 0.5 * uSheen;
  vDiff = diff; vSpec = spec;
  vec4 mvPosition = viewMatrix * wp4;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;

const FUR_FRAG = /* glsl */`
#include <common>
#include <fog_pars_fragment>
uniform float uDensity, uShells, uTuft, uClump, uTime, uWaterY, uWaterAmt, uWaterDir, uEnvMul;
uniform vec3 uWaterColor, uGlowColor;
uniform sampler2D uEquirect;
varying float vLayer, vAux, vWY; varying vec3 vRoot, vRootN, vCol, vDiff, vSpec, vWN, vWV;
${NOISE_GLSL}
float strandMask(vec3 q, vec3 n, float L, float lenMul, out float hv) {
  vec3 c = floor(q); vec3 f = fract(q) - 0.5;
  vec3 r = fhash33(c);
  vec3 d = f - (r - 0.5) * 0.55;
  d -= n * dot(d, n);
  float rad = length(d);
  hv = r.z;
  float slen = (0.5 + 0.5 * r.y) * lenMul;
  if (L > slen) return 0.0;
  float th = mix(0.46, 0.07, L / slen);
  float w = max(fwidth(rad), 0.03);
  return 1.0 - smoothstep(th - w, th + w, rad);
}
void main(){
  float L = vLayer;
  float wm = uWaterAmt * smoothstep(-0.04, 0.04, (vWY - uWaterY) * uWaterDir);
  float hv = 0.5, cov = 1.0;
  float tuft = vnoise3(vRoot * uDensity * uTuft);
  float lenMul = mix(1.0 - uClump, 1.0, tuft) * step(0.001, vAux);
#ifdef SHELL
  if (wm > 0.5) discard;
  vec3 q = vRoot * uDensity;
  float h1, h2;
  float m1 = strandMask(q, vRootN, L, lenMul, h1);
  float m2 = strandMask(q * 1.618 + vec3(17.3, 5.1, 9.7), vRootN, L, lenMul, h2);
  cov = max(m1, m2); hv = m1 > m2 ? h1 : h2;
  if (cov < 0.03) discard;
#ifndef A2C
  if (cov < 0.5) discard;
#endif
#endif
  float ao = mix(0.58, 1.0, pow(clamp(L / max(lenMul, 0.2), 0.0, 1.0), 0.8));
  vec3 alb = vCol * (0.94 + 0.12 * hv) * mix(0.95, 1.04, tuft);
  vec3 col = alb * vDiff * ao + vSpec * (0.35 + 0.65 * L);
#ifndef SHELL
  if (uWaterAmt > 0.0) {
    vec3 N = normalize(vWN), V = normalize(vWV);
    vec3 R = reflect(-V, N);
    vec2 euv = vec2(atan(R.z, R.x) * 0.15915 + 0.5, asin(clamp(R.y, -1.0, 1.0)) * 0.31831 + 0.5);
    vec3 env = uEquirect_ok(euv);
    float fr = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
    float cau = pow(fbm3(vRoot * 7.0 + vec3(0.0, -uTime * 0.6, uTime * 0.3)), 3.0);
    vec3 water = uWaterColor * (0.6 + 0.6 * vDiff) + env * fr * uEnvMul + uGlowColor * (0.3 * cau + 0.5 * pow(1.0 - max(dot(N, V), 0.0), 2.5));
    col = mix(col, water, wm);
    float edge = uWaterAmt * (1.0 - smoothstep(0.0, 0.035, abs(vWY - uWaterY)));
    col += edge * uGlowColor * 3.0;
  }
#endif
  gl_FragColor = vec4(col, cov);
  #include <fog_fragment>
}`;

export function makeFurMaterial(o = {}) {
  const opts = Object.assign({ density: 150, len: 0.034, shells: 20, gravity: 0.35, layerOffset: 0, msaa: true, tuft: 0.08, clump: 0.25, sheen: 0.6 }, o);
  const shell = opts.layerOffset > 0;
  const u = {
    uDensity: { value: opts.density }, uFurLen: { value: opts.len }, uShells: { value: opts.shells },
    uLayerOffset: { value: opts.layerOffset }, uGravity: { value: opts.gravity }, uTuft: { value: opts.tuft },
    uClump: { value: opts.clump }, uSheen: { value: opts.sheen }, uComb: { value: new THREE.Vector3(0, -1, 0) },
  };
  const mat = new THREE.ShaderMaterial({
    vertexShader: FUR_VERT,
    fragmentShader: FUR_FRAG.replace('vec3 env = uEquirect_ok(euv);', 'vec3 env = uEquirect_has > 0.5 ? texture2D(uEquirect, euv).rgb : vec3(0.3, 0.4, 0.5);')
      .replace('uniform sampler2D uEquirect;', 'uniform sampler2D uEquirect; uniform float uEquirect_has;'),
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog]),
    defines: shell ? (opts.msaa ? { SHELL: '', A2C: '' } : { SHELL: '' }) : {},
    fog: true,
  });
  Object.assign(mat.uniforms, u, JU, FL, { uEquirect_has: { get value() { return FL.uEquirect.value ? 1 : 0; } } });
  mat.userData.u = u;
  if (shell && opts.msaa) mat.alphaToCoverage = true;
  return mat;
}

const DBG = new URLSearchParams(location.search).get('fdbg') || '';
// Build a fur object: opaque base skin + instanced shells (shells may use a coarser mesh)
export function furMesh(geoIn, o = {}) {
  const shells = o.shells ?? 20;
  const geo = geoIn.base || geoIn, sgeo = geoIn.shell || geoIn;
  const grp = new THREE.Group();
  const base = new THREE.Mesh(geo, makeFurMaterial({ ...o, layerOffset: 0 }));
  base.castShadow = true; base.receiveShadow = true;
  base.onBeforeRender = (r, scene) => { const f = r.info.render.frame; if (scene.isScene && FL._frame !== f) { FL._frame = f; updateFurLights(scene); } };
  const ig = new THREE.InstancedBufferGeometry();
  for (const k in sgeo.attributes) ig.setAttribute(k, sgeo.attributes[k]);
  ig.setIndex(sgeo.index);
  ig.instanceCount = shells;
  ig.boundingSphere = (sgeo.boundingSphere || (sgeo.computeBoundingSphere(), sgeo.boundingSphere)).clone();
  ig.boundingSphere.radius += (o.len ?? 0.034) * 1.5;
  const sh = new THREE.Mesh(ig, makeFurMaterial({ ...o, layerOffset: 1 }));
  sh.castShadow = false; sh.receiveShadow = false;
  sh.renderOrder = 1;
  grp.add(base, sh);
  grp.userData.fur = { base, shells: sh };
  grp.userData.setComb = (v) => { base.material.userData.u.uComb.value.copy(v); sh.material.userData.u.uComb.value.copy(v); };
  grp.userData.setShells = (n) => { ig.instanceCount = n; base.material.uniforms.uShells.value = n; sh.material.uniforms.uShells.value = n; };
  return grp;
}

// SH (L2) from an equirectangular HDR, computed on the CPU from its data
export function shFromEquirect(tex, yaw = 0) {
  const cy = Math.cos(yaw), sy = Math.sin(yaw);
  const img = tex.image; const { width: w, height: h, data } = img;
  const isHalf = data instanceof Uint16Array;
  const f16 = (x) => THREE.DataUtils.fromHalfFloat(x);
  const sh = Array.from({ length: 9 }, () => new THREE.Vector3());
  let wsum = 0;
  const step = Math.max(1, Math.floor(w / 256));
  const ch = data.length / (w * h);
  for (let y = 0; y < h; y += step) {
    const th = ((y + 0.5) / h) * Math.PI; const sinT = Math.sin(th);
    for (let x = 0; x < w; x += step) {
      const ph = ((x + 0.5) / w) * Math.PI * 2;
      // three's equirect convention: u = atan(dir.z, dir.x)/(2pi)+0.5, v = asin(dir.y)/pi+0.5 (v up)
      const dy = Math.cos(th), r = sinT;
      const ang = (ph - Math.PI);
      const dx0 = Math.cos(ang) * r, dz0 = Math.sin(ang) * r;
      const dx = dx0 * cy + dz0 * sy, dz = -dx0 * sy + dz0 * cy;
      const i = (y * w + x) * ch;
      let R = data[i], G = data[i + 1], B = data[i + 2];
      if (isHalf) { R = f16(R); G = f16(G); B = f16(B); }
      const wt = sinT;
      const b = [0.282095, 0.488603 * dy, 0.488603 * dz, 0.488603 * dx, 1.092548 * dx * dy, 1.092548 * dy * dz, 0.315392 * (3 * dz * dz - 1), 1.092548 * dx * dz, 0.546274 * (dx * dx - dy * dy)];
      for (let k = 0; k < 9; k++) { sh[k].x += R * b[k] * wt; sh[k].y += G * b[k] * wt; sh[k].z += B * b[k] * wt; }
      wsum += wt;
    }
  }
  const norm = (4 * Math.PI) / wsum;
  for (const v of sh) v.multiplyScalar(norm);
  return sh;
}
