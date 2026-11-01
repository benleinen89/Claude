// Jay from a rigged glTF (Higgsfield image-to-3D, auto-rigged humanoid skeleton), animated here by code:
// every rotation is given as an axis in the model's REST space at that joint, so the controls stay
// intuitive whatever the rig's bone-axis conventions are.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0), Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion(), _w = new THREE.Quaternion();

export class GJay {
  async load(url) {
    const gltf = await new GLTFLoader().loadAsync(url);
    const model = this.model = gltf.scene;
    model.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(model);
    const h = box.max.y - box.min.y, s = 1 / h;               // normalise to 1 unit tall, feet on y = 0
    model.scale.multiplyScalar(s);
    model.position.set(-(box.min.x + box.max.x) / 2 * s, -box.min.y * s, -(box.min.z + box.max.z) / 2 * s);
    this.body = new THREE.Group(); this.body.add(model);       // body: pivot for whole-body pitch/roll (flight)
    this.root = new THREE.Group(); this.root.add(this.body);   // root: placement in the shot
    this.bones = {}; this.meshes = [];
    model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true; o.frustumCulled = false;
        // plush fabric: keep the baked colour/normal maps, add sheen so the fleece and feathers read soft
        const m0 = o.material, m = new THREE.MeshPhysicalMaterial();
        for (const k of ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'emissiveMap', 'normalScale', 'color', 'emissive']) if (m0[k] !== undefined && m0[k] !== null) m[k] = m0[k]?.clone ? (m0[k].isTexture ? m0[k] : m0[k].clone()) : m0[k];
        m.metalness = 0; m.metalnessMap = null; m.roughness = 1.0; m.sheen = 0.6; m.sheenRoughness = 0.55; m.sheenColor = new THREE.Color(0.75, 0.82, 1.0);
        m.envMapIntensity = 1.0; o.material = m; this.meshes.push(o);
      }
    });
    model.updateMatrixWorld(true);
    this.rest = {};
    for (const [n, b] of Object.entries(this.bones)) this.rest[n] = { q: b.quaternion.clone(), p: b.position.clone(), w: b.getWorldQuaternion(new THREE.Quaternion()) };
    this.names = Object.keys(this.bones);
    return this;
  }
  find(...cands) { for (const c of cands) { const k = this.names.find((n) => n.toLowerCase().replace(/[^a-z0-9]/g, '') === c); if (k) return k; } return null; }
  map() {
    const f = (...c) => this.find(...c);
    this.B = {
      hips: f('hips', 'pelvis', 'root'), spine: f('spine', 'spine01'), chest: f('spine02', 'spine1', 'chest', 'spine2'),
      neck: f('neck'), head: f('head'),
      shL: f('leftshoulder'), armL: f('leftarm', 'leftupperarm'), foreL: f('leftforearm', 'leftlowerarm'), handL: f('lefthand'),
      shR: f('rightshoulder'), armR: f('rightarm', 'rightupperarm'), foreR: f('rightforearm', 'rightlowerarm'), handR: f('righthand'),
      legL: f('leftupleg', 'leftupperleg', 'leftthigh'), kneeL: f('leftleg', 'leftlowerleg', 'leftshin'), footL: f('leftfoot'),
      legR: f('rightupleg', 'rightupperleg', 'rightthigh'), kneeR: f('rightleg', 'rightlowerleg', 'rightshin'), footR: f('rightfoot'),
    };
    return this.B;
  }
  reset() { for (const [n, b] of Object.entries(this.bones)) { b.quaternion.copy(this.rest[n].q); b.position.copy(this.rest[n].p); } }
  // rotate bone `key` by `angle` about `axis` given in rest model space
  rot(key, axis, angle) {
    const n = this.B[key]; if (!n || !angle) return;
    const b = this.bones[n], W = this.rest[n].w;
    _q.setFromAxisAngle(axis, angle);
    _w.copy(W).invert().multiply(_q).multiply(W);
    b.quaternion.multiply(_w);
  }
  // p: { lean:[x,y,z] (spine), head:[x,y,z], armL/armR:{ up, fwd, twist, bend, wrist }, legL/legR:{ fwd, bend }, bob }
  pose(p = {}) {
    if (!this.B) this.map();
    this.reset();
    const v = (a, i) => (a ? a[i] || 0 : 0);
    this.rot('spine', X, v(p.lean, 0) * 0.5); this.rot('chest', X, v(p.lean, 0) * 0.5);
    this.rot('spine', Y, v(p.lean, 1) * 0.5); this.rot('chest', Y, v(p.lean, 1) * 0.5);
    this.rot('spine', Z, v(p.lean, 2) * 0.5); this.rot('chest', Z, v(p.lean, 2) * 0.5);
    this.rot('neck', X, v(p.head, 0) * 0.4); this.rot('head', X, v(p.head, 0) * 0.6);
    this.rot('neck', Y, v(p.head, 1) * 0.4); this.rot('head', Y, v(p.head, 1) * 0.6);
    this.rot('neck', Z, v(p.head, 2) * 0.4); this.rot('head', Z, v(p.head, 2) * 0.6);
    for (const [side, sg] of [['L', 1], ['R', -1]]) {
      // the character faces +Z; its left side is +X. "up" raises the wing-arm sideways, "fwd" swings it forward.
      const a = p['arm' + side] || {};
      this.rot('arm' + side, Z, sg * (a.up || 0));
      this.rot('arm' + side, Y, -sg * (a.fwd || 0));
      this.rot('arm' + side, X, a.twist || 0);
      this.rot('fore' + side, Y, -sg * (a.bend || 0));
      this.rot('hand' + side, Z, sg * (a.wrist || 0));
      const l = p['leg' + side] || {};
      this.rot('leg' + side, X, -(l.fwd || 0));
      this.rot('leg' + side, Z, sg * (l.out || 0));
      this.rot('knee' + side, X, l.bend || 0);
      this.rot('foot' + side, X, l.foot || 0);
    }
    if (p.bob && this.B.hips) this.bones[this.B.hips].position.y += p.bob / this.model.scale.y;
    this.body.rotation.set(p.pitch || 0, 0, p.roll || 0);
    this.body.position.y = p.lift || 0;
  }
}

