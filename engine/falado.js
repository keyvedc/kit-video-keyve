// Edição de vídeo falado (talking head) no estilo ativo.
// Peças: Filmagem (card/tela cheia), Legendas, cenaFx (transições), Botao + Cursor (CTA), Encerramento (end card), Passagem (ponto que abre a marca).
// Tudo é função de t. A filmagem é um vetor [wx, wy, ww, wh, raio, tx, ty, zoom] animado por track(): layouts se transformam um no outro.

import { el, track, springAt, prog, clamp, lerp, expoOut, expoIn, expoInOut } from './runtime.js';
import { M, C, E, rgba } from './marca.js';
import { BrandMark, MaskLine } from './components.js';

export const mola = () => E.mola;
export const entra = (t, t0, cfg = E.mola) => springAt(t, t0, cfg);
export const sai = (t, t0, d = 0.22) => expoIn(prog(t, t0, d));
export const mostra = (n, on, disp = 'block') => (n.style.display = on ? disp : 'none');
export const dentro = (t, wins) => wins.some(([a, b]) => t >= a && t < b);
/** Entrada com desfoque → foco (p = 0..1). */
export const blurIn = (n, p) => { n.style.opacity = clamp(p * 1.6); n.style.filter = p < 0.98 ? `blur(${(1 - p) * 10}px)` : 'none'; };

export const SETA = '<svg width="34" height="34" viewBox="0 0 34 34"><path d="M7 17 H26 M18 9 L26 17 L18 25" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/></svg>';
export const CURSOR_SVG = '<svg width="64" height="80" viewBox="0 0 32 40"><path d="M3 2 L3 30 L10 23.5 L14.5 34 L19 32 L14.6 21.8 L24 21.8 Z" fill="#05070b" stroke="#fff" stroke-width="2.2" stroke-linejoin="round"/></svg>';

// ======================= filmagem =======================
/**
 * Filmagem em frames JPG (extraídos com ferramentas/extrair-frames.sh, que grava info.json).
 * Sem frames, desenha um placeholder (útil para montar o vídeo antes da filmagem chegar).
 *   const cam = await Filmagem(stage, { pasta: 'src/frames', foco: [540, 730] });
 *   cam.layout(track(t, cam.CHEIA(1), moves));   return cam.desenhar(t);
 */
