#!/usr/bin/env node
// Transcreve a fala palavra a palavra com whisper.cpp → words.json ([início, fim, "palavra"], em segundos).
//   node ferramentas/transcrever.mjs <audio-ou-video> <saida/words.json> [--idioma pt] [--modelo ~/.cache/whisper/ggml-small.bin]
// Depois: corrija nomes próprios e marcas (a IA confere com o copy.json da marca) e marque trechos duvidosos.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pos, opt, die, ff, run, has, principal } from './lib.mjs';

export async function transcrever(src, saida, { idioma = 'pt', modelo } = {}) {
  const bin = ['whisper-cli', 'whisper-cpp', 'main'].find((b) => has(b, '--help'));
  if (!bin) die('whisper.cpp não encontrado. macOS: brew install whisper-cpp · outros: https://github.com/ggml-org/whisper.cpp');
  modelo = modelo || path.join(os.homedir(), '.cache/whisper/ggml-small.bin');
  if (!fs.existsSync(modelo)) die(`modelo não encontrado em ${modelo}. Baixe: mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'transc-'));
  const wav = path.join(tmp, 'a.wav');
  await ff(['-i', src, '-ac', '1', '-ar', '16000', '-c:a', 'pcm_s16le', wav]);
  await run(bin, ['-m', modelo, '-l', idioma, '-ml', '1', '-sow', '-oj', '-ojf', '-f', wav, '-of', path.join(tmp, 'w')]);
  const j = JSON.parse(fs.readFileSync(path.join(tmp, 'w.json'), 'utf8'));
  const words = [];
  for (const s of j.transcription || []) {
    const w = (s.text || '').trim();
    if (!w || /^\[.*\]$/.test(w)) continue;
    const a = s.offsets.from / 1000, b = s.offsets.to / 1000;
    // pontuação solta gruda na palavra anterior
    if (/^[.,!?;:…]+$/.test(w) && words.length) { words[words.length - 1][2] += w; words[words.length - 1][1] = b; continue; }
    words.push([+a.toFixed(2), +b.toFixed(2), w]);
  }
  fs.mkdirSync(path.dirname(path.resolve(saida)), { recursive: true });
  fs.writeFileSync(saida, '[' + words.map((w) => JSON.stringify(w)).join(',\n') + ']\n');
  fs.rmSync(tmp, { recursive: true, force: true });
  return words;
}

if (principal(import.meta.url)) {
  const [src, saida = 'words.json'] = pos;
  if (!src) die('uso: node ferramentas/transcrever.mjs <audio-ou-video> <words.json> [--idioma pt]');
  const w = await transcrever(src, saida, { idioma: opt('idioma', 'pt'), modelo: opt('modelo') });
  console.log(`✓ ${saida}: ${w.length} palavras — "${w.slice(0, 12).map((x) => x[2]).join(' ')}…"`);
}
