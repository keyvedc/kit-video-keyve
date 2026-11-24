#!/usr/bin/env node
// Kit de vídeo Keyve — renderizador.
//
//   node engine/render.mjs videos/<slug> --beats          1 frame por batida → out/beats.png (revisão)
//   node engine/render.mjs videos/<slug> --frame 7.25     um frame → out/frame-7.25.png
//   node engine/render.mjs videos/<slug> --audio          só a trilha → out/audio.wav
//   node engine/render.mjs videos/<slug> --estimar        tempo aproximado de exportação em cada qualidade (não renderiza)
//   node engine/render.mjs videos/<slug> --preview        30 fps, sem subframes, 540x960 → out/preview.mp4
//   node engine/render.mjs videos/<slug> --final          PADRÃO rápido: 1 captura/frame, JPEG, x264 veryfast + áudio → out/final.mp4
//   node engine/render.mjs videos/<slug> --final --max    máximo: subframes do vídeo com tmix, PNG, x264 medium CRF 15 → out/final-max.mp4
//   node engine/render.mjs videos/<slug> --final --media  qualidade média: 2 subframes, JPEG, x264 medium CRF 18
//   opções: --workers 4   --from 0 --to 15 (recorte em segundos, só preview/final)
//           --beats --at 1,2.5,7 (tempos exatos)  --step 1 (amostra a cada s)  --cols 6  --keep
//           --query "marca=cliente" (parâmetros para a página, ex.: teste de marca)

import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const dirArg = args.find((a) => !a.startsWith('--'));
if (!dirArg) { console.error('uso: node engine/render.mjs videos/<slug> --beats|--frame t|--audio|--preview|--final'); process.exit(1); }
const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
for (const bin of ['ffmpeg', 'ffprobe']) {
  if (spawnSync(bin, ['-version']).status !== 0) { console.error(`✗ ${bin} não encontrado. Instale o ffmpeg (macOS: brew install ffmpeg · Windows: winget install ffmpeg · Linux: apt install ffmpeg).`); process.exit(1); }
}
const VDIR = path.resolve(process.cwd(), dirArg);
if (!fs.existsSync(path.join(VDIR, 'scene.html'))) { console.error('✗ não achei', path.join(VDIR, 'scene.html')); process.exit(1); }
const OUT = path.join(VDIR, 'out');
fs.mkdirSync(OUT, { recursive: true });
const rel = path.relative(ROOT, path.join(VDIR, 'scene.html')).split(path.sep).join('/');

// ---------- servidor estático (módulos ES não carregam via file://) ----------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.wav': 'audio/wav', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream' });
  fs.createReadStream(p).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const URL_ = `http://127.0.0.1:${server.address().port}/${rel}` + (opt('query') ? '?' + opt('query') : '');

// Um processo de Chromium por worker: várias abas no mesmo navegador disputam o compositor e travam screenshots.
const LAUNCH = { args: ['--font-render-hinting=none', '--disable-lcd-text', '--force-color-profile=srgb', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] };
const browsers = [];
const browser = { close: () => Promise.all(browsers.map((b) => b.isConnected() && b.close())) };
async function openPage() {
  const b = await chromium.launch(LAUNCH); browsers.push(b);
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  page.setDefaultTimeout(180000);
  page.on('pageerror', (e) => console.error('[página]', e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !m.text().startsWith('Failed to load resource')) console.error('[console]', m.text()); });
  // arquivo faltando: mostra qual (info.json de filmagem é opcional — sem ele a cena usa o placeholder)
  page.on('response', (r) => { if (r.status() >= 400 && !r.url().endsWith('/info.json')) console.error(`[${r.status()}] arquivo não encontrado: ${decodeURIComponent(new URL(r.url()).pathname)}`); });
  await page.goto(URL_);
  await page.waitForFunction(() => window.ready !== undefined);
  await page.evaluate(() => window.ready);
  const meta = await page.evaluate(() => window.VIDEO);
  CAPTURE = opt('max') ? (meta.capture || 'png') : 'jpeg';
  await page.setViewportSize({ width: meta.W, height: meta.H });
  return { page, meta };
}
// captura: PNG (sem perda, padrão) ou JPEG q95 (vídeos longos com filmagem: ~3× mais rápido)
// tempo-limite de 45 s por frame: se o navegador travar, lança erro e o worker reabre (antes podia esperar para sempre)
let CAPTURE = 'jpeg';
// o timer é cancelado quando o frame termina (antes ficava pendente e segurava o processo ~45 s no fim de todo render)
const withTimeout = (p, ms, what) => {
  let timer;
  const limite = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error(`tempo-limite em ${what}`)), ms); });
  return Promise.race([p, limite]).finally(() => clearTimeout(timer));
};
const shot = (page, t) => withTimeout(
  page.evaluate((t) => window.seek(t), t).then(() => page.screenshot(CAPTURE === 'jpeg' ? { type: 'jpeg', quality: 95, caret: 'hide' } : { type: 'png', animations: 'disabled', caret: 'hide' })),
  45000, `seek(${t.toFixed(3)})`);