// ---- motion library (t in seconds) ----
// A-pose rest has the wing-arms ~40 degrees down from horizontal, so up≈0.7 is a T.
export function gFly(t, { freq = 2.2, amp = 0.55, glide = 0 } = {}) {
  const ph = t * freq * Math.PI * 2, w = (1 - glide);
  const flap = Math.sin(ph) * amp * w + 0.3 * glide;
  return {
    pitch: 1.15, lean: [-0.2, 0, 0], head: [-1.0, 0, 0],
    armL: { up: 0.95 + flap, fwd: 0.05, bend: -0.15 * Math.cos(ph) * w, wrist: 0.2 * Math.sin(ph - 0.6) * w },
    armR: { up: 0.95 + flap, fwd: 0.05, bend: -0.15 * Math.cos(ph) * w, wrist: 0.2 * Math.sin(ph - 0.6) * w },
    legL: { fwd: -0.35, bend: 0.25, foot: 0.5 }, legR: { fwd: -0.3, bend: 0.3, foot: 0.5 },
    lift: 0.04 * Math.sin(ph + 1.2) * w,
  };
}
export function gWave(t, { amt = 1 } = {}) {
  const w = Math.sin(t * Math.PI * 2 * 1.5);
  return {
    lean: [0.02, 0.05 * Math.sin(t * 1.3), 0.03 * w * amt], head: [0.05, 0.1 * Math.sin(t * 0.9), 0.08 * amt],
    armR: { up: 1.9 * amt, fwd: 0.25, bend: 0.35 + 0.35 * w * amt, wrist: 0.3 * w * amt },
    armL: { up: 0.15, fwd: 0.1, bend: 0.2 },
    bob: 0.006 * Math.sin(t * 6),
  };
}
