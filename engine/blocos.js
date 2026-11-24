// Blocos de cena prontos (estilo aprovado). Criam o DOM no setup; anime com .set()/.render() no render(t).
// Todos usam as cores da marca ativa. Textos: só o que estiver em marcas/<slug>/copy.json ou na fala.

import { el, prog, clamp, lerp, expoOut, expoInOut } from './runtime.js';
import { C } from './marca.js';
import { entra, blurIn } from './falado.js';

export const ICONES = {
  chat: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linejoin="round"><path d="M8 30 l2-6 A13 13 0 1 1 15 31 z"/></svg>',
  camera: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.5"><rect x="6" y="6" width="28" height="28" rx="8"/><circle cx="20" cy="20" r="7"/></svg>',
  cadeado: '<svg width="40" height="40" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round"><rect x="12" y="28" width="40" height="28" rx="8"/><path d="M20 28 v-8 a12 12 0 0 1 24 0 v8"/></svg>',
  escudo: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"><path d="M15 3 L25 7 V14 C25 20 20.5 25 15 27 C9.5 25 5 20 5 14 V7 Z"/><path d="M10.5 15 l3 3 l6 -6.5"/></svg>',
  suporte: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"><path d="M8 22 v-3 a12 12 0 0 1 24 0 v3"/><rect x="6" y="21" width="7" height="11" rx="3"/><rect x="27" y="21" width="7" height="11" rx="3"/></svg>',
  check: '<svg width="30" height="30" viewBox="0 0 30 30" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15.5 l5 5 l11 -11"/></svg>',
  grafico: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 32 L15 21 L22 26 L34 10"/><path d="M26 10 H34 V18"/></svg>',
  site: '<svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="currentColor" stroke-width="3.5"><rect x="5" y="8" width="30" height="24" rx="5"/><path d="M5 15 H35"/></svg>',
};

/** Texto que rola para outro (ex.: "R$ 5 mil" → "R$ 10 mil"), com desfoque no meio do giro. set(pIn, pRolo). */
export function RolaTexto(parent, [a, b], { x = 60, y = 340, w = 960, size = 200, color = C.papel, weight = 600 } = {}) {
  const lh = size * 1.15;
  const box = el('div', { cls: 'abs', style: { left: x + 'px', top: y + 'px', width: w + 'px', height: lh + 'px', overflow: 'hidden' } }, parent);
  const st = { fontSize: size + 'px', fontWeight: weight, letterSpacing: '-0.05em', lineHeight: lh + 'px', color, whiteSpace: 'nowrap' };
  const A = el('div', { text: a, cls: 'abs', style: st }, box), B = el('div', { text: b, cls: 'abs', style: st }, box);
  return { box, set(pIn, roll) {
    A.style.transform = `translateY(${(1 - pIn) * lh - roll * lh}px)`;
    B.style.transform = `translateY(${(1 - roll) * lh}px)`;
    const f = roll > 0.02 && roll < 0.98 ? `blur(${Math.sin(Math.PI * roll) * 8}px)` : 'none';
    A.style.filter = f; B.style.filter = f;
  } };
}

/** Número/preço com dígitos girando como contador (ex.: "R$ 39,90"). render(t, t0). */
export function RolaNumero(parent, texto, { x = 60, y = 360, size = 230, color = C.papel, weight = 600, dur = 0.9 } = {}) {
  const lh = size * 1.087;
  const box = el('div', { cls: 'abs', style: { left: x + 'px', top: y + 'px', height: lh + 'px', overflow: 'hidden', display: 'flex', alignItems: 'flex-start', fontSize: size + 'px', fontWeight: weight, letterSpacing: '-0.05em', lineHeight: lh + 'px', color } }, parent);
  const cols = [...texto].map((ch) => {
    const col = el('span', { style: { display: 'inline-block', position: 'relative', whiteSpace: 'pre' } }, box);
    if (!/\d/.test(ch)) { col.textContent = ch; return {}; }
    const strip = el('span', { style: { display: 'block' } }, col);
    const seq = []; for (let k = 0; k <= 10 + +ch; k++) seq.push(k % 10);
    strip.innerHTML = seq.map((d) => `<span style="display:block;height:${lh}px">${d}</span>`).join('');
    col.style.height = lh + 'px'; col.style.overflow = 'hidden';
    return { strip, n: seq.length - 1 };
  });
  return { box, render(t, t0) {
    const pin = entra(t, t0 - 0.05);
    box.style.transform = `translateY(${(1 - pin) * 40}px)`; blurIn(box, pin);
    cols.forEach(({ strip, n }, i) => {
      if (!strip) return;
      const p = expoOut(prog(t, t0 + i * 0.05, dur));
      strip.style.transform = `translateY(${-p * n * lh}px)`;
      strip.style.filter = p > 0.02 && p < 0.9 ? `blur(${(1 - p) * 6}px)` : 'none';
    });
  } };
}