function ff(argv, input) {
  return new Promise((res, rej) => {
    const p = spawn('ffmpeg', ['-v', 'error', '-y', ...argv], { stdio: [input ? 'pipe' : 'ignore', 'inherit', 'inherit'] });
    p.on('close', (c) => (c === 0 ? res() : rej(new Error('ffmpeg saiu com ' + c))));
    // erro no produtor de frames encerra o ffmpeg e rejeita (antes ficava sem tratamento)
    if (input) Promise.resolve().then(() => input(p.stdin)).catch((e) => { p.kill('SIGKILL'); rej(e); });
  });
}
const FASTMODE = () => !!opt('fast') || (!opt('media') && !opt('max'));
const write = (stream, buf) => new Promise((r) => (stream.write(buf) ? r() : stream.once('drain', r)));

async function renderAudio(page) {
  const b64 = await page.evaluate(() => window.renderAudio());
  const meta = await page.evaluate(() => window.VIDEO);
  const f = path.join(OUT, 'audio.wav');
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  if (!meta.voice) { console.log('✓ áudio', path.relative(ROOT, f)); return f; }
  // vídeo falado: voz (limpa) + trilha/sfx com ducking pela voz, normalizado para redes (-14 LUFS)
  const v = meta.voice, bed = path.join(OUT, 'bed.wav');
  fs.renameSync(f, bed);
  const voiceFile = path.resolve(VDIR, v.file);
  const trim = v.offset > 0 ? `atrim=start=${v.offset},asetpts=PTS-STARTPTS,` : '';
  const pad = v.offset < 0 ? `adelay=${Math.round(-v.offset * 1000)}:all=1,` : '';
  // voice.edl: trechos [início, fim] (relógio do vídeo-fonte) a manter; pausas removidas, emendas com fade de 8 ms
  let cut = '', vin = '[v0]';
  if (v.edl && v.edl.length) {
    const n = v.edl.length;
    cut = `[v0]asplit=${n}${v.edl.map((_, i) => `[s${i}]`).join('')};` +
      v.edl.map(([a, b], i) => `[s${i}]atrim=start=${a}:end=${b},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${(b - a - 0.008).toFixed(4)}:d=0.008[c${i}];`).join('') +
      v.edl.map((_, i) => `[c${i}]`).join('') + `concat=n=${n}:v=0:a=1[v1];`;
    vin = '[v1]';
  }
  await ff(['-i', voiceFile, '-i', bed, '-filter_complex',
    `[0:a]${trim}${pad}aresample=48000[v0];${cut}` +
    `${vin}highpass=f=70,acompressor=threshold=-22dB:ratio=2.5:attack=8:release=120:makeup=2,volume=${v.gain ?? 1},apad=whole_dur=${meta.duration}[vo];` +
    `[vo]asplit=2[v1][vsc];[1:a]aresample=48000,volume=${v.bedGain ?? 1}[bd];` +
    `[bd][vsc]sidechaincompress=threshold=0.02:ratio=${v.duck ?? 5}:attack=30:release=400[dk];` +
    `[v1][dk]amix=inputs=2:duration=longest:normalize=0,atrim=0:${meta.duration},loudnorm=I=-14:TP=-1.5:LRA=11[a]`,
    '-map', '[a]', '-ar', '48000', '-c:a', 'pcm_s16le', f]);
  console.log('✓ áudio (voz + trilha com ducking)', path.relative(ROOT, f));
  return f;
}

