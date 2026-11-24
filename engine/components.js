// Componentes de marca reutilizáveis. Cada componente só CRIA o DOM;
// quem anima é o render(t) da cena (via tf/reveal/estilos). Cores e fontes vêm da marca ativa (M, C).

import { el, clamp, expoOut, expoIn, spring } from './runtime.js';
import { M, C, asset } from './marca.js';
export { asset };

// ---------- logo ----------
const svgCache = new Map();
async function svgText(url) {
  if (!svgCache.has(url)) svgCache.set(url, fetch(url).then((r) => r.text()));
  return svgCache.get(url);
}
/** Insere um SVG da marca com altura h. recolor=true troca o preenchimento por `color` (logo monocromático). */
export async function Logo(parent, file, { h = 120, color, recolor = M.logo?.recolorir !== false } = {}) {
  const txt = await svgText(M.asset(file));
  const box = el('div', { html: txt, style: { position: 'absolute', lineHeight: 0 } }, parent);
  const svg = box.querySelector('svg');
  const vb = (svg.getAttribute('viewBox') || `0 0 ${svg.getAttribute('width')} ${svg.getAttribute('height')}`).split(/[\s,]+/).map(Number);
  const k = h / vb[3];
  svg.setAttribute('width', vb[2] * k); svg.setAttribute('height', h);
  svg.style.overflow = 'visible';
  if (recolor && color) {
    svg.style.color = color;
    svg.querySelectorAll('[fill]:not([fill="none"])').forEach((n) => n.setAttribute('fill', 'currentColor'));
    if (!svg.getAttribute('fill')) svg.setAttribute('fill', 'currentColor');
  }
  return { root: box, svg, width: vb[2] * k, height: h, viewBox: vb, scale: k };
}

/**
 * Assinatura da marca: wordmark + ponto no acento (o objeto-condutor), centralizados em cx.
 * Configuração em marca.json → logo.ponto { usar, x, base, tamanho, gap, raio } (x/base em unidades do viewBox).
 * Retorna dotRect [x, y, w, h] para o ponto que viaja pousar exatamente nele.
 * Revele com mark.reveal(p): o wordmark sai de trás do ponto (máscara da direita para a esquerda).
 */
export async function BrandMark(parent, { h = 140, cx = 540, y = 600, color = C.tinta } = {}) {
  const wm = await Logo(parent, M.logo.wordmark, { h, color });
  const P = { usar: true, tamanho: 0.17, gap: 0.05, raio: 0.24, ...(M.logo.ponto || {}) };
  const [vx, vy, vw, vh] = wm.viewBox, k = wm.scale;
  const d = P.usar ? h * P.tamanho : 0, gap = P.usar ? h * P.gap : 0;
  const px = P.x != null ? (P.x - vx) * k : wm.width;               // onde o ponto começa (local)
  const total = Math.max(wm.width, px + gap + d);
  const x0 = cx - total / 2;
  Object.assign(wm.root.style, { left: x0 + 'px', top: y + 'px' });
  const base = y + (P.base != null ? (P.base - vy) * k : h * 0.77);
  const dotX = x0 + px + gap;
  const dot = P.usar ? el('div', { cls: 'dotb', style: { width: d + 'px', height: d + 'px', borderRadius: d * P.raio + 'px', transform: `translate(${dotX}px, ${base - d}px)` } }, parent) : null;
  const reveal = (p) => {
    wm.root.style.clipPath = p >= 1 ? 'none' : `inset(-20% 0 -20% ${(1 - clamp(p)) * 100}%)`;
    wm.root.style.transform = `translateX(${(1 - clamp(p)) * 40}px)`;
  };
  return { wm, dot, dotRect: [dotX, base - d, d, d], dotRadius: P.raio, reveal, x: x0, width: total };
}

// ---------- tipografia ----------
/**
 * Linha de texto com máscara: sobe para dentro (in) e sai para cima (out). Tempos separados = letras nunca se sobrepõem.
 * html aceita <span class="tail"> (cauda) e <b class="key"> (palavra-chave no acento).
 */
export function MaskLine(parent, html, { size = 104, weight, tracking = -0.04, color, align = 'left', x = 0, y = 0, width, maxWidth } = {}) {
  const wrap = el('div', { style: {
    position: 'absolute', left: x + 'px', top: y + 'px', width: width ? width + 'px' : 'auto',
    overflow: 'hidden', paddingBottom: size * 0.18 + 'px', marginBottom: -size * 0.18 + 'px', textAlign: align, zIndex: 10,
  } }, parent);
  const inner = el('div', { html, style: {
    fontSize: size + 'px', fontWeight: weight ?? 'var(--peso)', letterSpacing: tracking + 'em', lineHeight: 1.02,
    whiteSpace: 'nowrap', fontFamily: 'var(--f-texto)', ...(color ? { color } : {}),
  } }, wrap);
  inner.querySelectorAll('.tail').forEach((n) => { n.style.fontSize = '1.08em'; });
  if (maxWidth) {
    const span = el('span', { html: inner.innerHTML, style: { whiteSpace: 'nowrap' } });
    inner.innerHTML = ''; inner.appendChild(span);
    const w = span.getBoundingClientRect().width;
    if (w > maxWidth) inner.style.fontSize = (size * maxWidth) / w + 'px';
  }
  const set = (pIn, pOut = 0) => {
    const yIn = (1 - pIn) * 1.15, yOut = -pOut * 1.15;
    inner.style.transform = `translateY(${(yIn + yOut) * 100}%)`;
    wrap.style.visibility = pIn <= 0.001 || pOut >= 0.999 ? 'hidden' : 'visible';
  };
  set(0);
  return { wrap, inner, set };
}

