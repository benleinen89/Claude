// Hand-rolled HDR post pipeline: MSAA scene -> (motion-blur accumulate) -> bokeh DOF
// -> bloom mip chain -> AgX tone map + grade + vignette + grain -> screen.
import * as THREE from 'three';

const FS_VERT = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;

function fsMat(frag, uniforms = {}, defines = {}) {
  return new THREE.ShaderMaterial({ vertexShader: FS_VERT, fragmentShader: frag, uniforms, defines, depthTest: false, depthWrite: false });
}

export class Post {
  constructor(renderer, W, H, { samples = 4 } = {}) {
    this.r = renderer; this.W = W; this.H = H;
    const hf = { type: THREE.HalfFloatType, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false };
    this.sceneRT = new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType, samples, depthBuffer: true });
    this.sceneRT.depthTexture = new THREE.DepthTexture(W, H, THREE.FloatType);
    this.accumRT = new THREE.WebGLRenderTarget(W, H, hf);
    const hw = Math.ceil(W / 2), hh = Math.ceil(H / 2);
    this.cocRT = new THREE.WebGLRenderTarget(hw, hh, hf);
    this.dofRT = new THREE.WebGLRenderTarget(hw, hh, hf);
    this.aoRT = new THREE.WebGLRenderTarget(hw, hh, { ...hf, type: THREE.UnsignedByteType });
    this.aoRT2 = new THREE.WebGLRenderTarget(hw, hh, { ...hf, type: THREE.UnsignedByteType });
    this.aoMat = fsMat(`uniform sampler2D tDepth; uniform mat4 projInv; uniform vec2 texel; uniform float radius, near, far, frame; uniform mat4 proj; varying vec2 vUv;
      vec3 vpos(vec2 uv){ float d = texture2D(tDepth, uv).x; vec4 p = projInv * vec4(uv * 2.0 - 1.0, d * 2.0 - 1.0, 1.0); return p.xyz / p.w; }
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      void main(){
        float d0 = texture2D(tDepth, vUv).x;
        if (d0 >= 0.99999) { gl_FragColor = vec4(1.0); return; }
        vec3 P = vpos(vUv);
        vec3 N = normalize(cross(vpos(vUv + vec2(texel.x, 0.0)) - P, vpos(vUv + vec2(0.0, texel.y)) - P));
        // screen radius for a world radius
        float sr = radius * proj[0][0] / max(-P.z, 0.01) * 0.5;
        float ang = h12(gl_FragCoord.xy) * 6.2832; float occ = 0.0;
        for (int i = 0; i < 12; i++) {
          float fi = (float(i) + 0.5) / 12.0;
          float a = ang + fi * 2.39996 * 12.0; float rr = sqrt(fi) * sr;
          vec2 uv = vUv + vec2(cos(a), sin(a)) * rr;
          vec3 S = vpos(uv); vec3 v = S - P; float vv = dot(v, v);
          occ += max(0.0, dot(N, v) - 0.015 * -P.z) / (vv + 0.02 * radius * radius) * smoothstep(radius * radius * 4.0, 0.0, vv);
        }
        float ao = clamp(1.0 - occ * radius * 0.35, 0.0, 1.0);
        gl_FragColor = vec4(vec3(ao), 1.0);
      }`, { tDepth: { value: null }, projInv: { value: new THREE.Matrix4() }, proj: { value: new THREE.Matrix4() }, texel: { value: new THREE.Vector2() }, radius: { value: 0.5 }, near: { value: 0.1 }, far: { value: 100 }, frame: { value: 0 } });
    this.aoBlurMat = fsMat(`uniform sampler2D tAO; uniform sampler2D tDepth; uniform vec2 texel; uniform vec2 dir; varying vec2 vUv;
      void main(){ float c = 0.0, w = 0.0; float d0 = texture2D(tDepth, vUv).x;
        for (int i = -3; i <= 3; i++) { vec2 uv = vUv + dir * texel * float(i) * 1.5; float d = texture2D(tDepth, uv).x; float k = exp(-float(i*i) * 0.15) * (1.0 / (1.0 + abs(d - d0) * 4000.0)); c += texture2D(tAO, uv).r * k; w += k; }
        gl_FragColor = vec4(vec3(c / w), 1.0); }`, { tAO: { value: null }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, dir: { value: new THREE.Vector2(1, 0) } });
    this.bloom = [];
    let w = hw, h = hh;
    for (let i = 0; i < 6; i++) { this.bloom.push(new THREE.WebGLRenderTarget(w, h, hf)); w = Math.max(1, w >> 1); h = Math.max(1, h >> 1); }
    this.bloomUp = this.bloom.map((rt) => new THREE.WebGLRenderTarget(rt.width, rt.height, hf));
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.qscene = new THREE.Scene(); this.qscene.add(this.quad);
    this.qcam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.quad.frustumCulled = false;

    this.copyMat = fsMat(`uniform sampler2D t; uniform float w; varying vec2 vUv; void main(){ gl_FragColor = vec4(texture2D(t, vUv).rgb * w, w); }`, { t: { value: null }, w: { value: 1 } });
    this.copyMat.blending = THREE.CustomBlending; this.copyMat.blendEquation = THREE.AddEquation;
    this.copyMat.blendSrc = THREE.OneFactor; this.copyMat.blendDst = THREE.OneFactor;

    const depthFns = `
      uniform sampler2D tDepth; uniform float near, far, focus, aperture, maxCoc;
      float linZ(vec2 uv){ float d = texture2D(tDepth, uv).x; float ndc = d * 2.0 - 1.0; return 2.0 * near * far / (far + near - ndc * (far - near)); }
      float cocAt(vec2 uv){ float z = linZ(uv); return clamp(aperture * (1.0 - focus / z), -maxCoc, maxCoc); }`;
    this.cocMat = fsMat(`uniform sampler2D tColor; uniform sampler2D tAO; uniform float aoStr; uniform vec2 texel; ${depthFns} varying vec2 vUv;
      void main(){
        vec3 c = vec3(0.0); float coc = 0.0;
        vec2 o = texel * 0.5;
        vec2 uvs[4]; uvs[0] = vUv + vec2(-o.x, -o.y); uvs[1] = vUv + vec2(o.x, -o.y); uvs[2] = vUv + vec2(-o.x, o.y); uvs[3] = vUv + vec2(o.x, o.y);
        float nearest = 1e9; float cn = 0.0;
        for (int i = 0; i < 4; i++) { c += texture2D(tColor, uvs[i]).rgb; float k = cocAt(uvs[i]); if (k < nearest) { nearest = k; } cn += k; }
        // prefer the nearer (more negative) CoC so foreground edges spread
        coc = min(cn * 0.25, nearest);
        gl_FragColor = vec4(c * 0.25 * mix(1.0, texture2D(tAO, vUv).r, aoStr), coc);
      }`, { tColor: { value: null }, tAO: { value: null }, aoStr: { value: 0 }, tDepth: { value: null }, texel: { value: new THREE.Vector2() }, near: { value: 0.1 }, far: { value: 100 }, focus: { value: 5 }, aperture: { value: 0 }, maxCoc: { value: 14 } });
    this.dofMat = fsMat(`uniform sampler2D tCoc; uniform vec2 texel; uniform float maxCoc; varying vec2 vUv;
      const float GA = 2.39996323;
      void main(){
        vec4 c0 = texture2D(tCoc, vUv);
        float cs = abs(c0.a);
        vec3 col = c0.rgb; float tot = 1.0; float nearCov = 0.0;
        float rad = RAD_SCALE;
        for (float ang = 0.0; ang < 400.0; ang += GA) {
          if (rad >= maxCoc) break;
          vec2 tc = vUv + vec2(cos(ang), sin(ang)) * texel * rad;
          vec4 s = texture2D(tCoc, tc);
          float ss = abs(s.a);
          if (s.a > c0.a) ss = clamp(ss, 0.0, cs * 2.0);   // farther samples cannot bleed over nearer pixels
          float m = smoothstep(rad - 0.5, rad + 0.5, ss);
          col += mix(col / tot, s.rgb, m); tot += 1.0;
          if (s.a < -0.5) nearCov = max(nearCov, smoothstep(rad - 0.5, rad + 0.5, -s.a) * smoothstep(0.5, 2.5, -s.a));
          rad += RAD_SCALE / rad;
        }
        gl_FragColor = vec4(col / tot, max(smoothstep(0.6, 2.2, cs), nearCov));
      }`, { tCoc: { value: null }, texel: { value: new THREE.Vector2() }, maxCoc: { value: 14 } }, { RAD_SCALE: '0.85' });

    this.downMat = fsMat(`uniform sampler2D t; uniform vec2 texel; uniform float karis; varying vec2 vUv;
      vec3 S(vec2 o){ return texture2D(t, vUv + o * texel).rgb; }
      float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main(){
        vec3 a = S(vec2(-2,2)), b = S(vec2(0,2)), c = S(vec2(2,2)), d = S(vec2(-2,0)), e = S(vec2(0,0)), f = S(vec2(2,0)),
             g = S(vec2(-2,-2)), h = S(vec2(0,-2)), i = S(vec2(2,-2)), j = S(vec2(-1,1)), k = S(vec2(1,1)), l = S(vec2(-1,-1)), m = S(vec2(1,-1));
        vec3 r;
        if (karis > 0.5) {
          vec3 g0 = (a+b+d+e)*0.25, g1 = (b+c+e+f)*0.25, g2 = (d+e+g+h)*0.25, g3 = (e+f+h+i)*0.25, g4 = (j+k+l+m)*0.25;
          float w0 = 1.0/(1.0+lum(g0)), w1 = 1.0/(1.0+lum(g1)), w2 = 1.0/(1.0+lum(g2)), w3 = 1.0/(1.0+lum(g3)), w4 = 1.0/(1.0+lum(g4));
          r = (g0*w0*0.125 + g1*w1*0.125 + g2*w2*0.125 + g3*w3*0.125 + g4*w4*0.5) / (w0*0.125 + w1*0.125 + w2*0.125 + w3*0.125 + w4*0.5);
        } else {
          r = e*0.125 + (a+c+g+i)*0.03125 + (b+d+f+h)*0.0625 + (j+k+l+m)*0.125;
        }
        gl_FragColor = vec4(max(r, 0.0), 1.0);
      }`, { t: { value: null }, texel: { value: new THREE.Vector2() }, karis: { value: 0 } });
    this.upMat = fsMat(`uniform sampler2D tLow; uniform sampler2D tHigh; uniform vec2 texel; uniform float radius; varying vec2 vUv;
      void main(){
        vec2 o = texel * radius;
        vec3 s = texture2D(tLow, vUv).rgb * 4.0;
        s += (texture2D(tLow, vUv + vec2(-o.x, 0)).rgb + texture2D(tLow, vUv + vec2(o.x, 0)).rgb + texture2D(tLow, vUv + vec2(0, -o.y)).rgb + texture2D(tLow, vUv + vec2(0, o.y)).rgb) * 2.0;
        s += texture2D(tLow, vUv + vec2(-o.x, -o.y)).rgb + texture2D(tLow, vUv + vec2(o.x, -o.y)).rgb + texture2D(tLow, vUv + vec2(-o.x, o.y)).rgb + texture2D(tLow, vUv + vec2(o.x, o.y)).rgb;
        gl_FragColor = vec4(texture2D(tHigh, vUv).rgb + s / 16.0, 1.0);
      }`, { tLow: { value: null }, tHigh: { value: null }, texel: { value: new THREE.Vector2() }, radius: { value: 1 } });

    this.finalMat = fsMat(`
      uniform sampler2D tColor, tDof, tBloom, tDepth, tAO, tStreak; uniform float aoStr, streak;
      uniform float useDof, bloomStr, exposure, vignette, grain, ca, sat, contrast, frame, fadeAmt, letterbox, near, far, focus, aperture, maxCoc, toneMode;
      uniform vec3 lift, gamma, gain, fadeCol, tintShadow, tintHigh;
      uniform vec2 res;
      varying vec2 vUv;
      ${depthFns.replace('uniform sampler2D tDepth; uniform float near, far, focus, aperture, maxCoc;', '')}
      // AgX (Troy Sobotka / three.js implementation)
      vec3 agxDefaultContrastApprox(vec3 x){ vec3 x2 = x*x; vec3 x4 = x2*x2; return + 15.5*x4*x2 - 40.14*x4*x + 31.96*x4 - 6.868*x2*x + 0.4298*x2 + 0.1191*x - 0.00232; }
      vec3 AgX(vec3 color){
        const mat3 AgXInsetMatrix = mat3(vec3(0.856627153315983, 0.137318972929847, 0.11189821299995), vec3(0.0951212405381588, 0.761241990602591, 0.0767994186031903), vec3(0.0482516061458583, 0.101439036467562, 0.811302368396859));
        const mat3 AgXOutsetMatrix = mat3(vec3(1.1271005818144368, -0.1413297634984383, -0.14132976349843826), vec3(-0.11060664309660323, 1.157823702216272, -0.11060664309660294), vec3(-0.016493938717834573, -0.016493938717834257, 1.2519364065950405));
        const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(vec3(1.6605, -0.1246, -0.0182), vec3(-0.5876, 1.1329, -0.1006), vec3(-0.0728, -0.0083, 1.1187));
        const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(vec3(0.6274, 0.0691, 0.0164), vec3(0.3293, 0.9195, 0.0880), vec3(0.0433, 0.0113, 0.8956));
        const float AgxMinEv = -12.47393; const float AgxMaxEv = 4.026069;
        color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
        color = AgXInsetMatrix * color;
        color = max(color, 1e-10);
        color = log2(color); color = (color - AgxMinEv) / (AgxMaxEv - AgxMinEv); color = clamp(color, 0.0, 1.0);
        color = agxDefaultContrastApprox(color);
        color = AgXOutsetMatrix * color;
        color = pow(max(vec3(0.0), color), vec3(2.2));
        color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
        return clamp(color, 0.0, 1.0);
      }
      vec3 Neutral(vec3 color){
        const float S0 = 0.76; const float Desat = 0.15;
        float x = min(color.r, min(color.g, color.b)); float off = x < 0.08 ? x - 6.25 * x * x : 0.04; color -= off;
        float peak = max(color.r, max(color.g, color.b)); if (peak < S0) return color;
        float d = 1.0 - S0; float np = 1.0 - d * d / (peak + d - S0); color *= np / peak;
        float g = 1.0 - 1.0 / (Desat * (peak - np) + 1.0); return mix(color, vec3(np), g);
      }
      vec3 ACES(vec3 c){ c *= 0.6; return clamp((c*(2.51*c+0.03))/(c*(2.43*c+0.59)+0.14), 0.0, 1.0); }
      float h12(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * .1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
      vec3 toSRGB(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
      void main(){
        vec2 uv = vUv; vec2 d = uv - 0.5;
        vec3 col;
        if (ca > 0.0) {
          vec2 o = d * ca * 0.01;
          col = vec3(texture2D(tColor, uv - o).r, texture2D(tColor, uv).g, texture2D(tColor, uv + o).b);
        } else col = texture2D(tColor, uv).rgb;
        col *= mix(1.0, texture2D(tAO, uv).r, aoStr);
        if (useDof > 0.5) {
          vec4 dz = texture2D(tDof, uv);
          float k = max(smoothstep(0.6, 2.2, abs(cocAt(uv))), dz.a);
          col = mix(col, dz.rgb, k);
        }
        col += texture2D(tBloom, uv).rgb * bloomStr;
        if (streak > 0.0) { vec3 st = vec3(0.0); for (int k = -12; k <= 12; k++) { float fk = float(k); st += texture2D(tStreak, uv + vec2(fk * 0.012, 0.0)).rgb * exp(-abs(fk) * 0.22); }
          st /= 9.1; st = max(st - 1.5, 0.0); col += st * vec3(0.55, 0.75, 1.0) * streak * 0.5; }
        col *= exposure;
        col = toneMode > 1.5 ? clamp(Neutral(col), 0.0, 1.0) : toneMode > 0.5 ? ACES(col) : AgX(col);
        // grade (display-ish space)
        col = toSRGB(col);
        float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
        col = mix(vec3(l), col, sat);
        col = (col - 0.5) * contrast + 0.5;
        col = mix(col * tintShadow, col * tintHigh, smoothstep(0.0, 1.0, l));
        col = pow(max(col * gain + lift * (1.0 - col), 0.0), 1.0 / gamma);
        float v = smoothstep(0.85, 0.2, length(d * vec2(res.x / res.y, 1.0)) * 0.9);
        col *= mix(1.0, v, vignette);
        col += (h12(gl_FragCoord.xy + frame * 37.0) - 0.5) * grain;
        col = mix(col, fadeCol, fadeAmt);
        if (letterbox > 0.0 && abs(d.y) > 0.5 - letterbox) col = vec3(0.0);
        gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      }`, {
      tColor: { value: null }, tDof: { value: null }, tBloom: { value: null }, tDepth: { value: null }, tAO: { value: null }, aoStr: { value: 0 }, tStreak: { value: null }, streak: { value: 0 }, useDof: { value: 0 }, bloomStr: { value: 0.05 },
      exposure: { value: 1 }, vignette: { value: 0.35 }, grain: { value: 0.02 }, ca: { value: 0.3 }, sat: { value: 1.05 }, contrast: { value: 1.05 }, frame: { value: 0 },
      fadeAmt: { value: 0 }, letterbox: { value: 0 }, lift: { value: new THREE.Vector3(0, 0, 0) }, gamma: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
      fadeCol: { value: new THREE.Vector3(0, 0, 0) }, tintShadow: { value: new THREE.Vector3(1, 1, 1) }, tintHigh: { value: new THREE.Vector3(1, 1, 1) }, res: { value: new THREE.Vector2(W, H) },
      near: { value: 0.1 }, far: { value: 100 }, focus: { value: 5 }, aperture: { value: 0 }, maxCoc: { value: 14 }, toneMode: { value: 0 },
    });
  }

  pass(mat, target) {
    this.quad.material = mat;
    this.r.setRenderTarget(target);
    this.r.render(this.qscene, this.qcam);
  }

  // drawScene(subIndex, subCount) must set up scene/camera for that sub-time and return {scene, camera}
  render(drawScene, P = {}) {
    const r = this.r;
    const subs = Math.max(1, P.subframes || 1);
    let sc, cam;
    let colorTex;
    if (subs === 1) {
      ({ scene: sc, camera: cam } = drawScene(0, 1));
      r.setRenderTarget(this.sceneRT); r.clear(); r.render(sc, cam);
      colorTex = this.sceneRT.texture;
    } else {
      r.setRenderTarget(this.accumRT); r.setClearColor(0x000000, 0); r.clear();
      const mid = Math.floor(subs / 2), order = [];
      for (let i = 0; i < subs; i++) if (i !== mid) order.push(i);
      order.push(mid); // centre sample last so the depth buffer matches it
      for (const idx of order) {
        ({ scene: sc, camera: cam } = drawScene(idx, subs));
        r.setRenderTarget(this.sceneRT); r.clear(); r.render(sc, cam);
        this.copyMat.uniforms.t.value = this.sceneRT.texture; this.copyMat.uniforms.w.value = 1 / subs;
        this.pass(this.copyMat, this.accumRT);
      }
      colorTex = this.accumRT.texture;
    }
    const near = cam.near, far = cam.far;
    const F = this.finalMat.uniforms;
    const useAO = (P.ao || 0) > 0;
    if (useAO) {
      const au = this.aoMat.uniforms;
      au.tDepth.value = this.sceneRT.depthTexture; au.projInv.value.copy(cam.projectionMatrixInverse); au.proj.value.copy(cam.projectionMatrix);
      au.texel.value.set(1 / this.cocRT.width, 1 / this.cocRT.height); au.radius.value = P.aoRadius ?? 0.5;
      this.pass(this.aoMat, this.aoRT);
      const bu = this.aoBlurMat.uniforms; bu.tDepth.value = this.sceneRT.depthTexture; bu.texel.value.set(1 / this.aoRT.width, 1 / this.aoRT.height);
      bu.tAO.value = this.aoRT.texture; bu.dir.value.set(1, 0); this.pass(this.aoBlurMat, this.aoRT2);
      bu.tAO.value = this.aoRT2.texture; bu.dir.value.set(0, 1); this.pass(this.aoBlurMat, this.aoRT);
    }
    F.tAO.value = this.aoRT.texture; F.aoStr.value = useAO ? P.ao : 0;
    this.cocMat.uniforms.tAO.value = this.aoRT.texture; this.cocMat.uniforms.aoStr.value = useAO ? P.ao : 0;
    const useDof = (P.aperture || 0) > 0.01;
    const hw = this.cocRT.width, hh = this.cocRT.height;
    if (useDof) {
      const cu = this.cocMat.uniforms;
      cu.tColor.value = colorTex; cu.tDepth.value = this.sceneRT.depthTexture; cu.texel.value.set(1 / this.W, 1 / this.H);
      cu.near.value = near; cu.far.value = far; cu.focus.value = P.focus ?? 5; cu.aperture.value = P.aperture; cu.maxCoc.value = P.maxCoc ?? 12;
      this.pass(this.cocMat, this.cocRT);
      const du = this.dofMat.uniforms;
      du.tCoc.value = this.cocRT.texture; du.texel.value.set(1 / hw, 1 / hh); du.maxCoc.value = P.maxCoc ?? 12;
      this.pass(this.dofMat, this.dofRT);
    }
    // bloom chain
    const bs = P.bloom ?? 0.05;
    if (bs > 0) {
      let src = useDof ? this.dofRT.texture : colorTex;
      for (let i = 0; i < this.bloom.length; i++) {
        const dm = this.downMat.uniforms;
        dm.t.value = i === 0 ? colorTex : this.bloom[i - 1].texture;
        const sw = i === 0 ? this.W : this.bloom[i - 1].width, shh = i === 0 ? this.H : this.bloom[i - 1].height;
        dm.texel.value.set(1 / sw, 1 / shh); dm.karis.value = i === 0 ? 1 : 0;
        this.pass(this.downMat, this.bloom[i]);
      }
      // upsample: bloomUp[n-1] = bloom[n-1]; bloomUp[i] = bloom[i] + up(bloomUp[i+1])
      const n = this.bloom.length;
      for (let i = n - 2; i >= 0; i--) {
        const um = this.upMat.uniforms;
        um.tLow.value = i === n - 2 ? this.bloom[n - 1].texture : this.bloomUp[i + 1].texture;
        um.tHigh.value = this.bloom[i].texture;
        um.texel.value.set(1 / this.bloom[i].width, 1 / this.bloom[i].height); um.radius.value = P.bloomRadius ?? 1.0;
        this.pass(this.upMat, this.bloomUp[i]);
      }
      F.tBloom.value = this.bloomUp[0].texture; F.tStreak.value = this.bloom[2].texture;
    }
    F.tColor.value = colorTex; F.tDof.value = this.dofRT.texture; F.tDepth.value = this.sceneRT.depthTexture;
    F.useDof.value = useDof ? 1 : 0; F.bloomStr.value = bs > 0 ? bs / 6 : 0;
    F.near.value = near; F.far.value = far; F.focus.value = P.focus ?? 5; F.aperture.value = (P.aperture || 0) * 2; F.maxCoc.value = (P.maxCoc ?? 12) * 2;
    F.exposure.value = P.exposure ?? 1; F.vignette.value = P.vignette ?? 0.35; F.grain.value = P.grain ?? 0.018; F.ca.value = P.ca ?? 0.25;
    F.sat.value = P.sat ?? 1.05; F.contrast.value = P.contrast ?? 1.04; F.frame.value = P.frame ?? 0;
    F.fadeAmt.value = P.fade ?? 0; F.fadeCol.value.fromArray(P.fadeCol ?? [0, 0, 0]);
    F.lift.value.fromArray(P.lift ?? [0, 0, 0]); F.gamma.value.fromArray(P.gamma ?? [1, 1, 1]); F.gain.value.fromArray(P.gain ?? [1, 1, 1]);
    F.tintShadow.value.fromArray(P.tintShadow ?? [1, 1, 1]); F.tintHigh.value.fromArray(P.tintHigh ?? [1, 1, 1]);
    F.letterbox.value = P.letterbox ?? 0; F.streak.value = bs > 0 ? (P.streak ?? 1) : 0; F.toneMode.value = P.tone === 'aces' ? 1 : P.tone === 'agx' ? 0 : 2;
    this.pass(this.finalMat, null);
  }
}