/** Renderiza [i0, i1) amostras a `rate` por segundo num segmento H.264 (com tmix opcional). */
async function segment(i0, i1, rate, sub, outFile, scale, shutter = 0.5) {
  const fps = rate / sub;
  // subframe j do frame k: centrado em k/fps, espalhado por shutter/fps
  const timeOf = (i) => { const k = Math.floor(i / sub), j = i % sub; return Math.max(0, k / fps + (sub > 1 ? (j / (sub - 1) - 0.5) * shutter / fps : 0)); };
  const { page } = await openPage();
  const vf = [];
  if (sub > 1) vf.push(`tmix=frames=${sub}:weights=${Array(sub).fill(1).join(' ')}`, `select='eq(mod(n\\,${sub})\\,${sub - 1})'`, `setpts=N/(${rate / sub})/TB`);
  if (scale) vf.push(`scale=${scale}:flags=lanczos`);
  vf.push('format=yuv420p');
  await ff(['-f', 'image2pipe', '-framerate', String(rate), '-c:v', CAPTURE === 'jpeg' ? 'mjpeg' : 'png', '-i', '-', '-vf', vf.join(','), '-r', String(rate / sub),
    '-c:v', 'libx264', '-preset', FASTMODE() ? 'veryfast' : 'medium', '-crf', scale ? '20' : opt('media') ? '18' : '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', outFile],
  async (stdin) => {
    let pg = page;
    for (let i = i0; i < i1; i++) {
      // se o Chromium do worker cair (memória), reabre e continua do mesmo subframe
      for (let tries = 0; ; tries++) {
        try { await write(stdin, await shot(pg, timeOf(i))); if ((i + 1) % sub === 0) tick(); break; }
        catch (e) {
          if (tries >= 2) throw e;
          console.warn(`  ↻ worker reabrindo o navegador no subframe ${i} (${e.message.split('\n')[0]})`);
          await pg.context().browser().close().catch(() => {});
          pg = (await openPage()).page;
        }
      }
    }
    stdin.end();
    await pg.context().browser().close();
  });
}

