// Carrega a marca e o estilo ativos de cada vídeo.
//   createVideo({ marca: 'keyve', estilo: 'keyve', ... })
// marcas/<slug>/marca.json  → cores, fontes, logo, raio (+ copy.json com os textos permitidos)
// estilos/<slug>/estilo.json → ritmo, molas, legendas, card, transições
// Os objetos M (marca), C (cores) e E (estilo) são preenchidos ANTES do setup da cena.

import { MOTION } from './config.js';

export const ROOT = new URL('../', import.meta.url).href;   // raiz do kit
export const asset = (p) => ROOT + String(p).replace(/^\//, '');
export const M = {};   // marca ativa
export const C = {};   // atalho para M.cores
export const E = {};   // estilo ativo

const hexRgb = (h) => { const x = h.replace('#', ''); const n = parseInt(x.length === 3 ? x.replace(/./g, '$&$&') : x, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
export const rgba = (hex, a) => `rgba(${hexRgb(hex).join(',')},${a})`;

const DEF_CORES = { acento: '#1b43f6', acento_claro: '#6f8bff', tinta: '#05070b', tinta_2: '#2a2f3c', papel: '#ffffff', fundo_claro: '#f4f5f8', fundo_escuro: '#05070b', chumbo: '#1d2230', muted: '#5d626e' };

export async function loadMarca(slug) {
  const dir = `${ROOT}marcas/${slug}/`;
  const m = await (await fetch(dir + 'marca.json')).json();
  let copy = {};
  try { copy = await (await fetch(dir + 'copy.json')).json(); } catch { /* opcional */ }
  Object.assign(M, m, { slug, dir, copy, asset: (p) => dir + String(p).replace(/^\//, '') });
  Object.assign(C, DEF_CORES, m.cores || {});
  M.cores = C;
  const F = (M.fontes = m.fontes || {});
  const fam = (f, fb) => (f ? `"${f.familia}", ${fb}` : fb);
  let css = '';
  for (const k of Object.keys(F)) {
    const f = F[k];
    if (f.arquivo) css += `@font-face { font-family: "${f.familia}"; src: url("${dir}${f.arquivo}") format("${f.arquivo.endsWith('.ttf') ? 'truetype' : f.arquivo.endsWith('.otf') ? 'opentype' : 'woff2'}"); font-weight: ${f.pesos || '100 900'}; font-style: ${f.estilo || 'normal'}; }\n`;
  }
  const t = F.texto || {}, ca = F.cauda || null;
  css += `:root {
  --acento: ${C.acento}; --acento-rgb: ${hexRgb(C.acento).join(',')}; --acento-claro: ${C.acento_claro};
  --tinta: ${C.tinta}; --tinta-2: ${C.tinta_2}; --papel: ${C.papel};
  --claro: ${C.fundo_claro}; --escuro: ${C.fundo_escuro}; --chumbo: ${C.chumbo}; --muted: ${C.muted};
  --f-texto: ${fam(F.texto, 'system-ui, sans-serif')};
  --f-cauda: ${ca ? fam(ca, 'Georgia, serif') : 'inherit'};
  --cauda-estilo: ${ca ? ca.estilo || 'italic' : 'normal'}; --cauda-peso: ${ca ? ca.peso || 400 : 'inherit'};
  --f-display: ${fam(F.display || F.texto, 'system-ui, sans-serif')};
  --peso: ${t.peso || 500}; --tracking: ${t.tracking ?? -0.03}em; --raio: ${m.raio ?? 24}px;
}\n`;
  const st = document.createElement('style'); st.dataset.marca = slug; st.textContent = css;
  document.head.appendChild(st);
  // força o carregamento das fontes antes de medir qualquer texto
  const loads = [];
  for (const k of Object.keys(F)) {
    const f = F[k];
    const pesos = String(f.pesos || '400').split(/\s+/);
    for (const w of new Set([pesos[0], String(t.peso || 500), '400', '600', '700'])) loads.push(document.fonts.load(`${f.estilo || 'normal'} ${w} 100px "${f.familia}"`).catch(() => {}));
  }
  await Promise.all(loads);
  await document.fonts.ready;
  return M;
}

const DEF_ESTILO = {
  nome: 'padrão', bpm: MOTION.bpm, fps: MOTION.fps,
  mola: { stiffness: 170, damping: 21 },
  legenda: {
    cheia: { tamanho: 68, peso: 700, y: 1268, max_palavras: 3, max_chars: 19, desfoque: 10 },
    card: { tamanho: 54, peso: 600, x: 60, largura: 600, base: 1548, max_palavras: 6, max_chars: 30, apagada: 0.28 },
    sublinhado: true,
  },
  card: { x: 690, y: 975, w: 330, h: 586, raio: 30, borda: 3 },
  transicao: { dur_entrada: 0.6, dur_saida: 0.42, zoom: 0.07, desfoque: 16 },
  filmagem: { zoom_max: 1.15 },
};
const deep = (a, b) => { for (const k in b) a[k] = b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) ? deep({ ...(a[k] || {}) }, b[k]) : b[k]; return a; };

export async function loadEstilo(slug) {
  let e = {};
  if (slug) e = await (await fetch(`${ROOT}estilos/${slug}/estilo.json`)).json();
  Object.assign(E, deep(JSON.parse(JSON.stringify(DEF_ESTILO)), e), { slug });
  return E;
}
