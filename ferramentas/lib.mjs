// Utilidades compartilhadas pelas ferramentas (ffmpeg/ffprobe, leitura de áudio, EDL).
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const KIT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const args = process.argv.slice(2);
const VALORES = new Set(['db', 'min', 'respiro', 'fps', 'audio', 'max', 'modelo', 'marca', 'tipo', 'idioma', 'offset', 'w', 'h', 'estilo', 'janela']);
export const pos = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && VALORES.has(args[i - 1].slice(2))));
export const opt = (k, d) => { const i = args.indexOf('--' + k); return i < 0 ? d : (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true); };
export const die = (m) => { console.error('✗ ' + m); process.exit(1); };

export function run(bin, argv, { quiet = true } = {}) {
  return new Promise((res, rej) => {
    const p = spawn(bin, argv, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d)); p.stderr.on('data', (d) => (err += d));
    p.on('error', (e) => rej(new Error(`${bin} não encontrado (${e.message})`)));
    p.on('close', (c) => (c === 0 ? res({ out, err }) : rej(new Error(`${bin} saiu com ${c}\n${err.slice(-1500)}`))));
  });
}
export const ff = (argv) => run('ffmpeg', ['-hide_banner', '-v', 'error', '-y', ...argv]);
export const has = (bin, flag = '-version') => { try { return spawnSync(bin, [flag]).status === 0; } catch { return false; } };

export async function probe(file) {
  const { out } = await run('ffprobe', ['-v', 'error', '-show_streams', '-show_format', '-of', 'json', file]);
  const j = JSON.parse(out);
  const v = j.streams.find((s) => s.codec_type === 'video'), a = j.streams.find((s) => s.codec_type === 'audio');
  const fr = v ? v.avg_frame_rate.split('/').map(Number) : null;
  return { duration: +j.format.duration, video: v ? { w: v.width, h: v.height, fps: fr[1] ? fr[0] / fr[1] : fr[0], frames: +v.nb_frames || null } : null, audio: !!a };
}

/** Lê áudio mono float32 numa taxa `sr` (via ffmpeg). */
export async function pcm(file, sr = 16000) {
  const p = spawn('ffmpeg', ['-v', 'error', '-i', file, '-ac', '1', '-ar', String(sr), '-f', 'f32le', '-']);
  const chunks = []; p.stdout.on('data', (d) => chunks.push(d));
  await new Promise((r, j) => p.on('close', (c) => (c === 0 ? r() : j(new Error('ffmpeg pcm falhou: ' + file)))));
  const b = Buffer.concat(chunks);
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

/** Trechos de silêncio [início, fim] pelo silencedetect. */
export async function silencios(file, db = -38, min = 0.25) {
  const { err } = await run('ffmpeg', ['-hide_banner', '-i', file, '-af', `silencedetect=noise=${db}dB:d=${min}`, '-f', 'null', '-']);
  const out = []; let s = null;
  for (const l of err.split('\n')) {
    const a = l.match(/silence_start: ([\d.]+)/), b = l.match(/silence_end: ([\d.]+)/);
    if (a) s = +a[1];
    if (b && s != null) { out.push([s, +b[1]]); s = null; }
  }
  return out;
}

/**
 * EDL (trechos a MANTER) a partir dos silêncios: corta pausas ≥ min deixando `respiro` em cada lado.
 * Limites alinhados à grade de frames (fps) para vídeo e áudio cortarem igual.
 */
export function edlDeSilencios(sil, dur, { min = 0.25, respiro = 0.09, fps = 30 } = {}) {
  const q = (x) => Math.round(x * fps) / fps;
  const cortes = [];
  for (const [a, b] of sil) {
    const ca = a <= 0.02 ? 0 : a + respiro, cb = b >= dur - 0.02 ? dur : b - respiro;
    if (b - a >= min && cb - ca > 0.06) cortes.push([q(ca), q(cb)]);
  }
  const keep = []; let t = 0;
  for (const [a, b] of cortes) { if (a - t > 0.04) keep.push([t, a]); t = b; }
  if (dur - t > 0.04) keep.push([t, q(dur)]);
  return keep.map(([a, b]) => [+a.toFixed(4), +b.toFixed(4)]);
}

/** Corta um vídeo (sem áudio) e um áudio pela mesma EDL. Áudio com fade de 8 ms nas emendas. */
export async function cortarVideo(src, edl, out, { fps, w = 1080, h = 1920 } = {}) {
  const sel = edl.map(([a, b]) => `between(t,${(a - 0.5 / fps).toFixed(5)},${(b - 0.5 / fps).toFixed(5)})`).join('+');
  await ff(['-i', src, '-vf', `fps=${fps},select='${sel}',setpts=N/(${fps})/TB,scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h}`, '-r', String(fps), '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14', '-pix_fmt', 'yuv420p', out]);
}
export async function cortarAudio(src, edl, out, { offset = 0 } = {}) {
  const n = edl.length;
  const fc = `[0:a]aresample=48000,asplit=${n}${edl.map((_, i) => `[s${i}]`).join('')};` +
    edl.map(([a, b], i) => `[s${i}]atrim=start=${Math.max(0, a + offset)}:end=${b + offset},asetpts=PTS-STARTPTS,afade=t=in:d=0.008,afade=t=out:st=${Math.max(0, b - a - 0.008).toFixed(4)}:d=0.008[c${i}];`).join('') +
    edl.map((_, i) => `[c${i}]`).join('') + `concat=n=${n}:v=0:a=1[a]`;
  await ff(['-i', src, '-filter_complex', fc, '-map', '[a]', '-ac', '1', '-c:a', 'pcm_s16le', out]);
}

/** Extrai frames JPG + info.json (o que engine/falado.js → Filmagem lê). */
export async function extrairFrames(video, pasta, { fps, w = 1080, h = 1920, q = 3 } = {}) {
  fs.mkdirSync(pasta, { recursive: true });
  for (const f of fs.readdirSync(pasta)) if (/^f\d+\.jpg$/.test(f)) fs.unlinkSync(path.join(pasta, f));
  const vf = [`scale=${w}:${h}:force_original_aspect_ratio=increase`, `crop=${w}:${h}`];
  if (fps) vf.unshift(`fps=${fps}`);
  await ff(['-i', video, '-vf', vf.join(','), '-q:v', String(q), '-start_number', '0', path.join(pasta, 'f%05d.jpg')]);
  const total = fs.readdirSync(pasta).filter((f) => /^f\d+\.jpg$/.test(f)).length;
  const info = { fps: fps || (await probe(video)).video.fps, total, prefixo: 'f', digitos: 5, ext: 'jpg', w, h };
  fs.writeFileSync(path.join(pasta, 'info.json'), JSON.stringify(info, null, 1));
  return info;
}

/** fps de trabalho: mantém 24/25/30; acima de 30 cai para 30 (redes sociais). */
export const fpsDeTrabalho = (f) => (f > 31 ? 30 : Math.round(f * 1000) / 1000);
export const mapaTempo = (edl) => {
  // tempo cortado → tempo original (para conferir trechos)
  let acc = 0; const m = edl.map(([a, b]) => { const r = { a, b, ini: acc }; acc += b - a; return r; });
  return { duracao: acc, original: (t) => { const s = m.find((r) => t < r.ini + (r.b - r.a)) || m[m.length - 1]; return s.a + (t - s.ini); }, emendas: m.slice(1).map((r) => r.ini) };
};
/** true quando o arquivo foi chamado direto pela linha de comando (e não importado). */
export const principal = (url) => fileURLToPath(url) === path.resolve(process.argv[1] || '');
