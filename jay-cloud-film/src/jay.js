// Jay — the jay cloud mascot, built from signed distance fields, shell fur and a
// small hierarchical rig. Faces +Z, stands on y=0, ~3 units tall.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as S from './sdf.js';
import { furMesh, patchSolid, JU } from './fur.js';

const C = {
  blue: S.srgb('#1c45e8'), blueDeep: S.srgb('#1433b8'), white: S.srgb('#f6f7fa'), black: S.srgb('#0d0d10'),
  grey: S.srgb('#4b4e55'), navy: '#151d3f', beak: '#0c0c0e',
};

let LOGO = null;
export async function loadLogo() {
  if (!LOGO) LOGO = await (await fetch('/assets/logo.json')).json();
  return LOGO;
}
export function logoShapes(logo = LOGO) {
  return logo.map((poly) => {
    const s = new THREE.Shape();
    poly.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
    s.closePath();
    return s;
  });
}
function drawLogo(ctx, cx, cy, size, fill) {
  ctx.save(); ctx.translate(cx, cy); ctx.scale(size, -size);
  ctx.fillStyle = fill;
  for (const poly of LOGO) {
    ctx.beginPath(); poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function canvasTex(w, h, draw, srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8; t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

// flattened capsule ("feather blob") from a to b, width w, flatness f (z scale)
function feather(len, w, flat) {
  const core = S.roundCone([0, 0, 0], [0, -len, 0], w * 0.42, w * 0.5);
  return (x, y, z) => core(x, y, z / flat) * Math.min(1, flat * 1.4);
}

export class Jay {
  constructor() {
    this.root = new THREE.Group(); this.root.name = 'jay';
    this.parts = {};
  }

  async build({ shells = 20, msaa = true, quality = 1, furQ, headQ, shellCoarse } = {}) {
    await loadLogo();
    const q = quality; // >1 = finer meshes
    const qf = q * (furQ ?? 0.5), qh = q * (headQ ?? 0.75); // fur parts are rendered N times: keep them light
    const furOpt = { shells, msaa, density: 210, len: 0.032, sheen: 0.3 };
    const R = this.root;
    const g = (name, parent, pos = [0, 0, 0]) => { const o = new THREE.Group(); o.name = name; o.position.set(...pos); parent.add(o); this.parts[name] = o; return o; };

    // ---------------- hierarchy ----------------
    const body = g('body', R, [0, 0.9, 0]);
    const torso = g('torso', body, [0, 0.05, 0]);
    const neck = g('neck', torso, [0, 1.0, 0.02]);
    const head = g('head', neck, [0, 0, 0]);
    const jaw = g('jaw', head, [0, 0, 0]);
    const footL = g('footL', body, [0.31, -0.9, 0.04]);
    const footR = g('footR', body, [-0.31, -0.9, 0.04]);
    this.footRest = { L: new THREE.Vector3(0.31, 0, 0.06), R: new THREE.Vector3(-0.31, 0, 0.06) }; this.footScale = 1.28;
    const tail = g('tail', body, [0, -0.02, -0.36]);
    // world-space anchors (rest pose): body pivot y=.9, torso y=.95, neck y=1.95
    const toLocal = (obj, p) => { // rest-pose world -> local (only translations in hierarchy at build time)
      const o = new THREE.Vector3(...p); let n = obj; const off = new THREE.Vector3();
      while (n && n !== R) { off.add(n.position); n = n.parent; }
      return o.sub(off);
    };
    const SC = shellCoarse ?? 1.7;
    const dual = (f, a, b, st, paint) => ({ base: S.meshSDF(f, a, b, st, paint), shell: S.meshSDF(f, a, b, st * SC, paint) });
    const xf = (d, M) => { d.base.applyMatrix4(M); d.shell.applyMatrix4(M); return d; };
    const mergeD = (ds) => ({ base: mergeGeometries(ds.map((d) => d.base)), shell: mergeGeometries(ds.map((d) => d.shell)) });
    const place = (mesh, parent) => { const p = toLocal(parent, [0, 0, 0]); mesh.position.copy(p); parent.add(mesh); return mesh; };

    // ---------------- lower body (blue fluffy) ----------------
    {
      const f = S.smin(0.14,
        S.ellipsoid([0, 0.8, -0.02], [0.5, 0.32, 0.42]),
        S.roundCone([0.24, 0.72, 0.02], [0.27, 0.36, 0.05], 0.25, 0.2), S.roundCone([-0.24, 0.72, 0.02], [-0.27, 0.36, 0.05], 0.25, 0.2));
      const geo = dual(f, [-0.65, 0.2, -0.55], [0.65, 1.15, 0.55], 0.014 / qf, (x, y, z) => [...C.blue, 1]);
      const m = furMesh(geo, furOpt); place(m, body); m.userData.setComb(new THREE.Vector3(0, -1, 0));
    }

    // ---------------- hoodie ----------------
    const hoodieSDF = (() => {
      const main = S.smin(0.22,
        S.ellipsoid([0, 1.38, -0.01], [0.58, 0.56, 0.47]),
        S.ellipsoid([0, 1.72, -0.03], [0.55, 0.24, 0.42]),
        S.ellipsoid([0, 1.05, -0.01], [0.57, 0.2, 0.47]));
      const cut = S.smaxk(0.04, main, (x, y, z) => 0.93 - y);
      const band = (x, y, z) => { const sx = x / 0.565 * 0.5, sz = (z + 0.01) / 0.47 * 0.5; return Math.hypot(Math.hypot(sx, sz) - 0.5, (y - 0.985) * 0.85) - 0.055; };
      let h = S.smin(0.03, cut, band);
      // hood roll around the neck, higher at the back
      const hood = (x, y, z) => { const yy = y - (1.93 + Math.max(0, -z) * 0.35); const r = Math.hypot(x / 1.05, z + 0.02); return Math.hypot(r - 0.31, yy * 1.1) - 0.105; };
      const hoodBag = S.ellipsoid([0, 1.82, -0.36], [0.36, 0.3, 0.16]);
      h = S.smin(0.08, h, hood, hoodBag);
      // neck opening (zip open at top)
      h = S.sub(h, S.ellipsoid([0, 2.02, 0.32], [0.17, 0.3, 0.3]), 0.05);
      h = S.sub(h, S.capsule([0, 1.8, 0], [0, 2.4, 0.02], 0.2), 0.04);
      // kangaroo pocket: raised shell patch
      const pocketRegion = S.roundBox([0, 1.12, 0.4], [0.33, 0.15, 0.3], 0.07);
      const pocket = S.inter(S.offset(cut, 0.02), pocketRegion);
      h = S.union(h, pocket);
      return { h, cut, pocketRegion };
    })();
    this.hoodieSDF = hoodieSDF.cut;
    const logoTex = canvasTex(512, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#4a8dff'); gr.addColorStop(1, '#1f5df0');
      drawLogo(ctx, w / 2, h / 2, w * 0.9, gr);
    });
    {
      const geo = S.meshSDF(hoodieSDF.h, [-0.72, 0.85, -0.6], [0.72, 2.2, 0.62], 0.011 / q, (x, y, z) => {
        // seams: darker at pocket edge and along the hem band
        const pe = Math.abs(hoodieSDF.pocketRegion(x, y, z));
        const seam = Math.max(1 - S.sstep(0.0, 0.012, pe) * (pe < 0.03 ? 1 : 1), 0);
        const hem = 1 - S.sstep(0.0, 0.015, Math.abs(y - 0.94));
        const k = 1 - 0.1 * hem;
        const c = new THREE.Color(C.navy); return [c.r * k, c.g * k, c.b * k, 1];
      });
      const mat = patchSolid(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }), {
        rim: 1.3, fuzz: 1, decal: { tex: logoTex, center: new THREE.Vector2(-0.24, 1.53), size: new THREE.Vector2(0.24, 0.24) } });
      const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; m.name = 'hoodie';
      place(m, torso);
      this.hoodieMat = mat;
    }
    // zipper: teeth along the front centre line, + slider and pull
    {
      const metal = patchSolid(new THREE.MeshStandardMaterial({ color: '#b9b2a2', roughness: 0.32, metalness: 1 }), { rim: 0.3 });
      const teethGeo = new THREE.BoxGeometry(0.03, 0.012, 0.012);
      const pts = [];
      for (let y = 0.95; y <= 1.84; y += 0.0125) {
        let z = 0.8; for (let i = 0; i < 40; i++) { const d = hoodieSDF.cut(0, y, z); z -= d; if (Math.abs(d) < 1e-4) break; }
        pts.push([y, z]);
      }
      const im = new THREE.InstancedMesh(teethGeo, metal, pts.length);
      const M = new THREE.Matrix4(); const qn = new THREE.Quaternion();
      pts.forEach(([y, z], i) => {
        // tilt teeth to follow the surface
        const e = 0.01; const dz = (hoodieSDF.cut(0, y + e, z) - hoodieSDF.cut(0, y - e, z)) / (2 * e);
        qn.setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.atan2(dz, 1) * 0.0);
        M.compose(new THREE.Vector3((i % 2 ? 0.007 : -0.007), y, z + 0.004), qn, new THREE.Vector3(1, 1, 1)); im.setMatrixAt(i, M);
      });
      im.castShadow = true; place(im, torso);
      // slider + pull near the top of the zip
      const zTop = pts[pts.length - 14];
      const slider = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.03), metal);
      slider.position.set(0, zTop[0], zTop[1] + 0.02);
      const pull = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.08, 4, 12), metal);
      pull.position.set(0, zTop[0] - 0.07, zTop[1] + 0.035); pull.rotation.x = 0.25;
      const zg = new THREE.Group(); zg.add(slider, pull); slider.castShadow = pull.castShadow = true;
      place(zg, torso);
      this.zipTop = zTop;
    }
    // chest fur in the neck opening (white, blue edge)
    {
      const f = S.ellipsoid([0, 1.95, 0.12], [0.3, 0.32, 0.3]);
      const geo = dual(f, [-0.35, 1.6, -0.2], [0.35, 2.3, 0.45], 0.012 / qf, (x, y, z) => {
        const w = S.sstep(0.13, 0.22, Math.abs(x));
        return [...S.mix3(C.white, C.blue, w), 1];
      });
      const m = furMesh(geo, furOpt); place(m, torso);
    }

    // ---------------- head ----------------
    // Designed against the brand render: big white face framed by a black ring that arcs over
    // each eye, blue cap with a V between the eyes, large glossy eyes, smiling black beak.
    const HC = [0, 2.36, 0.03];
    const EYE_R = 0.15;
    const eyeC = (s) => [s * 0.215, 2.40, 0.405];
    this.HC = HC;
    {
      let f = S.smin(0.16,
        S.ellipsoid(HC, [0.56, 0.48, 0.5]),
        S.sphere([0.21, 2.22, 0.22], 0.27), S.sphere([-0.21, 2.22, 0.22], 0.27),
        S.ellipsoid([0, 2.06, 0.08], [0.38, 0.2, 0.34]));
      for (const sg of [1, -1]) f = S.sub(f, S.sphere(eyeC(sg), EYE_R + 0.014), 0.035);
      this.headSDF = f;
      const eL = [0.215, 0.04], eR = [-0.215, 0.04];
      const ell = (px, py) => { const rx = 0.42, ry = 0.3, cx = 0, cy = -0.17; const k = Math.hypot((px - cx) / rx, (py - cy) / ry); return (k - 1) * Math.min(rx, ry); };
      const paint = (x, y, z) => {
        const px = x, py = y - HC[1];
        const dEye = Math.min(Math.hypot(px - eL[0], py - eL[1]), Math.hypot(px - eR[0], py - eR[1]));
        const front = S.sstep(-0.05, 0.12, z - HC[2]);
        const dW = Math.min(dEye - 0.205, ell(px, py));
        // over the top of each eye the white gives way to a black arc ("brow")
        const topArc = dEye < 0.232 && py > 0.07 && dEye > 0.15 && Math.abs(px) > 0.1 ? 1 : 0;
        let white = (1 - S.sstep(-0.012, 0.012, dW)) * front * (1 - topArc);
        let black = S.sstep(-0.012, 0.012, dW) * (1 - S.sstep(0.055, 0.075, dW)) * front * (py > 0.12 ? 1 - S.sstep(0.12, 0.2, py) : 1);
        if (topArc) black = Math.max(black, front);
        // white throat continues into the chest: no ring under the chin
        black *= 1 - (1 - S.sstep(0.16, 0.24, Math.abs(px))) * S.sstep(-0.26, -0.33, py);
        if (Math.abs(px) < 0.24 && py < -0.3) white = Math.max(white, front * (1 - S.sstep(-0.012, 0.03, ell(px, py) - 0.05)));
        // blue V between the eyes down to the beak
        const vHalf = 0.035 + 0.32 * Math.max(0, py + 0.07);
        const vee = (1 - S.sstep(vHalf - 0.012, vHalf + 0.012, Math.abs(px))) * S.sstep(-0.085, -0.06, py) * S.sstep(0.155, 0.175, dEye);
        let col = S.mix3(C.blue, C.white, white);
        col = S.mix3(col, C.black, black);
        col = S.mix3(col, C.blue, vee * front);
        let len = 1;
        if (dEye < 0.2) len = 0.25 + 0.75 * S.sstep(0.165, 0.2, dEye);
        if (Math.abs(px) < 0.24 && py < -0.0 && py > -0.3 && z > 0.33) len *= 0.35; // around the beak
        return [...col, len];
      };
      const geo = dual(f, [-0.68, 1.84, -0.52], [0.68, 2.92, 0.7], 0.0095 / qh, paint);
      const m = furMesh(geo, { ...furOpt, len: 0.024 }); place(m, head); m.userData.setComb(new THREE.Vector3(0, -0.6, -0.8).normalize());
    }
    // crest: big soft rounded tufts swept back
    {
      const tufts = [
        [0.0, 2.8, 0.1, 0.0, 0.35, 0.34], [0.1, 2.79, 0.03, -0.3, 0.55, 0.3], [-0.1, 2.79, 0.03, 0.3, 0.55, 0.29],
        [0.04, 2.81, -0.07, -0.08, 0.8, 0.4], [-0.05, 2.8, -0.11, 0.12, 0.95, 0.35], [0.0, 2.76, -0.2, 0.0, 1.2, 0.3]];
      const fs = tufts.map(([x, y, z, rz, rx, l]) => {
        const tip = [x + Math.sin(-rz) * l, y + Math.cos(rx) * Math.cos(rz) * l, z - Math.sin(rx) * l];
        return S.roundCone([x, y - 0.06, z], tip, 0.14, 0.07);
      });
      const f = S.smin(0.045, ...fs);
      const geo = dual(f, [-0.5, 2.55, -0.75], [0.5, 3.35, 0.45], 0.009 / qf, (x, y, z) => [...S.mix3(C.blue, C.blueDeep, S.sstep(2.95, 3.2, y) * 0.25), 1]);
      const m = furMesh(geo, { ...furOpt, len: 0.02 }); place(m, head); m.userData.setComb(new THREE.Vector3(0, 1, -0.5).normalize());
      this.parts.crest = m;
    }
    // eyes: large glossy eyes in soft sockets, crisp black rims
    {
      const eyeTex = canvasTex(2048, 1024, (ctx, w, h) => {
        // spherical UV: v = theta/pi from the front pole (after rotation)
        ctx.fillStyle = '#f4f6fb'; ctx.fillRect(0, 0, w, h);
        const vI = 0.235, vP = 0.118;
        const gr = ctx.createLinearGradient(0, 0, 0, h * vI);
        gr.addColorStop(0.0, '#020306'); gr.addColorStop(vP / vI - 0.02, '#03040a'); gr.addColorStop(vP / vI + 0.02, '#0f3cb8');
        gr.addColorStop(0.62, '#2a6dff'); gr.addColorStop(0.84, '#4f93ff'); gr.addColorStop(0.95, '#0d2a7a'); gr.addColorStop(1.0, '#07122e');
        ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h * vI);
        let sd = 3; const rnd = () => ((sd = (sd * 16807) % 2147483647) / 2147483647);
        for (let i = 0; i < 700; i++) { // iris fibres
          const u = rnd() * w; ctx.strokeStyle = `rgba(${rnd() < 0.55 ? '150,195,255' : '8,25,90'},${0.08 + rnd() * 0.18})`;
          ctx.lineWidth = 1 + rnd() * 2.5; ctx.beginPath(); ctx.moveTo(u, h * (vP + 0.004)); ctx.lineTo(u + (rnd() - 0.5) * 10, h * (vI - 0.01 - rnd() * 0.04)); ctx.stroke();
        }
        const sg = ctx.createLinearGradient(0, h * vI, 0, h * 0.5); sg.addColorStop(0, '#dfe5f2'); sg.addColorStop(0.15, '#f4f6fb'); sg.addColorStop(1, '#fbfcfe');
        ctx.fillStyle = sg; ctx.fillRect(0, h * vI, w, h * (0.5 - vI));
      });
      eyeTex.wrapS = THREE.RepeatWrapping;
      const geoE = new THREE.SphereGeometry(EYE_R, 96, 64); geoE.rotateX(Math.PI / 2); // pole -> +z
      const rimMat = patchSolid(new THREE.MeshStandardMaterial({ color: '#08090c', roughness: 0.55 }), { rim: 0.4 });
      for (const s of [1, -1]) {
        const pivot = g(s > 0 ? 'eyeL' : 'eyeR', head, toLocal(head, eyeC(s)).toArray());
        const mat = new THREE.MeshPhysicalMaterial({ map: eyeTex, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, ior: 1.4 });
        mat.userData.lid = { value: 1 }; mat.userData.lidCol = { value: new THREE.Color('#141a3a') };
        mat.onBeforeCompile = (sh) => {
          Object.assign(sh.uniforms, JU, { uLid: mat.userData.lid, uLidCol: mat.userData.lidCol });
          sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vObjE; varying float vWY;')
            .replace('#include <begin_vertex>', '#include <begin_vertex>\nvObjE = position / ' + EYE_R.toFixed(4) + '; vWY = (modelMatrix * vec4(position,1.)).y;');
          sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
              varying vec3 vObjE; varying float vWY; uniform float uLid; uniform vec3 uLidCol; uniform float uWaterY, uWaterAmt, uWaterDir, uTime; uniform vec3 uWaterColor, uGlowColor;`)
            .replace('#include <map_fragment>', `#include <map_fragment>
              float lidY = mix(-1.05, 1.15, uLid) - 0.25 * vObjE.x * vObjE.x;
              float lid = smoothstep(lidY - 0.02, lidY + 0.02, vObjE.y);
              float lash = (1.0 - smoothstep(0.0, 0.07, abs(vObjE.y - lidY))) * step(uLid, 0.995);
              diffuseColor.rgb = mix(diffuseColor.rgb, uLidCol, lid);
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.005), lash);
              // soft occlusion where the eye meets the socket
              diffuseColor.rgb *= mix(0.55, 1.0, smoothstep(0.35, 0.75, vObjE.z));
              float wm = uWaterAmt * smoothstep(-0.04, 0.04, (vWY - uWaterY) * uWaterDir);
              diffuseColor.rgb = mix(diffuseColor.rgb, uWaterColor, wm);`)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.9, lid);')
            .replace('vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;', `
              vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
              { vec3 V = normalize(vViewPosition); vec3 Rf = reflect(-V, normal);
                vec3 L1 = normalize(vec3(-0.5, 0.62, 0.6)); vec3 L2 = normalize(vec3(0.45, -0.3, 0.84));
                float c1 = smoothstep(0.985, 0.992, dot(Rf, L1)) * 3.2 + pow(max(dot(Rf, L1), 0.0), 40.0) * 0.06;
                float c2 = smoothstep(0.994, 0.997, dot(Rf, L2)) * 1.6;
                outgoingLight += (c1 + c2) * (1.0 - lid) * vec3(1.0, 0.99, 0.97); }`);
        };
        const eye = new THREE.Mesh(geoE, mat); eye.castShadow = false; eye.receiveShadow = true;
        eye.rotation.y = s * 0.1;
        pivot.add(eye); this.parts[(s > 0 ? 'eyeL' : 'eyeR') + 'Mesh'] = eye;
        (this.eyeMats ||= {})[s > 0 ? 'L' : 'R'] = mat;
        // black rim ring where the eye meets the fur
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.134, 0.021, 18, 72), rimMat);
        const ax = new THREE.Vector3(Math.sin(s * 0.1), 0, Math.cos(s * 0.1));
        rim.position.copy(toLocal(head, eyeC(s))).addScaledVector(ax, 0.072);
        rim.lookAt(rim.position.clone().add(ax)); rim.castShadow = true;
        head.add(rim);
      }
    }
    // beak: rounded triangle hanging over a wide open smile
    {
      const jaw = this.parts.jaw;
      jaw.position.copy(toLocal(head, [0, 2.3, 0.42]));
      const beakMat = patchSolid(new THREE.MeshPhysicalMaterial({ color: C.beak, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.06 }), { rim: 0.6 });
      // upper mandible: seen from the front an inverted rounded triangle hanging between the eyes,
      // domed forward, its tip hooking over the open mouth
      const upper = (x, y, z) => {
        const d2 = S.sdTri2(x, y, [-0.14, 2.345], [0.14, 2.345], [0, 2.215]) - 0.04;
        const t = Math.max(0, Math.min(1, (2.385 - y) / 0.21));
        const zF = 0.585 + 0.05 * (1 - Math.min(1, Math.abs(x) / 0.2)) - 0.9 * x * x + 0.05 * Math.sin(t * Math.PI) * (1 - t * 0.5);
        const dz = Math.max(z - zF, 0.42 - z);
        const h = Math.max(0.04 - Math.abs(d2 - dz), 0) / 0.04;
        return Math.max(d2, dz) + h * h * 0.04 * 0.25;
      };
      const ug = S.meshSDF(upper, [-0.27, 2.1, 0.36], [0.27, 2.46, 0.7], 0.005 / q);
      const um = new THREE.Mesh(ug, beakMat); um.castShadow = true; place(um, head); um.name = 'beakUpper';
      // lower mandible: a black smile crescent under the tip, holding the tongue
      const lowerCut = (x, y, z) => {
        const outer = Math.hypot(x, (y - 2.31) * 0.92) - 0.225, inner = -(Math.hypot(x, (y - 2.34) * 0.95) - 0.192);
        const d2 = Math.max(outer, inner, y - 2.31);
        const dz = Math.max(z - (0.56 - 0.7 * x * x), 0.43 - z);
        const h = Math.max(0.025 - Math.abs(d2 - dz), 0) / 0.025;
        return Math.max(d2, dz) + h * h * 0.025 * 0.25;
      };
      const lg = S.meshSDF(lowerCut, [-0.25, 2.08, 0.38], [0.25, 2.36, 0.62], 0.005 / q);
      const lm = new THREE.Mesh(lg, beakMat); lm.castShadow = true; place(lm, jaw);
      const tongue = new THREE.Mesh(S.meshSDF(S.ellipsoid([0, 2.165, 0.485], [0.13, 0.05, 0.07]), [-0.16, 2.1, 0.4], [0.16, 2.24, 0.58], 0.005 / q),
        patchSolid(new THREE.MeshPhysicalMaterial({ color: '#ef6f80', roughness: 0.32, clearcoat: 0.7, clearcoatRoughness: 0.15 })));
      place(tongue, jaw);
      const mouth = new THREE.Mesh(S.meshSDF(S.ellipsoid([0, 2.23, 0.45], [0.2, 0.12, 0.07]), [-0.23, 2.09, 0.36], [0.23, 2.36, 0.55], 0.006 / q),
        patchSolid(new THREE.MeshStandardMaterial({ color: '#4a0f17', roughness: 0.6 })));
      place(mouth, head);
    }

    // ---------------- arms + wing hands ----------------
    const sleeveMat = this.hoodieMat;
    const navy = new THREE.Color(C.navy);
    for (const s of [1, -1]) {
      const n = s > 0 ? 'L' : 'R';
      const sh = g('shoulder' + n, torso, toLocal(torso, [s * 0.47, 1.72, -0.02]).toArray());
      const upperArm = new THREE.Mesh(S.meshSDF(S.smin(0.05, S.roundCone([0, 0, 0], [0, -0.4, 0], 0.17, 0.155), S.sphere([0, 0.02, 0], 0.17)),
        [-0.22, -0.6, -0.22], [0.22, 0.22, 0.22], 0.012 / q, () => [navy.r, navy.g, navy.b, 1]), sleeveMat);
      upperArm.castShadow = upperArm.receiveShadow = true; sh.add(upperArm);
      const el = g('elbow' + n, sh, [0, -0.4, 0]);
      const fore = S.smin(0.04, S.sphere([0, 0, 0], 0.155), S.roundCone([0, 0, 0], [0, -0.3, 0], 0.152, 0.15),
        (x, y, z) => { const r = Math.hypot(x, z); return Math.hypot(r - 0.13, (y + 0.32) * 1.0) - 0.05; });
      const foreArm = new THREE.Mesh(S.meshSDF(fore, [-0.24, -0.42, -0.24], [0.24, 0.2, 0.24], 0.011 / q, (x, y, z) => {
        const cuff = y < -0.285 ? 0.8 + 0.2 * Math.abs(Math.sin(Math.atan2(z, x) * 14)) : 1; return [navy.r * cuff, navy.g * cuff, navy.b * cuff, 1]; }), sleeveMat);
      foreArm.castShadow = foreArm.receiveShadow = true; el.add(foreArm);
      const wr = g('wrist' + n, el, [0, -0.33, 0]);
      // feather hand: primaries (blue), coverts (white), wrist row (blue)
      const geos = [];
      const addFeather = (len, w, ang, tilt, z, y0, cBase, cTip, tipStart) => {
        const f = feather(len, w, 0.45);
        const geo = dual(f, [-w, -len - w, -w], [w, w, w], 0.0085 / qf, (x, y, zz) => {
          const t = -y / len; return [...S.mix3(cBase, cTip, S.sstep(tipStart, tipStart + 0.12, t)), 1];
        });
        const M = new THREE.Matrix4().makeRotationZ(ang).premultiply(new THREE.Matrix4().makeRotationX(tilt)).setPosition(0, y0, z);
        geos.push(xf(geo, M));
      };
      // rows of scalloped feathers: wrist coverts (blue), a white bar, long primaries (blue)
      for (let i = 0; i < 6; i++) { const a = (i / 5 - 0.5) * 0.7; addFeather(0.7 - Math.abs(i - 2.5) * 0.05, 0.2, a, 0.04, -0.05, -0.02, C.blue, C.blueDeep, 0.8); }
      for (let i = 0; i < 5; i++) { const a = (i / 4 - 0.5) * 0.75; addFeather(0.44, 0.2, a, 0.06, -0.012, 0.0, C.blue, C.white, 0.5); }
      for (let i = 0; i < 4; i++) { const a = (i / 3 - 0.5) * 0.66; addFeather(0.26, 0.2, a, 0.08, 0.03, 0.02, C.blue, C.white, 0.58); }
      const hg = mergeD(geos);
      const hand = furMesh(hg, { ...furOpt, len: 0.013, density: 260 }); hand.userData.setComb(new THREE.Vector3(0, -1, 0));
      wr.add(hand); this.parts['hand' + n] = hand; wr.scale.setScalar(1.25);
    }

    // ---------------- tail ----------------
    {
      const geos = [];
      for (let i = 0; i < 3; i++) {
        const len = 0.62 - Math.abs(i - 1) * 0.08, w = 0.17;
        const f = feather(len, w, 0.4);
        const geo = dual(f, [-w, -len - w, -w], [w, w, w], 0.009 / qf, (x, y, z) => {
          const t = -y / len; let c = S.mix3(C.blue, C.white, S.sstep(0.78, 0.86, t)); c = S.mix3(c, C.black, (S.sstep(0.62, 0.66, t) - S.sstep(0.72, 0.76, t)) * 0.9); return [...c, 1];
        });
        geos.push(xf(geo, new THREE.Matrix4().makeRotationZ((i - 1) * 0.28).premultiply(new THREE.Matrix4().makeRotationX(-0.75)).setPosition((i - 1) * 0.05, 0, -0.01 * i)));
      }
      const m = furMesh(mergeD(geos), { ...furOpt, len: 0.03 }); m.userData.setComb(new THREE.Vector3(0, -1, 0));
      tail.add(m);
    }

    // ---------------- feet ----------------
    {
      const toes = [[-0.175, 0.31], [0, 0.37], [0.175, 0.31]].map(([x, z]) => S.ellipsoid([x, 0.125, z], [0.11, 0.125, 0.14]));
      const f = S.smaxk(0.03, S.smin(0.035, S.smin(0.08, S.ellipsoid([0, 0.19, 0.04], [0.26, 0.2, 0.27]), S.ellipsoid([0, 0.12, -0.2], [0.16, 0.12, 0.13])), ...toes,
        S.capsule([0, 0.2, 0], [0, 0.5, -0.02], 0.15)), (x, y, z) => 0.012 - y);
      const geo = dual(f, [-0.36, -0.02, -0.4], [0.36, 0.7, 0.55], 0.011 / qf, (x, y, z) => {
        const k = 0.85 + 0.2 * S.sstep(0.0, 0.3, y); return [C.grey[0] * k, C.grey[1] * k, C.grey[2] * k, 0.45];
      });
      for (const [s, ft] of [[1, footL], [-1, footR]]) {
        const m = furMesh(geo, { ...furOpt, len: 0.03 }); ft.add(m);
      }
    }

    // ---------------- lanyard + badge ----------------
    this.buildLanyard(torso, toLocal, hoodieSDF.cut, logoTex);
    head.scale.setScalar(1.12);
    this.setRest();
    return this;
  }

  buildLanyard(torso, toLocal, hoodie, logoTex) {
    const strapTex = canvasTex(64, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2b62e8'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      for (let i = 0; i < 6; i++) { // small 6-point asterisk stars
        const cx = w / 2, cy = (i + 0.5) * h / 6;
        for (let k = 0; k < 3; k++) { ctx.save(); ctx.translate(cx, cy); ctx.rotate(k * Math.PI / 3); ctx.fillRect(-2.5, -14, 5, 28); ctx.restore(); }
      }
      ctx.fillStyle = 'rgba(0,0,30,0.25)'; ctx.fillRect(0, 0, 4, h); ctx.fillRect(w - 4, 0, 4, h);
    });
    strapTex.wrapT = THREE.RepeatWrapping;
    const strapMat = patchSolid(new THREE.MeshStandardMaterial({ map: strapTex, roughness: 0.6, side: THREE.DoubleSide }), { rim: 0.5 });
    const clip = new THREE.Vector3(0.1, 1.4, 0);
    // project a point onto the hoodie surface along +z
    const onSurf = (x, y, zBack, off = 0.014) => {
      let z = 0.9; for (let i = 0; i < 50; i++) { const d = hoodie(x, y, z) - off; z -= d * 0.9; if (Math.abs(d) < 2e-4) break; }
      return new THREE.Vector3(x, y, Math.max(z, zBack));
    };
    clip.copy(onSurf(clip.x, clip.y, -1, 0.03));
    for (const s of [1, -1]) {
      const pts = [new THREE.Vector3(s * 0.2, 2.0, -0.12), new THREE.Vector3(s * 0.29, 1.96, 0.12), onSurf(s * 0.25, 1.8, 0.3, 0.02),
        onSurf(s * 0.18 + 0.05, 1.62, 0.3), onSurf(0.1 + s * 0.06, 1.48, 0.3, 0.02), clip.clone().add(new THREE.Vector3(s * 0.015, 0.02, 0))];
      const curve = new THREE.CatmullRomCurve3(pts);
      const N = 60, W = 0.055;
      const pos = [], uv = [], idx = [];
      for (let i = 0; i <= N; i++) {
        const t = i / N; const p = curve.getPoint(t); const tg = curve.getTangent(t);
        let nrm = new THREE.Vector3(p.x * 0.6, 0, Math.max(p.z, 0.05) + 0.3).normalize();
        if (p.z < 0) nrm.set(Math.sign(p.x), 0.3, 0).normalize();
        const side = new THREE.Vector3().crossVectors(tg, nrm).normalize().multiplyScalar(W / 2);
        pos.push(p.x - side.x, p.y - side.y, p.z - side.z, p.x + side.x, p.y + side.y, p.z + side.z);
        uv.push(0, t * 4, 1, t * 4);
        if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      gg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); gg.setIndex(idx); gg.computeVertexNormals();
      const m = new THREE.Mesh(gg, strapMat); m.castShadow = true; m.receiveShadow = true;
      const p = toLocal(torso, [0, 0, 0]); m.position.copy(p); torso.add(m);
    }
    // swivel clip + badge on a pendulum pivot
    const metal = patchSolid(new THREE.MeshStandardMaterial({ color: '#c9c3b6', roughness: 0.25, metalness: 1 }), { rim: 0.3 });
    const pivot = new THREE.Group(); pivot.position.copy(toLocal(torso, clip.toArray())).add(new THREE.Vector3(0, 0, 0.035)); pivot.rotation.x = -0.36; torso.add(pivot); this.parts.badge = pivot;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.007, 10, 24), metal); pivot.add(ring);
    const hook = new THREE.Mesh(new THREE.CapsuleGeometry(0.014, 0.06, 4, 10), metal); hook.position.y = -0.055; pivot.add(hook);
    const badge = new THREE.Group(); badge.position.set(0.0, -0.1, 0.0); pivot.add(badge);
    const BW = 0.36, BH = 0.46;
    const cardTex = canvasTex(512, 660, (ctx, w, h) => {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, w, h);
      const gr = ctx.createLinearGradient(0, 0, w, h * 0.5); gr.addColorStop(0, '#3d84ff'); gr.addColorStop(1, '#1f55e0');
      drawLogo(ctx, w / 2, h * 0.36, w * 0.5, gr);
      ctx.fillStyle = '#1f56e2'; ctx.fillRect(0, h * 0.74, w, h * 0.26);
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(0, h * 0.74, w, h * 0.012);
    });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.88, BH * 0.84), patchSolid(new THREE.MeshStandardMaterial({ map: cardTex, roughness: 0.55 }), { rim: 0.2 }));
    card.position.set(0, -BH / 2 - 0.01, 0.006); badge.add(card);
    const back = new THREE.Mesh(new THREE.PlaneGeometry(BW * 0.88, BH * 0.84), patchSolid(new THREE.MeshStandardMaterial({ color: '#e8e8ea', roughness: 0.7 })));
    back.rotation.y = Math.PI; back.position.set(0, -BH / 2 - 0.01, -0.004); badge.add(back);
    // clear PVC holder with rounded corners and a slot
    const shp = new THREE.Shape(); const r = 0.03, x0 = -BW / 2, y0 = -BH - 0.03, x1 = BW / 2, y1 = 0.0;
    shp.moveTo(x0 + r, y0); shp.lineTo(x1 - r, y0); shp.quadraticCurveTo(x1, y0, x1, y0 + r); shp.lineTo(x1, y1 - r); shp.quadraticCurveTo(x1, y1, x1 - r, y1);
    shp.lineTo(x0 + r, y1); shp.quadraticCurveTo(x0, y1, x0, y1 - r); shp.lineTo(x0, y0 + r); shp.quadraticCurveTo(x0, y0, x0 + r, y0);
    const slot = new THREE.Path(); slot.absarc(0, -0.035, 0.012, 0, Math.PI * 2, true); shp.holes.push(slot);
    const holder = new THREE.Mesh(new THREE.ExtrudeGeometry(shp, { depth: 0.016, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 3, curveSegments: 10 }),
      patchSolid(new THREE.MeshPhysicalMaterial({ color: '#f2f6ff', roughness: 0.06, transparent: true, opacity: 0.22, clearcoat: 1, depthWrite: false }), { rim: 0.0 }));
    holder.position.z = -0.008; holder.renderOrder = 5; badge.add(holder);
    card.castShadow = true;
    this.badgeMesh = badge;
  }

  setShells(n) {
    if (this._shells === n) return; this._shells = n;
    this.root.traverse((o) => { if (o.userData.setShells) o.userData.setShells(n); });
  }

  setRest() {
    const P = this.parts;
    this.rest = {};
    for (const k in P) this.rest[k] = { p: P[k].position.clone(), r: P[k].rotation.clone() };
  }

  // pose: plain object of rotations (radians) applied on top of the rest pose
  // Pose API. Rotations are added on top of the rest pose.
  //  body/torso/neck/head: [rx, ry, rz]; bodyPos: [x,y,z]
  //  armL/armR: { out, fwd, twist, bend, bendFwd, wrist:[x,y,z] } (mirrored), or raw { sh, el, wr }
  //  plant (default true): feet stay on the ground even if the body moves; footL/R: { p, r } in root space
  pose(o = {}) {
    const P = this.parts, R = this.rest;
    for (const k in R) { P[k].position.copy(R[k].p); P[k].rotation.copy(R[k].r); }
    const ap = (name, r = [0, 0, 0], p = null) => { const o3 = P[name]; if (!o3) return; o3.rotation.x += r[0] || 0; o3.rotation.y += r[1] || 0; o3.rotation.z += r[2] || 0; if (p) o3.position.add(new THREE.Vector3(...p)); };
    ap('body', o.body, o.bodyPos);
    ap('torso', o.torso);
    ap('neck', o.neck);
    ap('head', o.head);
    ap('jaw', [(o.jaw ?? 0.22) * 0.7, 0, 0]);
    for (const s of ['L', 'R']) {
      const sg = s === 'L' ? 1 : -1;
      const a = o['arm' + s] || {};
      const out = a.out ?? 0, fwd = a.fwd ?? 0, tw = a.twist ?? 0, bend = a.bend ?? 0, bf = a.bendFwd ?? 0;
      const w = a.wrist || [0, 0, 0];
      ap('shoulder' + s, [-fwd + (a.sh?.[0] ?? 0), sg * tw + (a.sh?.[1] ?? 0), sg * (0.32 + out) + (a.sh?.[2] ?? 0)]);
      ap('elbow' + s, [-0.1 - bf + (a.el?.[0] ?? 0), a.el?.[1] ?? 0, sg * bend + (a.el?.[2] ?? 0)]);
      ap('wrist' + s, [w[0] + (a.wr?.[0] ?? 0), sg * w[1] + (a.wr?.[1] ?? 0), sg * w[2] + (a.wr?.[2] ?? 0)]);
    }
    ap('tail', o.tail);
    ap('badge', o.badge);
    ap('crest', o.crest);
    if (o.eyes) for (const s of ['L', 'R']) ap('eye' + s, [o.eyes[1] ?? 0, o.eyes[0] ?? 0, 0]);
    const lid = o.lid ?? 1;
    this.eyeMats.L.userData.lid.value = o.lidL ?? lid;
    this.eyeMats.R.userData.lid.value = o.lidR ?? lid;
    // feet: planted in root space unless flying
    const body = P.body; body.updateMatrix();
    const inv = this._inv || (this._inv = new THREE.Matrix4()); inv.copy(body.matrix).invert();
    for (const s of ['L', 'R']) {
      const f = P['foot' + s], fo = o['foot' + s] || {};
      const rp = this.footRest[s];
      if (o.plant === false) {
        const tuck = o.tuck ?? 0;
        f.position.set(rp.x * (1 - 0.2 * tuck), -0.9 + 0.35 * tuck, rp.z - 0.1 * tuck);
        f.rotation.set(-0.9 * tuck + (fo.r?.[0] ?? 0), s === 'L' ? 0.12 : -0.12, 0); f.scale.setScalar(this.footScale);
        continue;
      }
      const M = new THREE.Matrix4().compose(new THREE.Vector3(rp.x + (fo.p?.[0] ?? 0), rp.y + (fo.p?.[1] ?? 0), rp.z + (fo.p?.[2] ?? 0)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(fo.r?.[0] ?? 0, (s === 'L' ? 0.12 : -0.12) + (fo.r?.[1] ?? 0), fo.r?.[2] ?? 0)), new THREE.Vector3(this.footScale, this.footScale, this.footScale));
      M.premultiply(inv);
      M.decompose(f.position, f.quaternion, f.scale);
    }
  }

}