export async function Filmagem(stage, { pasta = 'src/frames', foco = [540, 730], W = 1080, H = 1920 } = {}) {
  let info = null;
  try { const r = await fetch(`${pasta}/info.json`, { cache: 'no-store' }); if (r.ok) info = await r.json(); } catch { /* sem frames */ }
  const root = el('div', { cls: 'foot' }, stage);
  const cv = el('canvas', { attrs: { width: W, height: H }, style: { width: W + 'px', height: H + 'px' } }, root);
  const g = cv.getContext('2d');
  const scrim = el('div', { cls: 'scrim' }, root);
  const [FX, FY] = foco;
  let atual = -1;
  const placeholder = () => {
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#3a3f4c'); gr.addColorStop(1, '#15181f');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,.16)';
    g.beginPath(); g.arc(FX, FY - 40, 190, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(FX, FY + 620, 470, 420, 0, Math.PI, 0); g.fill();
    g.fillStyle = 'rgba(255,255,255,.5)'; g.font = '600 44px system-ui'; g.textAlign = 'center';
    g.fillText('FILMAGEM AQUI', FX, FY + 380);
  };
  const desenharFrame = async (f) => {
    const nome = `${pasta}/${info.prefixo || 'f'}${String(f).padStart(info.digitos || 5, '0')}.${info.ext || 'jpg'}`;
    const blob = await (await fetch(nome, { cache: 'no-store' })).blob();
    const bmp = await createImageBitmap(blob);
    g.drawImage(bmp, 0, 0, W, H); bmp.close(); atual = f;
  };
  if (info) await desenharFrame(0); else placeholder();

  const cd = E.card;
  const cardVec = (r = cd) => { const z = (r.h / H) * 1.08; return [r.x, r.y, r.w, r.h, r.raio, r.x + r.w / 2, r.y + r.h * 0.33, z]; };
  const api = {
    root, canvas: cv, info, foco,
    /** tela cheia com zoom z (1 = enquadramento original; máx. recomendado E.filmagem.zoom_max) */
    CHEIA: (z = 1) => [0, 0, W, H, 0, FX, FY - (z - 1) * 250, z],
    /** card vertical no canto (posição do estilo) */
    CARD: cardVec(),
    /** card fora da tela (desce para baixo) */
    FORA: (() => { const v = cardVec(); return [v[0], H + 80, v[2], v[3], v[4], v[5], v[6] + (H + 80 - v[1]), v[7]]; })(),
    cardEm: (r) => cardVec({ ...cd, ...r }),
    layout(v) {
      const [wx, wy, ww, wh, wr, tx, ty, z] = v;
      Object.assign(root.style, { width: ww + 'px', height: wh + 'px', borderRadius: wr + 'px', transform: `translate(${wx}px, ${wy}px)` });
      cv.style.transform = `translate(${tx - FX * z - wx}px, ${ty - FY * z - wy}px) scale(${z})`;
      const cardness = clamp((W - ww) / 700);
      root.style.boxShadow = cardness > 0.05 ? `0 0 0 ${(cd.borda ?? 3) * cardness}px rgba(255,255,255,.9), 0 30px 60px -20px rgba(5,7,11,${0.6 * cardness})` : 'none';
      scrim.style.opacity = 1 - cardness;
    },
    mostrar(on) { root.style.display = on ? 'block' : 'none'; },
    /** troca o frame se mudou; devolva o resultado no render (seek assíncrono) */
    desenhar(t) {
      if (!info) return;
      const f = Math.min(info.total - 1, Math.max(0, Math.round(t * info.fps)));
      if (f !== atual) return desenharFrame(f);
    },
  };
  return api;
}

// ======================= transições de cena =======================
/**
 * Mostra/esconde uma cena cheia (.scene) com entrada e saída no estilo: 'zoom' (zoom + desfoque), 'push' (sobe), 'none'.
 * Devolve true se a cena está ativa (anime o conteúdo só nesse caso).
 */
export function cenaFx(node, t, tin, tout, { entrada = 'zoom', saida = 'zoom' } = {}) {
  const on = t >= tin - 0.01 && t < tout + 0.5;
  mostra(node, on); if (!on) return false;
  const T = E.transicao;
  let s = 1, b = 0, o = 1, y = 0;
  if (entrada === 'zoom') { const p = expoOut(prog(t, tin, T.dur_entrada)); s *= 1 - T.zoom + T.zoom * p; b += T.desfoque * (1 - p); o *= clamp(p * 1.8); }
  if (entrada === 'push') { const p = expoOut(prog(t, tin, 0.55)); y += (1 - p) * 700; b += 14 * (1 - p); o *= clamp(p * 2); }
  if (saida === 'zoom') { const q = expoIn(prog(t, tout, T.dur_saida)); s *= 1 + 0.16 * q; b += 22 * q; o *= 1 - q; }
  if (saida === 'push') { const q = expoIn(prog(t, tout, 0.4)); y -= q * 700; b += 14 * q; o *= 1 - q; }
  node.style.transform = `translateY(${y}px) scale(${s})`;
  node.style.filter = b > 0.3 ? `blur(${b}px)` : 'none';
  node.style.opacity = o;
  return true;
}

// ======================= legendas =======================
/**
 * Legendas a partir de words.json ([início, fim, palavra] no relógio do vídeo).
 * - tela cheia: grupos curtos, palavra a palavra do desfoque ao foco, palavras-chave na cauda com sublinhado no acento
 * - com o card (janelas `card`): bloco à esquerda que acende de apagado para cheio
 * opções: card, escuro, desligar = listas de janelas [[a,b],...]; chaves = palavras-chave (sem pontuação)
 */
export function Legendas(stage, words, { card = [], escuro = [], desligar = [], chaves = [] } = {}) {
  const L = E.legenda, KEYS = new Set(chaves.map((k) => k.toLowerCase()));
  const groups = []; let g = null;
  words.forEach(([a, b, w], i) => {
    const mode = dentro(a + 0.05, card) ? 'C' : 'F';
    const prev = words[i - 1];
    const cfg = mode === 'C' ? L.card : L.cheia;
    const brk = !g || g.mode !== mode || g.w.length >= cfg.max_palavras || g.chars + w.length > cfg.max_chars || /[.?!]$/.test(prev[2]) || (mode === 'F' && /,$/.test(prev[2]));
    if (brk) { g = { w: [], chars: 0, mode, dark: dentro(a + 0.05, escuro) }; groups.push(g); }
    const text = w.replace(/[,]$/, '');
    g.w.push({ a, b, text, key: KEYS.has(text.replace(/[.?!,]$/, '').toLowerCase()) }); g.chars += w.length + 1;
  });
  groups.forEach((g, i) => { g.a = g.w[0].a - 0.06; g.b = Math.min(groups[i + 1] ? groups[i + 1].w[0].a - 0.06 : 999, g.w[g.w.length - 1].b + 0.8); });
  for (const g of groups) {
    const cfg = g.mode === 'C' ? L.card : L.cheia;
    g.el = el('div', { cls: g.mode === 'C' ? 'capC' : 'capF', style: { fontSize: cfg.tamanho + 'px', fontWeight: cfg.peso, letterSpacing: '-0.03em' } }, stage);
    if (g.mode === 'C') Object.assign(g.el.style, { left: cfg.x + 'px', width: cfg.largura + 'px', color: g.dark ? C.papel : C.tinta });
    g.spans = g.w.map((w) => {
      const s = el('span', { text: w.text }, g.el);
      if (w.key) { s.classList.add('kw'); if (L.sublinhado) w.ul = el('div', { cls: 'ul' }, s); if (g.mode === 'C' && !g.dark) s.style.color = C.acento; }
      return s;
    });
    g.h = g.el.getBoundingClientRect().height;
    g.el.style.top = (g.mode === 'C' ? cfg.base - g.h : cfg.y) + 'px';
    mostra(g.el, false);
  }
  return {
    groups,
    render(t) {
      const off = dentro(t, desligar);
      for (const g of groups) {
        const on = !off && t >= g.a && t < g.b;
        mostra(g.el, on);
        if (!on) continue;
        if (g.mode === 'F') {
          g.spans.forEach((s, i) => {
            const w = g.w[i], p = expoOut(prog(t, w.a - 0.07, 0.26));
            s.style.opacity = p; s.style.transform = `translateY(${(1 - p) * 22}px) scale(${0.94 + 0.06 * p})`;
            s.style.filter = p < 0.98 ? `blur(${(1 - p) * L.cheia.desfoque}px)` : 'none';
            if (w.ul) w.ul.style.transform = `scaleX(${expoOut(prog(t, w.a + 0.05, 0.4))})`;
          });
        } else {
          const p = expoOut(prog(t, g.a, 0.4));
          g.el.style.transform = `translateY(${(1 - p) * 28}px)`;
          g.el.style.filter = p < 0.98 ? `blur(${(1 - p) * 8}px)` : 'none';
          g.el.style.opacity = p;
          g.spans.forEach((s, i) => {
            const w = g.w[i], q = expoOut(prog(t, w.a - 0.05, 0.22));
            s.style.opacity = L.card.apagada + (1 - L.card.apagada) * q;
            if (w.ul) w.ul.style.transform = `scaleX(${expoOut(prog(t, w.a + 0.05, 0.4))})`;
          });
        }
      }
    },
  };
}

// ======================= CTA =======================
/** Botão de CTA (pílula no acento + seta). Centralizado em cx, topo em y. Devolve { el, rect:[x,y,w,h] }. */
export function Botao(parent, texto, { cx = 540, y = 1000, escala = 1, z } = {}) {
  const b = el('div', { cls: 'cta', html: `${texto}<span class="ar">${SETA}</span>` }, parent);
  if (escala !== 1) {
    Object.assign(b.style, { fontSize: 50 * escala + 'px', padding: `${26 * escala}px ${30 * escala}px ${26 * escala}px ${52 * escala}px` });
    Object.assign(b.querySelector('.ar').style, { width: 72 * escala + 'px', height: 72 * escala + 'px' });
  }
  if (z) b.style.zIndex = z;
  const r = b.getBoundingClientRect();
  const rect = [cx - r.width / 2, y, r.width, r.height];
  b.style.left = rect[0] + 'px'; b.style.top = rect[1] + 'px';
  return { el: b, rect };
}

/**
 * Cursor de site que entra, vai até o alvo e clica (com onda).
 * cursor.render(t, [{ tIn, de:[x,y], para:[x,y], tClique, tSai, onda:'clara'|'acento' }, ...])
 */
export function Cursor(stage) {
  const cur = el('div', { cls: 'cursor', html: CURSOR_SVG }, stage);
  const rip = el('div', { cls: 'ripple' }, stage);
  return {
    render(t, cliques) {
      const c = [...cliques].reverse().find((k) => t >= k.tIn - 0.1) || cliques[0];
      const pos = track(t, c.de, [{ t: c.tIn + 0.05, v: c.para, cfg: { stiffness: 130, damping: 18 } }]);
      const s = entra(t, c.tIn) * (c.tSai != null ? 1 - sai(t, c.tSai, 0.25) : 1);
      const press = 1 - 0.14 * Math.sin(Math.PI * clamp((t - c.tClique) / 0.18));
      cur.style.transform = `translate(${pos[0] - 6}px, ${pos[1] - 4}px) scale(${Math.max(0.001, s * press)})`;
      mostra(cur, s > 0.01);
      const rp = prog(t, c.tClique, 0.55);
      if (rp > 0 && rp < 1) {
        const R = 20 + 110 * expoOut(rp);
        Object.assign(rip.style, { display: 'block', width: 2 * R + 'px', height: 2 * R + 'px', transform: `translate(${pos[0] - R}px, ${pos[1] - R}px)`, opacity: 1 - rp,
          borderColor: c.onda === 'acento' ? rgba(C.acento, 0.8) : 'rgba(255,255,255,.9)' });
      } else rip.style.display = 'none';
      return pos;
    },
  };
}

// ======================= encerramento =======================
/**
 * Fecho aprovado: botão de CTA aparece sobre a filmagem, o cursor clica, o botão encolhe e vira o ponto,
 * um círculo claro abre o end card, o ponto pousa na assinatura da marca, entram linha, botão, site e extra,
 * e o cursor clica no botão do end card.
 *   const fim = await Encerramento(stage, { botao, linha, url, extra, tBotao, tFim, dur });
 *   fim.render(t);  fim.cobre(t) → true quando o end card já tapa a filmagem
 */
export async function Encerramento(stage, { botao = 'Saiba mais', linha = '', url = M.site || '', extra = '', tBotao, tFim, dur, ctaY = 1000 } = {}) {
  const W = 1080;
  const tClick = tBotao + 0.1;
  const cta = Botao(stage, botao, { y: ctaY });
  const gE = el('div', { cls: 'scene light', style: { zIndex: 40 } }, stage);
  const mk = await BrandMark(gE, { h: 130, y: 640 });
  const e1 = linha ? MaskLine(gE, linha, { size: 80, y: 840, width: W, align: 'center', tracking: -0.04, maxWidth: 960 }) : null;
  const e2 = url ? MaskLine(gE, `<span style="color:${C.muted}">${url}</span>`, { size: 42, y: 1170, width: W, align: 'center', tracking: -0.01 }) : null;
  const e3 = extra ? MaskLine(gE, `<span style="color:${C.tinta_2};font-weight:600">${extra}</span>`, { size: 34, y: 1250, width: W, align: 'center', tracking: -0.01 }) : null;
  const cta2 = Botao(gE, botao, { y: 1020, escala: 0.88, z: 41 });
  const cursor = Cursor(stage);
  const [bx, by, bw, bh] = cta.rect, cx = bx + bw / 2, cy = by + bh / 2;
  const [b2x, b2y, b2w, b2h] = cta2.rect, tc2 = dur - 1.05;
  const te = tFim + 0.28;
  return {
    sfx: [{ type: 'tick', t: tClick }, { type: 'pop', t: tClick, gain: 1.1 }, { type: 'impact', t: tFim + 0.3, gain: 1 }, { type: 'chime', t: tFim + 1.1 }, { type: 'tick', t: tc2 }, { type: 'pop', t: tc2 }],
    cobre: (t) => t > tFim + 0.85,
    render(t) {
      // botão sobre a filmagem → encolhe até virar o ponto
      const ci = entra(t, tBotao);
      const press = 1 - 0.05 * Math.sin(Math.PI * clamp((t - tClick - 0.25) / 0.2));
      const shrink = expoInOut(prog(t, tFim, 0.3));
      const B = cta.el;
      if (t < tFim + 0.35 && ci > 0.01) {
        B.style.display = 'flex';
        B.style.transform = `scale(${Math.max(0.001, (0.8 + 0.2 * ci) * press)})`; blurIn(B, ci);
        if (shrink > 0) {
          const d = 40, w = lerp(bw, d, shrink), h2 = lerp(bh, d, shrink);
          Object.assign(B.style, { left: cx - w / 2 + 'px', top: cy - h2 / 2 + 'px', width: w + 'px', height: h2 + 'px', padding: '0', overflow: 'hidden',
            color: `rgba(255,255,255,${clamp(1 - shrink * 3)})`, borderRadius: lerp(999, d * 0.24, shrink) + 'px' });
        } else Object.assign(B.style, { left: bx + 'px', top: by + 'px', width: '', height: '', padding: '', overflow: '', color: '#fff', borderRadius: '999px' });
      } else B.style.display = 'none';
      // cursor: clica no botão e depois no botão do end card
      cursor.render(t, [
        { tIn: tBotao, de: [940, 1520], para: [bx + bw - 70, by + bh * 0.62], tClique: tClick + 0.25, tSai: tClick + 0.95, onda: 'clara' },
        { tIn: tc2 - 0.6, de: [900, 1460], para: [b2x + b2w - 64, b2y + b2h * 0.62], tClique: tc2, onda: 'acento' },
      ]);
      // end card abre num círculo a partir do ponto
      mostra(gE, t >= te);
      if (t >= te) {
        const r = lerp(0, 1500, expoInOut(prog(t, te, 0.55)));
        const d = mk.dotRect, mv = expoInOut(prog(t, te + 0.25, 0.5));
        const px = lerp(cx - 20, d[0], mv), py = lerp(cy - 20, d[1], mv), ps = lerp(40, d[2], mv);
        gE.style.clipPath = `circle(${r}px at ${cx}px ${cy}px)`;
        if (mk.dot) Object.assign(mk.dot.style, { width: ps + 'px', height: ps + 'px', borderRadius: ps * mk.dotRadius + 'px', transform: `translate(${px}px, ${py}px)` });
        mk.reveal(expoInOut(prog(t, te + 0.7, 0.6)));
        e1?.set(entra(t, te + 0.95)); e2?.set(entra(t, te + 1.3)); e3?.set(entra(t, te + 1.45));
        const c2i = entra(t, te + 1.15), c2p = 1 - 0.05 * Math.sin(Math.PI * clamp((t - tc2) / 0.2));
        cta2.el.style.transform = `scale(${Math.max(0.001, (0.8 + 0.2 * c2i) * c2p)})`; blurIn(cta2.el, c2i);
      }
    },
  };
}

// ======================= passagem de marca =======================
/**
 * Círculo no acento que abre a partir de um ponto (ex.: buraco de fechadura, botão) até cobrir a tela
 * e depois fecha exatamente no ponto da assinatura (dotRect de BrandMark). Use entre o problema e a solução.
 *   const pas = Passagem(stage);  pas.render(t, { t0, de: [540, 1045], para: mark.dotRect })
 * Devolve { fecha, fim }: mostre a cena da marca por baixo a partir de t0+0.3 e o ponto real em fecha+0.38.
 */
export function Passagem(stage) {
  const n = el('div', { cls: 'dotb', style: { zIndex: 50, display: 'none' } }, stage);
  return {
    render(t, { t0, de, para, raio = 0.24 }) {
      const tc = t0 + 0.75;
      if (t >= t0 && t < tc + 0.42) {
        const op = expoOut(prog(t, t0, 0.36)), cl = expoInOut(prog(t, tc, 0.4));
        const R = lerp(0, 1500, op);
        const big = [de[0] - R, de[1] - R, 2 * R, 2 * R, R];
        const dr = [para[0], para[1], para[2], para[3], para[2] * raio];
        const v = big.map((x, i) => lerp(x, dr[i], cl));
        Object.assign(n.style, { display: 'block', width: v[2] + 'px', height: v[3] + 'px', borderRadius: v[4] + 'px', transform: `translate(${v[0]}px, ${v[1]}px)` });
      } else n.style.display = 'none';
      return { fecha: tc, fim: tc + 0.42 };
    },
  };
}
