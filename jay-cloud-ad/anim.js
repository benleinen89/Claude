// Deterministic timeline: render(t) fully sets the frame for time t (seconds).
const $ = (id) => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const prog = (t, a, b) => clamp((t - a) / (b - a));
const eo = (x) => 1 - Math.pow(1 - x, 3);
const eio = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const back = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
const css = (el, o) => Object.assign(el.style, o);

// fade+rise in at `a`, optional fade out at `z`
function fadeUp(el, t, a, d = 0.5, dist = 36, z = null, extra = '') {
  const p = eo(prog(t, a, a + d));
  let o = p;
  if (z !== null) o *= 1 - prog(t, z, z + 0.25);
  css(el, { opacity: o, transform: `translateY(${(1 - p) * dist}px) ${extra}` });
}

const SCENES = [['s1', 0, 2.4], ['s2', 2.4, 5.6], ['s3', 5.6, 10.0], ['s4', 10.0, 13.0],
  ['s5', 13.0, 15.0], ['s6', 15.0, 23.0], ['s7', 23.0, 27.0], ['s8', 27.0, 30.0]];

// ---------- build dynamic content ----------
const bldg = $('bldg');
css(bldg, { background: '#111A2E', borderRadius: '18px 18px 0 0', border: '3px solid #24314F' });
const WINS = [];
for (let r = 0; r < 6; r++) for (let c = 0; c < 7; c++) {
  const w = document.createElement('div'); w.className = 'win';
  css(w, { left: 40 + c * 92 + 'px', top: 50 + r * 82 + 'px' });
  bldg.appendChild(w); WINS.push(w);
}
const QM = [[1, 0.7], [9, 0.95], [17, 1.2], [26, 1.45], [33, 1.7], [12, 1.95], [38, 2.2]].map(([i, at]) => {
  const q = document.createElement('div'); q.className = 'qm'; q.textContent = '?';
  const w = WINS[i]; css(q, { left: parseInt(w.style.left) + 22 + 'px', top: parseInt(w.style.top) - 8 + 'px' });
  bldg.appendChild(q); return [q, at, i];
});
const ROWS = [['A. Brooks', 'Assembly'], ['T. Nguyen', 'Maintenance'], ['R. Silva', 'Shipping'], ['K. Moore', 'QA'],
  ['J. Ross', 'Warehouse'], ['P. Shah', 'Line 2'], ['E. Walsh', 'Office']];
const MARKS = { 1: ['?', 1.7, false], 3: ['off today?', 1.45, true], 4: ['left Friday', 1.2, true], 5: ['?', 1.95, false] };
const rowEls = ROWS.map(([n, d], i) => {
  const r = document.createElement('div'); r.className = 'row';
  r.innerHTML = `<span>${n} <span style="color:#9CA3AF">· ${d}</span></span><span class="mark">${MARKS[i] ? MARKS[i][0] : ''}</span><div class="strike"></div>`;
  $('rows').appendChild(r); return r;
});

