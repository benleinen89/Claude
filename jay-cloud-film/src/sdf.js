// Signed-distance modelling helpers + a Surface-Nets mesher.
// Everything the mascot is made of starts life as an SDF built from these.
import * as THREE from 'three';

export const V = (x = 0, y = 0, z = 0) => [x, y, z];
const len3 = (x, y, z) => Math.sqrt(x * x + y * y + z * z);

export function sphere(c, r) {
  return (x, y, z) => len3(x - c[0], y - c[1], z - c[2]) - r;
}
// cheap but well-behaved ellipsoid bound (IQ)
export function ellipsoid(c, r) {
  return (x, y, z) => {
    const px = (x - c[0]) / r[0], py = (y - c[1]) / r[1], pz = (z - c[2]) / r[2];
    const k0 = len3(px, py, pz);
    const k1 = len3(px / r[0], py / r[1], pz / r[2]);
    return k0 < 1e-6 ? -Math.min(r[0], r[1], r[2]) : (k0 * (k0 - 1.0)) / k1;
  };
}
export function capsule(a, b, r) {
  return (x, y, z) => {
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    let h = (pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz);
    h = Math.max(0, Math.min(1, h));
    return len3(pax - bax * h, pay - bay * h, paz - baz * h) - r;
  };
}
// round cone between a (radius ra) and b (radius rb)
export function roundCone(a, b, ra, rb) {
  return (x, y, z) => {
    const bax = b[0] - a[0], bay = b[1] - a[1], baz = b[2] - a[2];
    const l2 = bax * bax + bay * bay + baz * baz;
    const rr = ra - rb, a2 = l2 - rr * rr, il2 = 1 / l2;
    const pax = x - a[0], pay = y - a[1], paz = z - a[2];
    const yy = pax * bax + pay * bay + paz * baz;
    const zz = yy - l2;
    const qx = pax * l2 - bax * yy, qy = pay * l2 - bay * yy, qz = paz * l2 - baz * yy;
    const x2 = qx * qx + qy * qy + qz * qz;
    const y2 = yy * yy * l2, z2 = zz * zz * l2;
    const k = Math.sign(rr) * rr * rr * x2;
    if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - rb;
    if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - ra;
    return (Math.sqrt(x2 * a2 * il2) + yy * rr) * il2 - ra;
  };
}
export function roundBox(c, b, r) {
  return (x, y, z) => {
    const qx = Math.abs(x - c[0]) - b[0] + r, qy = Math.abs(y - c[1]) - b[1] + r, qz = Math.abs(z - c[2]) - b[2] + r;
    return len3(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, Math.max(qy, qz)), 0) - r;
  };
}
export function torus(c, R, r) { // ring in XZ plane
  return (x, y, z) => {
    const qx = Math.hypot(x - c[0], z - c[2]) - R;
    return Math.hypot(qx, y - c[1]) - r;
  };
}
// transform wrappers
export function translate(f, t) { return (x, y, z) => f(x - t[0], y - t[1], z - t[2]); }
export function rotX(f, a) { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => f(x, c * y + s * z, -s * y + c * z); }
export function rotY(f, a) { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => f(c * x - s * z, y, s * x + c * z); }
export function rotZ(f, a) { const c = Math.cos(a), s = Math.sin(a); return (x, y, z) => f(c * x + s * y, -s * x + c * y, z); }
export function scale(f, s) { return (x, y, z) => f(x / s, y / s, z / s) * s; }

export function smin(k, ...fs) {
  return (x, y, z) => {
    let d = fs[0](x, y, z);
    for (let i = 1; i < fs.length; i++) {
      const b = fs[i](x, y, z);
      const h = Math.max(k - Math.abs(d - b), 0) / k;
      d = Math.min(d, b) - h * h * k * 0.25;
    }
    return d;
  };
}
export function union(...fs) { return (x, y, z) => { let d = Infinity; for (const f of fs) d = Math.min(d, f(x, y, z)); return d; }; }
export function inter(...fs) { return (x, y, z) => { let d = -Infinity; for (const f of fs) d = Math.max(d, f(x, y, z)); return d; }; }
export function sub(a, b, k = 0) {
  if (!k) return (x, y, z) => Math.max(a(x, y, z), -b(x, y, z));
  return (x, y, z) => {
    const d1 = a(x, y, z), d2 = -b(x, y, z);
    const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
    return Math.max(d1, d2) + h * h * k * 0.25;
  };
}
export function smaxk(k, a, b) {
  return (x, y, z) => {
    const d1 = a(x, y, z), d2 = b(x, y, z);
    const h = Math.max(k - Math.abs(d1 - d2), 0) / k;
    return Math.max(d1, d2) + h * h * k * 0.25;
  };
}
export function offset(f, r) { return (x, y, z) => f(x, y, z) - r; }
export function displace(f, g) { return (x, y, z) => f(x, y, z) + g(x, y, z); }