/**
 * Cabeçalho padrão 9:16: L1 texto + L2 cauda no acento. Entra em t0+0.08 / t0+0.5, sai antes do fim (dur).
 */
export function Headline(parent, l1, l2, t0, { color, keyColor = C.acento, dur = 2, soft = { stiffness: 160, damping: 20 } } = {}) {
  const a = MaskLine(parent, l1, { size: 92, x: 70, y: 290, color, maxWidth: 940 });
  const b = MaskLine(parent, `<span class="tail" style="color:${keyColor}">${l2}</span>`, { size: 100, x: 70, y: 392, color, maxWidth: 940 });
  const out = (t, t1, d) => expoIn(clamp((t - t1) / d));
  return { a, b, set(t) {
    a.set(spring(t - t0 - 0.08, soft), out(t, t0 + dur - 0.38, 0.3));
    b.set(spring(t - t0 - 0.5, soft), out(t, t0 + dur - 0.30, 0.28));
  } };
}

// ---------- UI ----------
/** Celular vetorial com uma pilha vertical de telas reais (imagens 2:3, caminhos relativos à marca). */
export function Phone(parent, { w = 520, h = 1040, images = [] } = {}) {
  const r = w * 0.15, bez = 14;
  const root = el('div', { style: { position: 'absolute', width: w + 'px', height: h + 'px', borderRadius: r + 'px', background: C.tinta, boxShadow: '0 40px 80px -30px rgba(5,7,11,.35)' } }, parent);
  const screen = el('div', { style: { position: 'absolute', left: bez + 'px', top: bez + 'px', width: w - bez * 2 + 'px', height: h - bez * 2 + 'px', borderRadius: r - bez + 'px', overflow: 'hidden', background: C.papel } }, root);
  const strip = el('div', { style: { position: 'absolute', left: 0, top: 0, width: '100%' } }, screen);
  const sw = w - bez * 2, sh = sw * 1.5;
  const shots = images.map((src, i) => el('img', { attrs: { src: M.asset(src) }, style: { position: 'absolute', left: 0, top: i * sh + 'px', width: sw + 'px', height: sh + 'px', objectFit: 'cover' } }, strip));
  el('div', { style: { position: 'absolute', left: '50%', top: bez + 14 + 'px', width: w * 0.28 + 'px', height: '30px', marginLeft: -w * 0.14 + 'px', borderRadius: '20px', background: C.tinta } }, root);
  return { root, screen, strip, shots, w, h, sw, sh, bez };
}

/** Balão de chat. kind: 'user' (cinza, direita) | 'marca' (acento, esquerda). */
export function Bubble(parent, html, { kind = 'marca', size = 38, maxW = 720 } = {}) {
  const isB = kind !== 'user';
  return el('div', { html, style: {
    position: 'absolute', maxWidth: maxW + 'px', padding: `${size * 0.6}px ${size * 0.8}px`,
    borderRadius: size * 0.9 + 'px', fontSize: size + 'px', lineHeight: 1.22, fontWeight: 450, letterSpacing: '-0.01em',
    background: isB ? C.acento : '#eef0f4', color: isB ? C.papel : C.tinta,
    [isB ? 'borderBottomLeftRadius' : 'borderBottomRightRadius']: size * 0.25 + 'px', whiteSpace: 'normal',
  } }, parent);
}

/** Card de imagem com rótulo (ex.: serviço). img relativo à pasta da marca. */
export function ImageTile(parent, { img, label, w = 300, h = 300 } = {}) {
  const root = el('div', { style: { position: 'absolute', width: w + 'px', height: h + 'px', borderRadius: '24px', overflow: 'hidden', background: C.tinta } }, parent);
  el('img', { attrs: { src: M.asset(img) }, style: { position: 'absolute', left: '-25%', top: '-8%', width: '150%', height: '116%', objectFit: 'cover' } }, root);
  if (label) el('div', { text: label, style: { position: 'absolute', left: '20px', bottom: '18px', right: '16px', color: C.papel, fontSize: Math.round(w * 0.075) + 'px', fontWeight: 500, letterSpacing: '-0.01em', lineHeight: 1.1 } }, root);
  return root;
}

// ---------- forma ----------
/** Ajusta um div-forma (o objeto-condutor) a um retângulo {x,y,w,h,r} + cor. */
export function shape(node, { x, y, w, h, r = 0, color, rot = 0, o = 1 }) {
  node.style.left = '0px'; node.style.top = '0px';
  node.style.width = Math.max(0, w) + 'px'; node.style.height = Math.max(0, h) + 'px';
  node.style.borderRadius = typeof r === 'number' ? r + 'px' : r;
  node.style.transform = `translate(${x}px, ${y}px)${rot ? ` rotate(${rot}deg)` : ''}`;
  if (color) node.style.background = color;
  node.style.opacity = o;
  node.style.visibility = o <= 0.001 || w <= 0.1 ? 'hidden' : 'visible';
}
export const rectMix = (a, b, p) => ({
  x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p, w: a.w + (b.w - a.w) * p, h: a.h + (b.h - a.h) * p,
  r: (a.r ?? 0) + ((b.r ?? 0) - (a.r ?? 0)) * p,
});
export { expoOut, expoIn, clamp };