// ---------- per-scene renderers (lt = local time) ----------
function s1(lt) {
  const ph = (lt % 0.6) / 0.3;
  const flash = lt < 2.3 ? Math.pow(clamp(1 - ph), 1.5) * 0.95 : 0;
  css($('strobe'), { opacity: flash });
  const sh = flash * 6;
  css($('s1'), { transform: `translate(${Math.sin(lt * 97) * sh}px,${Math.cos(lt * 71) * sh}px)` });
  const ip = back(prog(lt, 0.0, 0.35));
  css($('s1icon'), { opacity: prog(lt, 0, 0.15), transform: `scale(${0.4 + 0.6 * ip})` });
  const a = prog(lt, 0.15, 0.4), b = prog(lt, 0.6, 0.85);
  css($('s1time'), { opacity: a, transform: `scale(${1.5 - 0.5 * eo(a)})` });
  css($('s1label'), { opacity: b, transform: `scale(${1.5 - 0.5 * eo(b)})` });
}
function s2(lt) {
  fadeUp($('s2q'), lt, 0.05, 0.5, 50);
  css(bldg, { transform: `scale(${1 + 0.06 * eio(prog(lt, 0, 3.2))})`, transformOrigin: '50% 100%', opacity: prog(lt, 0, 0.3) });
  WINS.forEach((w, i) => {
    const lit = (Math.sin(i * 12.9898 + Math.floor(lt * 6) * 0.7) * 43758.5453) % 1;
    w.style.background = Math.abs(lit) > 0.55 ? '#F4D58D' : '#1E2A44';
  });
  QM.forEach(([q, at]) => { const p = prog(lt, at, at + 0.3); css(q, { opacity: p, transform: `scale(${0.3 + 0.7 * back(p)})` }); });
}
function s3(lt) {
  fadeUp($('s3a'), lt, 0.05, 0.5, 40);
  const p = eo(prog(lt, 0.1, 0.8));
  css($('paper'), { opacity: p, transform: `translateY(${(1 - p) * 120}px) rotate(${-4 + 2 * p}deg) scale(${1 + 0.04 * prog(lt, 0.8, 4.4)})` });
  rowEls.forEach((r, i) => {
    const m = MARKS[i]; if (!m) return;
    const [_, at, strike] = m; const q = prog(lt, at, at + 0.3);
    css(r.querySelector('.mark'), { opacity: q, transform: `scale(${0.5 + 0.5 * back(q)})` });
    if (strike) r.querySelector('.strike').style.width = eo(q) * 62 + '%';
  });
  fadeUp($('s3b'), lt, 2.3, 0.5, 30);
}
function s4(lt) {
  fadeUp($('s4h'), lt, 0.0, 0.4, 30);
  [['c1', 0.25], ['c2', 0.75], ['c3', 1.25]].forEach(([id, at]) => {
    const p = eo(prog(lt, at, at + 0.35));
    css($(id), { opacity: p, transform: `translateX(${(1 - p) * -140}px)` });
  });
  const alarm = lt > 2.0;
  const pulse = alarm ? 0.5 + 0.5 * Math.sin((lt - 2.0) * 18) : 0;
  css($('c3'), { borderColor: alarm ? `rgba(229,56,59,${0.5 + 0.5 * pulse})` : '#24314F', boxShadow: alarm ? `0 0 ${30 * pulse}px rgba(229,56,59,.6)` : 'none' });
  $('c3s').style.color = alarm ? '#FCA5A5' : '#9AA6BD';
}
function s5(lt) {
  const w = eio(prog(lt, 0, 0.6));
  css($('wipe'), { transform: `translate(-50%,-50%) scale(${w * 240})` });
  const l = eo(prog(lt, 0.35, 0.85));
  css($('s5logo'), { opacity: l, transform: `scale(${0.85 + 0.15 * l})` });
  fadeUp($('s5tag'), lt, 0.8, 0.5, 30);
}
const CAPS = ['Hired in HR → <b>access on day one.</b>', 'Leaves HR → <b>access revoked in real time.</b>', 'Visitor checks in → <b>counted on site.</b>'];
function s6(lt) {
  fadeUp($('s6title'), lt, 0.0, 0.4, 20);
  const pin = eo(prog(lt, 0.0, 0.5));
  css($('hr'), { opacity: pin, transform: `translateX(${(1 - pin) * -60}px)` });
  css($('dev'), { opacity: pin, transform: `translateX(${(1 - pin) * 60}px)` });
  css($('hub'), { opacity: pin });
  const beats = [0.4, 3.0, 5.6];
  let k = 0; beats.forEach((b, i) => { if (lt >= b) k = i; });
  const b = beats[k], bt = lt - b;
  ['e1', 'e2', 'e3'].forEach((id, i) => fadeUp($(id), i === k ? lt : -9, b, 0.35, 30, i < 2 ? b + 2.35 : null));
  $('hr').querySelector('.lbl').textContent = k === 2 ? 'Reception kiosk' : 'Your HR system';
  css($('hr').querySelector('.chips'), { opacity: k === 2 ? 0 : 1 });
  // pulse travel
  const tp = prog(bt, 0.45, 0.95);
  css($('pulse'), { opacity: tp > 0 && tp < 1 ? 1 : 0, left: 448 + tp * 150 + 'px' });
  const glow = Math.max(0, 1 - Math.abs(bt - 0.7) / 0.35);
  css($('hub'), { boxShadow: `0 0 0 ${glow * 26}px rgba(47,111,223,${0.25 * glow})`, transform: `scale(${1 + 0.08 * glow})` });
  // device result
  const on = bt > 0.95, r = eo(prog(bt, 0.95, 1.25));
  const reader = [$('reader'), $('rdText'), $('rdSub')];
  if (k < 2) {
    reader.forEach((e) => (e.style.opacity = 1)); css($('vlist'), { opacity: 0 });
    const col = k === 0 ? '#16A34A' : '#E5383B';
    $('led').style.background = on ? col : '#4B5563';
    css($('rdIcon'), { background: on ? col : '#374151', transform: `scale(${on ? 0.8 + 0.2 * back(r) : 1})` });
    $('rdIcon').textContent = on ? (k === 0 ? '✓' : '✕') : '·';
    $('rdText').textContent = on ? (k === 0 ? 'Access granted' : 'Access revoked') : 'Badge reader';
    $('rdText').style.color = on ? col : '#6B7280';
    $('rdSub').textContent = on ? (k === 0 ? 'Maria Chen · Day 1' : 'J. Ross · all doors') : 'Main gate';
  } else {
    const f = eo(prog(bt, 0.1, 0.5));
    reader.forEach((e) => (e.style.opacity = 1 - f)); css($('vlist'), { opacity: f });
    $('onsite').textContent = on ? '412' : '411';
    css($('onsite'), { transform: `scale(${on ? 0.85 + 0.15 * back(r) : 1})` });
    css($('vlist').querySelector('.vrow'), { opacity: r, transform: `translateY(${(1 - r) * 20}px)` });
  }
  const cap = $('s6cap'); cap.innerHTML = CAPS[k];
  fadeUp(cap, bt, 0.25, 0.4, 24, k < 2 ? 2.35 : null);
}
function s7(lt) {
  const p = eo(prog(lt, 0, 0.5));
  css($('tab'), { opacity: p, transform: `translateY(${(1 - p) * 70}px)` });
  css($('scr').querySelector('.live'), { opacity: 0.55 + 0.45 * Math.abs(Math.cos(lt * 4)) });
  const safe = Math.round(409 * eo(prog(lt, 0.45, 2.1)));
  $('safe').textContent = safe; $('miss').textContent = 412 - safe;
  [['m1', 2.1], ['m2', 2.3], ['m3', 2.5]].forEach(([id, at]) => {
    const q = eo(prog(lt, at, at + 0.3)); css($(id), { opacity: q, transform: `translateX(${(1 - q) * 40}px)` });
  });
  fadeUp($('s7cap'), lt, 0.5, 0.5, 30);
}
function s8(lt) {
  const l = eo(prog(lt, 0, 0.5));
  css($('s8logo'), { opacity: l, transform: `scale(${0.9 + 0.1 * l})` });
  fadeUp($('s8line'), lt, 0.25, 0.5, 30);
  fadeUp($('s8mods'), lt, 0.6, 0.4, 20);
  fadeUp($('s8hr'), lt, 0.75, 0.4, 20);
  const c = prog(lt, 0.95, 1.35), pulse = lt > 1.8 ? 0.03 * Math.sin((lt - 1.8) * 6) : 0;
  css($('cta'), { opacity: c, transform: `scale(${(0.6 + 0.4 * back(c)) + pulse})` });
  fadeUp($('s8by'), lt, 1.2, 0.4, 16);
}
const R = { s1, s2, s3, s4, s5, s6, s7, s8 };

window.render = function (t) {
  SCENES.forEach(([id, a, b]) => {
    const el = $(id);
    const fade = id === 's1' ? 0 : 0.12;
    const o = Math.min(fade ? prog(t, a, a + fade) : (t >= a ? 1 : 0), t < b ? 1 : 0);
    el.style.opacity = o;
    el.style.display = o > 0 ? 'block' : 'none';
    if (o > 0) R[id](t - a);
  });
  const bug = (t > 0.3 && t < 12.95) || (t > 23.2 && t < 26.95);
  $('bug').style.opacity = bug ? 0.9 : 0;
};
window.render(0);