// value noise for displacement
function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
export function vnoise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const fx = x - ix, fy = y - iy, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  let r = 0;
  for (let k = 0; k < 2; k++) for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const w = (i ? ux : 1 - ux) * (j ? uy : 1 - uy) * (k ? uz : 1 - uz);
    r += w * hash3(ix + i, iy + j, iz + k);
  }
  return r;
}

// ---------------------------------------------------------------------------
// Surface nets mesher. bmin/bmax: bounds, step: cell size.
// paint(x,y,z,nx,ny,nz) -> [r,g,b,a] (linear colour + extra channel)
export function meshSDF(f, bmin, bmax, step, paint = null, opts = {}) {
  const nx = Math.ceil((bmax[0] - bmin[0]) / step) + 1;
  const ny = Math.ceil((bmax[1] - bmin[1]) / step) + 1;
  const nz = Math.ceil((bmax[2] - bmin[2]) / step) + 1;
  const field = new Float32Array(nx * ny * nz);
  const idx = (i, j, k) => i + nx * (j + ny * k);
  for (let k = 0; k < nz; k++) {
    const z = bmin[2] + k * step;
    for (let j = 0; j < ny; j++) {
      const y = bmin[1] + j * step;
      for (let i = 0; i < nx; i++) field[idx(i, j, k)] = f(bmin[0] + i * step, y, z);
    }
  }
  const vmap = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const cidx = (i, j, k) => i + (nx - 1) * (j + (ny - 1) * k);
  const pos = [];
  const corners = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) {
      const v = field[idx(i + corners[c][0], j + corners[c][1], k + corners[c][2])];
      cv[c] = v; if (v < 0) mask |= 1 << c;
    }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      const va = cv[a], vb = cv[b];
      if ((va < 0) === (vb < 0)) continue;
      const t = va / (va - vb);
      sx += corners[a][0] + (corners[b][0] - corners[a][0]) * t;
      sy += corners[a][1] + (corners[b][1] - corners[a][1]) * t;
      sz += corners[a][2] + (corners[b][2] - corners[a][2]) * t;
      n++;
    }
    vmap[cidx(i, j, k)] = pos.length / 3;
    pos.push(bmin[0] + (i + sx / n) * step, bmin[1] + (j + sy / n) * step, bmin[2] + (k + sz / n) * step);
  }
  const ind = [];
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = field[idx(i, j, k)] < 0;
    // x-edge (i,j,k)-(i+1,j,k): quads from cells (i, j-1..j, k-1..k)
    if (i < nx - 1 && j > 0 && k > 0) {
      const v1 = field[idx(i + 1, j, k)] < 0;
      if (v0 !== v1) quad(cidx(i, j - 1, k - 1), cidx(i, j, k - 1), cidx(i, j, k), cidx(i, j - 1, k), v0);
    }
    if (j < ny - 1 && i > 0 && k > 0) {
      const v1 = field[idx(i, j + 1, k)] < 0;
      if (v0 !== v1) quad(cidx(i - 1, j, k - 1), cidx(i - 1, j, k), cidx(i, j, k), cidx(i, j, k - 1), v0);
    }
    if (k < nz - 1 && i > 0 && j > 0) {
      const v1 = field[idx(i, j, k + 1)] < 0;
      if (v0 !== v1) quad(cidx(i - 1, j - 1, k), cidx(i, j - 1, k), cidx(i, j, k), cidx(i - 1, j, k), v0);
    }
  }
  function quad(a, b, c, d, flip) {
    a = vmap[a]; b = vmap[b]; c = vmap[c]; d = vmap[d];
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) ind.push(a, b, c, a, c, d); else ind.push(a, c, b, a, d, c);
  }
  // project onto surface + gradient normals
  const e = step * 0.25;
  const nrm = new Float32Array(pos.length);
  const P = new Float32Array(pos);
  for (let v = 0; v < P.length; v += 3) {
    let x = P[v], y = P[v + 1], z = P[v + 2];
    for (let it = 0; it < 2; it++) {
      const d = f(x, y, z);
      let gx = f(x + e, y, z) - f(x - e, y, z), gy = f(x, y + e, z) - f(x, y - e, z), gz = f(x, y, z + e) - f(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
      const s = Math.max(-step, Math.min(step, d));
      x -= gx * s; y -= gy * s; z -= gz * s;
      nrm[v] = gx; nrm[v + 1] = gy; nrm[v + 2] = gz;
    }
    P[v] = x; P[v + 1] = y; P[v + 2] = z;
  }
  // make winding agree with the gradient normals
  for (let i = 0; i < ind.length; i += 3) {
    const a = ind[i] * 3, b = ind[i + 1] * 3, c = ind[i + 2] * 3;
    const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2];
    const vx = P[c] - P[a], vy = P[c + 1] - P[a + 1], vz = P[c + 2] - P[a + 2];
    const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
    const d = fx * (nrm[a] + nrm[b] + nrm[c]) + fy * (nrm[a + 1] + nrm[b + 1] + nrm[c + 1]) + fz * (nrm[a + 2] + nrm[b + 2] + nrm[c + 2]);
    if (d < 0) { const t = ind[i + 1]; ind[i + 1] = ind[i + 2]; ind[i + 2] = t; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(P, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setIndex(ind);
  if (paint) {
    const nv = P.length / 3;
    const col = new Float32Array(nv * 3), aux = new Float32Array(nv);
    for (let v = 0; v < nv; v++) {
      const c = paint(P[v * 3], P[v * 3 + 1], P[v * 3 + 2], nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]);
      col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2]; aux[v] = c[3] ?? 1;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setAttribute('aux', new THREE.BufferAttribute(aux, 1));
  }
  if (opts.smooth) laplacianSmoothNormals(g, opts.smooth);
  return g;
}

function laplacianSmoothNormals(g, iters) {
  const n = g.attributes.normal.array, ind = g.index.array, cnt = n.length / 3;
  for (let it = 0; it < iters; it++) {
    const acc = new Float32Array(n.length);
    for (let i = 0; i < ind.length; i += 3) {
      const a = ind[i], b = ind[i + 1], c = ind[i + 2];
      for (const [p, q] of [[a, b], [b, c], [c, a], [b, a], [c, b], [a, c]])
        for (let k = 0; k < 3; k++) acc[p * 3 + k] += n[q * 3 + k];
    }
    for (let v = 0; v < cnt; v++) {
      const x = n[v * 3] * 2 + acc[v * 3], y = n[v * 3 + 1] * 2 + acc[v * 3 + 1], z = n[v * 3 + 2] * 2 + acc[v * 3 + 2];
      const l = Math.hypot(x, y, z) || 1;
      n[v * 3] = x / l; n[v * 3 + 1] = y / l; n[v * 3 + 2] = z / l;
    }
  }
}

export const srgb = (hex) => {
  const c = new THREE.Color(hex); // three converts hex (sRGB) to linear working space
  return [c.r, c.g, c.b];
};
export const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
export const sstep = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// 2D signed distance to a triangle (IQ)
export function sdTri2(px, py, a, b, c) {
  const e0x = b[0] - a[0], e0y = b[1] - a[1], e1x = c[0] - b[0], e1y = c[1] - b[1], e2x = a[0] - c[0], e2y = a[1] - c[1];
  const v0x = px - a[0], v0y = py - a[1], v1x = px - b[0], v1y = py - b[1], v2x = px - c[0], v2y = py - c[1];
  const cl = (x) => Math.max(0, Math.min(1, x));
  const t0 = cl((v0x * e0x + v0y * e0y) / (e0x * e0x + e0y * e0y)), t1 = cl((v1x * e1x + v1y * e1y) / (e1x * e1x + e1y * e1y)), t2 = cl((v2x * e2x + v2y * e2y) / (e2x * e2x + e2y * e2y));
  const p0x = v0x - e0x * t0, p0y = v0y - e0y * t0, p1x = v1x - e1x * t1, p1y = v1y - e1y * t1, p2x = v2x - e2x * t2, p2y = v2y - e2y * t2;
  const sg = Math.sign(e0x * e2y - e0y * e2x);
  const d0 = [p0x * p0x + p0y * p0y, sg * (v0x * e0y - v0y * e0x)], d1 = [p1x * p1x + p1y * p1y, sg * (v1x * e1y - v1y * e1x)], d2 = [p2x * p2x + p2y * p2y, sg * (v2x * e2y - v2y * e2x)];
  const dd = Math.min(d0[0], d1[0], d2[0]), ss = Math.min(d0[1], d1[1], d2[1]);
  return -Math.sqrt(dd) * Math.sign(ss);
}