/** Notificação de celular (app, título, texto). render(t, tIn, { some }) — some = tempo em que se desfaz (opcional). */
export function Notificacao(parent, { app = 'APP', titulo = '', texto = '', icone = ICONES.chat, top = 560, hora = 'agora' } = {}) {
  const n = el('div', { cls: 'notif', style: { top: top + 'px' }, html: `<div class="appic">${icone}</div><div style="flex:1"><div style="display:flex;justify-content:space-between;font-size:26px;color:${C.muted};font-weight:500"><span>${app}</span><span>${hora}</span></div><div style="font-size:40px;font-weight:700;letter-spacing:-0.02em;margin-top:6px">${titulo}</div><div style="font-size:30px;color:${C.tinta_2};margin-top:4px">${texto}</div></div>` }, parent);
  return { el: n, render(t, tIn, { some } = {}) {
    const a = entra(t, tIn), g = some != null ? expoOut(prog(t, some, 0.5)) : 0;
    n.style.transform = `translateY(${(1 - a) * -60}px) scale(${(0.9 + 0.1 * a) * (1 - 0.15 * g)})`;
    n.style.opacity = clamp(a * 1.6) * (1 - g);
    n.style.filter = a < 0.98 || g > 0 ? `blur(${(1 - a) * 10 + g * 26}px)` : 'none';
  } };
}

/** Lista de itens que "ligam" um a um no tempo da fala (painel claro). itens: [{ label, icone, status, t }]. */
export function Checklist(parent, itens, { top = 450, gap = 128 } = {}) {
  const rows = itens.map((it, i) => {
    const r = el('div', { cls: 'row', style: { top: top + i * gap + 'px' }, html: `<div class="appic" style="width:68px;height:68px;border-radius:18px">${it.icone || ICONES.check}</div><span>${it.label}</span><div class="stat">${ICONES.escudo}<span>${it.status || 'Ativo'}</span></div>` }, parent);
    return { r, stat: r.querySelector('.stat'), t: it.t };
  });
  return { rows, render(t, tIn) {
    rows.forEach(({ r, stat, t: tt }, i) => {
      const p = entra(t, tIn + i * 0.12);
      r.style.transform = `translateY(${(1 - p) * 50}px) scale(${0.95 + 0.05 * p})`; blurIn(r, p);
      const on = expoOut(prog(t, tt, 0.35)) > 0.5;
      stat.style.background = on ? C.acento : '#eceef3';
      stat.style.color = on ? '#fff' : '#9aa0ab';
      stat.style.transform = `scale(${1 + 0.08 * Math.sin(Math.PI * clamp((t - tt) / 0.3))})`;
      stat.querySelector('svg').style.display = on ? 'block' : 'none';
      r.style.boxShadow = on ? `0 16px 40px -24px rgba(var(--acento-rgb),.6), 0 0 0 2px rgba(var(--acento-rgb),.9)` : '';
    });
  } };
}

/** Escudo desenhado por traço + check no acento. render(t, t0). */
export function Escudo(parent, { x = 410, y = 250, cor = C.papel } = {}) {
  const box = el('div', { cls: 'abs', style: { left: x + 'px', top: y + 'px', transformOrigin: '130px 150px' }, html: `<svg width="260" height="300" viewBox="0 0 260 300"><path class="sh" d="M130 14 L236 54 V138 C236 206 190 260 130 286 C70 260 24 206 24 138 V54 Z" fill="none" stroke="${cor}" stroke-width="10" stroke-linejoin="round"/><path class="ck" d="M84 150 l34 34 l62 -68" fill="none" stroke="${C.acento_claro}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/></svg>` }, parent);
  const sh = box.querySelector('.sh'), ck = box.querySelector('.ck');
  const L1 = sh.getTotalLength(), L2 = ck.getTotalLength();
  sh.style.strokeDasharray = L1; ck.style.strokeDasharray = L2;
  return { box, render(t, t0) {
    sh.style.strokeDashoffset = L1 * (1 - expoInOut(prog(t, t0, 0.7)));
    ck.style.strokeDashoffset = L2 * (1 - expoOut(prog(t, t0 + 0.6, 0.4)));
    box.style.transform = `scale(${0.9 + 0.1 * expoOut(prog(t, t0, 0.8))})`;
  } };
}

/** Barras de gráfico que crescem (valores 0..1; 0 = barra tracejada vazia). render(t, t0). */
export function Barras(parent, valores, { x = 70, base = 1240, largura = 58, passo = 82, altura = 300, cor = 'rgba(255,255,255,.85)' } = {}) {
  const bars = valores.map((v, i) => el('div', { style: { position: 'absolute', left: x + i * passo + 'px', width: largura + 'px', borderRadius: '14px', top: base - Math.max(16, v * altura) + 'px', height: Math.max(16, v * altura) + 'px',
    background: v ? cor : 'transparent', border: v ? 'none' : '3px dashed rgba(255,255,255,.35)', transformOrigin: '50% 100%' } }, parent));
  return { bars, render(t, t0) {
    bars.forEach((b, i) => { const g = entra(t, t0 + i * 0.06); b.style.transform = `scaleY(${Math.max(0.001, g)})`; b.style.opacity = clamp(g * 2); });
  } };
}
