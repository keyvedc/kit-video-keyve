#!/usr/bin/env node
// Confere se o computador tem tudo para renderizar.   node ferramentas/checar.mjs   (ou npm run checar)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { KIT, has } from './lib.mjs';
const ok = (b, m, dica) => { console.log(`${b ? '✓' : '✗'} ${m}${!b && dica ? `\n    → ${dica}` : ''}`); return b; };
let tudo = true;
const [maj] = process.versions.node.split('.').map(Number);
tudo &= ok(maj >= 18, `Node ${process.versions.node}`, 'instale o Node 18+ (https://nodejs.org)');
tudo &= ok(has('ffmpeg') && has('ffprobe'), 'ffmpeg + ffprobe', 'macOS: brew install ffmpeg · Windows: winget install Gyan.FFmpeg · Linux: sudo apt install ffmpeg');
let pw = false;
try { const { chromium } = await import('playwright'); pw = fs.existsSync(chromium.executablePath()); } catch { /* */ }
tudo &= ok(pw, 'Playwright + Chromium', 'npm install && npx playwright install chromium');
const wh = ['whisper-cli', 'whisper-cpp'].some((b) => has(b, '--help'));
const mod = fs.existsSync(path.join(os.homedir(), '.cache/whisper/ggml-small.bin'));
ok(wh && mod, 'whisper.cpp + modelo small (opcional: só para vídeo falado)', `${wh ? '' : 'brew install whisper-cpp · '}mkdir -p ~/.cache/whisper && curl -L -o ~/.cache/whisper/ggml-small.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin`);
const marcas = fs.readdirSync(path.join(KIT, 'marcas')).filter((m) => !m.startsWith('_') && fs.existsSync(path.join(KIT, 'marcas', m, 'marca.json')));
const estilos = fs.readdirSync(path.join(KIT, 'estilos')).filter((m) => !m.startsWith('_') && fs.existsSync(path.join(KIT, 'estilos', m, 'estilo.json')));
console.log(`  marcas: ${marcas.join(', ')} · estilos: ${estilos.join(', ')} · CPUs: ${os.cpus().length}`);
console.log(tudo ? '\nTudo pronto. Teste: node engine/render.mjs videos/_modelo-motion --beats' : '\nResolva os itens com ✗ acima.');
process.exitCode = tudo ? 0 : 1;
