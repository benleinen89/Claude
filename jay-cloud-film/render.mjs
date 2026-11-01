// Usage:
//  node render.mjs still  --t 0,1.5 --w 1280 --h 720 [--shot name] [--out dir]
//  node render.mjs video  --from 0 --to 8 --fps 24 --w 1920 --h 1080 --out out.mp4 [--shot name]
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const args = process.argv.slice(2);
const mode = args[0];
const opt = {};
for (let i = 1; i < args.length; i += 2) opt[args[i].replace(/^--/, '')] = args[i + 1];
const W = +(opt.w || 1280), H = +(opt.h || 720), FPS = +(opt.fps || 24);
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.hdr': 'application/octet-stream', '.png': 'image/png', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--js-flags=--max-old-space-size=8192'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[page]', m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
const q = new URLSearchParams({ w: W, h: H, msaa: opt.msaa ?? 4, shells: opt.shells ?? 20, q: opt.q ?? 1 });
if (opt.shot) q.set('shot', opt.shot);
if (opt.cam) q.set('cam', opt.cam);
if (opt.dbgcam) q.set('dbgcam', opt.dbgcam);
if (opt.hide) q.set('hide', opt.hide);
if (opt.nojay) q.set('nojay', '1');
if (opt.gjay) q.set('gjay', '1');
await page.goto(`http://localhost:${port}/index.html?${q}`);
const t0 = Date.now();
const info = await page.evaluate(() => window.__ready);
console.log('ready in', ((Date.now() - t0) / 1000).toFixed(1), 's', JSON.stringify(info));
const offset = opt.shot ? info.shots[0][1] : 0;

function ff(argsOut) { return spawn('ffmpeg', ['-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-', '-vf', 'vflip', ...argsOut], { stdio: ['pipe', 'inherit', 'inherit'] }); }
async function frame(t) {
  await page.evaluate(([t, fps]) => window.__render(t, fps), [t, FPS]);
  const b64 = await page.evaluate(() => window.__grab());
  return Buffer.from(b64, 'base64');
}
if (mode === 'still') {
  const out = opt.out || 'out/stills';
  fs.mkdirSync(out, { recursive: true });
  for (const ts of (opt.t || '0').split(',')) {
    const t = +ts + offset;
    const a = Date.now();
    const buf = await frame(t);
    const p = ff([path.join(out, `${opt.prefix || opt.shot || 'f'}_${(+ts).toFixed(2)}.png`)]);
    p.stdin.end(buf); await new Promise((r) => p.on('close', r));
    console.log('still', ts, ((Date.now() - a) / 1000).toFixed(2), 's');
  }
} else if (mode === 'video') {
  const shotDur = opt.shot ? info.shots[0][2] - info.shots[0][1] : info.duration;
  const from = +(opt.from || 0), to = +(opt.to || shotDur);
  const n = Math.round((to - from) * FPS);
  const p = ff(['-c:v', 'libx264', '-preset', 'slow', '-crf', String(opt.crf || 12), '-pix_fmt', 'yuv420p', '-tune', 'film', opt.out || 'out/out.mp4']);
  const a = Date.now();
  for (let i = 0; i < n; i++) {
    const t = from + offset + i / FPS;
    const buf = await frame(t);
    if (!p.stdin.write(buf)) await new Promise((r) => p.stdin.once('drain', r));
    if (i % 24 === 0) console.log(`frame ${i}/${n}  ${(((Date.now() - a) / 1000) / (i + 1)).toFixed(2)} s/f`);
  }
  p.stdin.end(); await new Promise((r) => p.on('close', r));
  console.log('done', ((Date.now() - a) / 1000).toFixed(1), 's');
}
await browser.close(); server.close();
