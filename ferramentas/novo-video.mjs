#!/usr/bin/env node
// Cria a pasta de um vídeo novo a partir de um modelo.
//   node ferramentas/novo-video.mjs <slug> [--tipo motion|falado] [--marca keyve]
import fs from 'node:fs';
import path from 'node:path';
import { KIT, pos, opt, die, principal } from './lib.mjs';

export function novoVideo(slug, { tipo = 'motion', marca = 'keyve' } = {}) {
  const dst = path.join(KIT, 'videos', slug);
  const src = path.join(KIT, 'videos', tipo === 'falado' ? '_modelo-falado' : '_modelo-motion');
  if (!fs.existsSync(path.join(KIT, 'marcas', marca, 'marca.json'))) die(`marca "${marca}" não existe em marcas/ (crie com a skill marca-nova)`);
  if (!fs.existsSync(path.join(dst, 'scene.html'))) {
    fs.mkdirSync(dst, { recursive: true });
    for (const f of ['scene.html', 'storyboard.md', 'words.json']) if (fs.existsSync(path.join(src, f))) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  const sc = path.join(dst, 'scene.html');
  fs.writeFileSync(sc, fs.readFileSync(sc, 'utf8').replace(/const MARCA = '[^']*';/, `const MARCA = '${marca}';`));
  return dst;
}

if (principal(import.meta.url)) {
  const [slug] = pos;
  if (!slug) die('uso: node ferramentas/novo-video.mjs <slug> [--tipo motion|falado] [--marca keyve]');
  const d = novoVideo(slug, { tipo: opt('tipo', 'motion'), marca: opt('marca', 'keyve') });
  console.log(`✓ ${path.relative(KIT, d)} criado (${opt('tipo', 'motion')}, marca ${opt('marca', 'keyve')}). Próximo: storyboard.md e scene.html; revise com --beats.`);
}