// ---------- estimativa de tempo (aprende com cada exportação nesta máquina) ----------
// Tempo ≈ FIXO + frames × s/frame. Valores iniciais medidos num Mac de 8 núcleos com 4 workers;
// depois de cada --final/--preview o tempo real é gravado em engine/.tempos.json e as próximas estimativas usam ele.
const CAL = path.join(ROOT, 'engine', '.tempos.json');
const FIXO = 6;   // abrir navegadores + gerar áudio + juntar segmentos (s)
const BASE = { rapido: { motion: 0.03, filmagem: 0.06 }, media: { motion: 0.045, filmagem: 0.085 }, max: { motion: 0.11, filmagem: 0.2 }, preview: { motion: 0.018, filmagem: 0.035 } };
const temFilmagem = () => fs.existsSync(path.join(VDIR, 'src', 'frames'));
const modoDe = (kind) => (kind === 'preview' ? 'preview' : opt('max') ? 'max' : opt('media') ? 'media' : 'rapido');
const lerCal = () => { try { return JSON.parse(fs.readFileSync(CAL, 'utf8')); } catch { return {}; } };
function estimar(modo, frames, workers) {
  const tipo = temFilmagem() ? 'filmagem' : 'motion';
  const c = lerCal()[`${modo}-${tipo}`];
  const spf = c ? (c.spf * c.workers) / workers : (BASE[modo][tipo] * 4) / workers;
  return { s: FIXO + frames * spf, calibrado: !!c, tipo };
}
function calibrar(modo, frames, workers, seg) {
  if (frames < 60) return; // trechos muito curtos não calibram
  const tipo = temFilmagem() ? 'filmagem' : 'motion', k = `${modo}-${tipo}`, cal = lerCal();
  const spf = Math.max(0.002, (seg - FIXO) / frames);
  const old = cal[k] ? (cal[k].spf * cal[k].workers) / workers : null;
  cal[k] = { spf: +(old ? old * 0.5 + spf * 0.5 : spf).toFixed(5), workers, n: (cal[k]?.n || 0) + 1 };
  try { fs.writeFileSync(CAL, JSON.stringify(cal, null, 1)); } catch { /* pasta só leitura */ }
}
const fmtT = (s) => { s = Math.max(5, Math.round(s / 5) * 5); return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`; };
const NOME_MODO = { rapido: 'rápido (padrão)', media: 'média (--media)', max: 'máxima (--max)', preview: 'prévia' };
const PROG = { done: 0, total: 1, t0: 0, next: 0.1 };
function tick() {
  PROG.done++;
  const f = PROG.done / PROG.total;
  if (f >= PROG.next && f < 1) {
    const el = (Date.now() - PROG.t0) / 1000;
    console.log(`  ${Math.round(f * 100)}% · ${PROG.done}/${PROG.total} frames · faltam ~${fmtT((el / PROG.done) * (PROG.total - PROG.done) + 2)}`);
    while (PROG.next <= f) PROG.next += 0.1;
  }
}

async function video(kind) {
  const tIni = Date.now();
  const { page, meta } = await openPage();
  const wav = await renderAudio(page);
  await page.context().browser().close();
  const fps = kind === 'final' ? meta.fps : Math.min(30, meta.fps);
  // padrão (escolha do usuário): rápido = 1 captura por frame, JPEG, x264 veryfast. --media / --max para mais blur.
  const FAST = !!opt('fast') || (!opt('media') && !opt('max'));
  const MED = !!opt('media');  // --media: 2 capturas por frame (blur), JPEG, x264 medium CRF 18
  if (FAST || MED) CAPTURE = 'jpeg';
  const sub = kind === 'final' && !FAST ? (MED ? Math.min(2, meta.subframes) : meta.subframes) : 1;
  const rate = fps * sub;
  const from = parseFloat(opt('from', 0)), to = parseFloat(opt('to', meta.duration));
  const total = Math.round((to - from) * fps); // frames de saída
  const workers = Math.max(1, Math.min(parseInt(opt('workers', Math.min(4, os.cpus().length - 2))), total));
  const per = Math.ceil(total / workers);
  const tmp = fs.mkdtempSync(path.join(OUT, '.seg-'));
  const t0 = Date.now();
  const est = estimar(modoDe(kind), total, workers);
  console.log(`▶ ${kind} · qualidade ${NOME_MODO[modoDe(kind)]}: ${total} frames @${fps}fps × ${sub} subframes, ${workers} workers`);
  console.log(`⏱ tempo estimado: ~${fmtT(est.s)} (${est.calibrado ? 'calibrado nesta máquina' : 'estimativa inicial; fica mais precisa depois da primeira exportação'})`);
  Object.assign(PROG, { done: 0, total, t0: Date.now(), next: 0.1 });
  const segs = [];
  await Promise.all([...Array(workers)].map((_, w) => {
    const a = w * per, b = Math.min(total, (w + 1) * per);
    if (a >= b) return null;
    const f = path.join(tmp, `seg-${String(w).padStart(2, '0')}.mp4`); segs.push(f);
    const base = Math.round(from * rate);
    return segment(base + a * sub, base + b * sub, rate, sub, f, kind === 'preview' ? `${meta.W / 2}:${meta.H / 2}` : null, meta.shutter);
  }));
  segs.sort();
  const list = path.join(tmp, 'list.txt');
  fs.writeFileSync(list, segs.map((s) => `file '${s}'`).join('\n'));
  const outFile = path.join(OUT, kind !== 'final' ? 'preview.mp4' : opt('media') ? 'final-media.mp4' : opt('max') ? 'final-max.mp4' : 'final.mp4');
  await ff(['-f', 'concat', '-safe', '0', '-i', list, '-ss', String(from), '-t', String(to - from), '-i', wav,
    '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', outFile]);
  fs.rmSync(tmp, { recursive: true, force: true });
  const seg = (Date.now() - tIni) / 1000;
  calibrar(modoDe(kind), total, workers, seg);
  const mb = (fs.statSync(outFile).size / 1048576).toFixed(1);
  console.log(`✓ ${path.relative(ROOT, outFile)} · ${(to - from).toFixed(1)} s de vídeo · ${mb} MB · concluído em ${fmtT(seg)} (estimado ~${fmtT(est.s)})`);
}

try {
  if (opt('beats')) {
    const { page, meta } = await openPage();
    CAPTURE = 'png'; // revisão sempre em PNG
    // --step s: amostra a cada s segundos (padrão = 1 batida); --at 1,2.5,7: tempos exatos
    const spb = opt('step') ? parseFloat(opt('step')) : 60 / meta.bpm;
    const ats = opt('at') ? String(opt('at')).split(',').map(Number) : null;
    const n = ats ? ats.length : Math.round(meta.duration / spb);
    const off = parseFloat(opt('offset', 0.25));
    const dir = fs.mkdtempSync(path.join(OUT, '.beats-'));
    for (let b = 0; b < n; b++) fs.writeFileSync(path.join(dir, `b${String(b).padStart(3, '0')}.png`), await shot(page, ats ? ats[b] : Math.min(meta.duration, b * spb + off)));
    const cols = parseInt(opt('cols', 6)), rows = Math.ceil(n / cols), w = Math.round(meta.W / 4), h = Math.round(meta.H / 4);
    const outFile = path.join(OUT, 'beats.png');
    await ff(['-framerate', '1', '-i', path.join(dir, 'b%03d.png'), '-vf',
      `scale=${w}:${h},pad=${w + 8}:${h + 8}:4:4:color=0xd0d3da,tile=${cols}x${rows}`, '-frames:v', '1', outFile]);
    if (!opt('keep')) fs.rmSync(dir, { recursive: true, force: true }); else console.log('frames em', dir);
    console.log(`✓ ${path.relative(ROOT, outFile)} (${n} batidas, +${off}s, ordem: linha a linha)`);
  } else if (opt('frame')) {
    const t = parseFloat(opt('frame'));
    const { page } = await openPage();
    CAPTURE = 'png';
    const f = path.join(OUT, `frame-${t}.png`);
    fs.writeFileSync(f, await shot(page, t));
    console.log('✓', path.relative(ROOT, f));
  } else if (opt('determinism')) {
    const { page } = await openPage();
    const a = await shot(page, 7.3); await shot(page, 13.1); await shot(page, 0.4);
    const b = await shot(page, 7.3);
    console.log(a.equals(b) ? '✓ determinístico: seek(7.3) idêntico após outros seeks' : '✗ NÃO determinístico');
  } else if (opt('estimar')) {
    const { page, meta } = await openPage();
    const workers = Math.max(1, parseInt(opt('workers', Math.min(4, os.cpus().length - 2))));
    const total = Math.round(meta.duration * meta.fps);
    console.log(`${path.relative(ROOT, VDIR)}: ${meta.duration.toFixed(1)} s · ${meta.fps} fps · ${total} frames · ${temFilmagem() ? 'com filmagem' : 'só motion'} · ${workers} workers`);
    for (const m of ['rapido', 'media', 'max']) {
      const e = estimar(m, total, workers);
      console.log(`  ${NOME_MODO[m].padEnd(16)} ~${fmtT(e.s)}${e.calibrado ? ' (calibrado)' : ''}`);
    }
    console.log(`  prévia            ~${fmtT(estimar('preview', Math.round(meta.duration * Math.min(30, meta.fps)), workers).s)}`);
  } else if (opt('audio')) {
    const { page } = await openPage(); await renderAudio(page);
  } else if (opt('final')) await video('final');
  else await video('preview');
} catch (e) {
  console.error('✗ render falhou:', e.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}
