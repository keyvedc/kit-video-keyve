// Motor de vídeo (Kit Keyve) — runtime determinístico.
// Contrato: toda cena expõe window.seek(t) e TODO estilo é função de t.
// Proibido: CSS animation/transition, setTimeout/rAF para animar, estado entre frames.
// Medições de layout feitas UMA vez no setup (antes da câmera) são permitidas.

import { MOTION, FORMATS } from './config.js';
import { loadMarca, loadEstilo, M, E } from './marca.js';
export { M, C, E, asset, rgba } from './marca.js';

// ---------- matemática ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, p) => a + (b - a) * p;
export const invlerp = (a, b, x) => (b === a ? 0 : (x - a) / (b - a));
/** Progresso 0..1 de t dentro de [t0, t0+dur]. */
export const prog = (t, t0, dur) => clamp((t - t0) / dur);
export const mix = (a, b, p) => (typeof a === 'number' ? lerp(a, b, p) : a.map((v, i) => lerp(v, b[i], p)));

// ---------- easing (sem bounce) ----------
export const expoOut = (p) => (p >= 1 ? 1 : 1 - Math.pow(2, -10 * p));
export const expoIn = (p) => (p <= 0 ? 0 : Math.pow(2, 10 * p - 10));
export const expoInOut = (p) =>
  p <= 0 ? 0 : p >= 1 ? 1 : p < 0.5 ? Math.pow(2, 20 * p - 10) / 2 : (2 - Math.pow(2, -20 * p + 10)) / 2;
export const cubicInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

/**
 * Mola amortecida analítica (resposta ao degrau 0→1), função pura do tempo.
 * Padrão MOTION.spring: overshoot ~3%, assenta em ~0,45 s.
 */
export function spring(dt, cfg = MOTION.spring) {
  if (dt <= 0) return 0;
  const { stiffness: k, damping: c, mass: m = 1 } = cfg;
  const w0 = Math.sqrt(k / m);
  const z = c / (2 * Math.sqrt(k * m));
  if (z >= 1) {
    // criticamente amortecida
    return 1 - Math.exp(-w0 * dt) * (1 + w0 * dt);
  }
  const wd = w0 * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w0 * dt) * (Math.cos(wd * dt) + ((z * w0) / wd) * Math.sin(wd * dt));
}
/** Mola que começa em t0: 0 antes, ~1 depois de assentar. */
export const springAt = (t, t0, cfg) => spring(t - t0, cfg);
/** Interpola a→b com mola a partir de t0. */
export const springTo = (t, t0, a, b, cfg) => mix(a, b, springAt(t, t0, cfg));

/** Sequência de keyframes {t, v, ease?}: retorna valor em t (v pode ser número ou array). */
export function keys(t, list, defEase = expoInOut) {
  if (t <= list[0].t) return list[0].v;
  for (let i = 1; i < list.length; i++) {
    const a = list[i - 1], b = list[i];
    if (t <= b.t) {
      const e = b.ease || defEase;
      const p = typeof e === 'object' ? spring(t - a.t, e) : e(invlerp(a.t, b.t, t));
      return mix(a.v, b.v, p);
    }
  }
  return list[list.length - 1].v;
}

/**
 * Trilha aditiva de alvos: valor(t) = v0 + Σ (alvo_i − alvo_{i−1}) · ease_i(t).
 * Cada movimento é uma mola ({cfg}) ou easing com duração ({dur, ease}).
 * Contínua por construção: movimentos podem se sobrepor sem saltos. v pode ser número ou array.
 * moves: [{ t, v, cfg? , dur?, ease? }]
 */
export function track(t, v0, moves, defCfg = MOTION.spring) {
  const arr = Array.isArray(v0);
  const out = arr ? [...v0] : [v0];
  let prev = arr ? v0 : [v0];
  for (const m of moves) {
    const v = arr ? m.v : [m.v];
    if (t > m.t) {
      const p = m.dur ? (m.ease || expoInOut)(clamp((t - m.t) / m.dur)) : spring(t - m.t, m.cfg || defCfg);
      for (let i = 0; i < out.length; i++) out[i] += (v[i] - prev[i]) * p;
    }
    prev = v;
  }
  return arr ? out : out[0];
}

/** Pulso suave 0→1→0 em [t0, t0+dur] (seno), para toques/pressões. */
export const pulse = (t, t0, dur) => { const p = (t - t0) / dur; return p <= 0 || p >= 1 ? 0 : Math.sin(Math.PI * p); };

// ---------- tempo musical ----------
export const SPB = 60 / MOTION.bpm; // segundos por batida (0,5 s a 120 BPM)
// batida/compasso seguem o BPM do estilo ativo (use dentro do setup/render)
export const beat = (n) => (n * 60) / (E.bpm || MOTION.bpm);
export const bar = (n) => beat(n * 4);

// ---------- DOM ----------
export function el(tag, opts = {}, parent) {
  const isSvg = ['svg', 'path', 'g', 'circle', 'rect', 'line', 'polyline', 'defs', 'filter', 'feGaussianBlur', 'clipPath', 'mask', 'text', 'linearGradient', 'stop'].includes(tag);
  const n = isSvg ? document.createElementNS('http://www.w3.org/2000/svg', tag) : document.createElement(tag);
  const { cls, style, text, html, attrs } = opts;
  if (cls) n.setAttribute('class', cls);
  if (style) Object.assign(n.style, style);
  if (text != null) n.textContent = text;
  if (html != null) n.innerHTML = html;
  if (attrs) for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
}

/** Aplica transform 2D/3D a partir de um objeto. Sem will-change (texto ficaria borrado sob a câmera). */
export function tf(node, { x = 0, y = 0, z = 0, s = 1, sx, sy, r = 0, rx = 0, ry = 0, o, origin } = {}) {
  const scx = sx ?? s, scy = sy ?? s;
  let str = `translate3d(${x}px, ${y}px, ${z}px)`;
  if (rx) str += ` rotateX(${rx}deg)`;
  if (ry) str += ` rotateY(${ry}deg)`;
  if (r) str += ` rotate(${r}deg)`;
  if (scx !== 1 || scy !== 1) str += ` scale(${scx}, ${scy})`;
  node.style.transform = str;
  if (origin) node.style.transformOrigin = origin;
  if (o !== undefined) {
    node.style.opacity = o;
    node.style.visibility = o <= 0.001 ? 'hidden' : 'visible';
  }
}
export const show = (node, on) => (node.style.visibility = on ? 'visible' : 'hidden');

/** Revela por máscara: p=0 escondido, p=1 visível. dir: 'up' | 'down' | 'left' | 'right'. */
export function reveal(node, p, dir = 'up') {
  const q = (1 - clamp(p)) * 100;
  const inset = { up: `${q}% 0 0 0`, down: `0 0 ${q}% 0`, left: `0 ${q}% 0 0`, right: `0 0 0 ${q}%` }[dir];
  // margem negativa nos outros lados para não cortar descendentes/serifas
  node.style.clipPath = p >= 1 ? 'none' : `inset(${inset.split(' ').map((v, i) => (v === '0' ? '-40%' : v)).join(' ')})`;
}

/** Quebra texto em spans por palavra ou letra. Retorna os spans. */
export function split(node, text, by = 'word') {
  node.textContent = '';
  const parts = by === 'char' ? [...text] : text.split(/(\s+)/);
  return parts.map((p) => {
    const s = el('span', { text: p, style: { display: 'inline-block', whiteSpace: 'pre' } }, node);
    return s;
  });
}

/** Mede retângulo de um nó relativo ao stage (chame no setup, com a câmera em identidade). */
export function measure(node, stage) {
  const a = node.getBoundingClientRect(), b = stage.getBoundingClientRect();
  return { x: a.left - b.left, y: a.top - b.top, w: a.width, h: a.height, cx: a.left - b.left + a.width / 2, cy: a.top - b.top + a.height / 2 };
}

// ---------- blur de movimento direcional ----------
// Um filtro SVG por elemento; stdDeviation segue velocidade (px/s) e direção.
let blurSvg;
const blurNodes = new Map();
function blurDefs() {
  if (!blurSvg) {
    blurSvg = el('svg', { attrs: { width: 0, height: 0 }, style: { position: 'absolute' } }, document.body);
    el('defs', {}, blurSvg);
  }
  return blurSvg.firstChild;
}
/**
 * posFn(t) -> [x, y]. Calcula velocidade por diferença finita e aplica blur só no eixo do movimento.
 * Abaixo de `minSpeed` o filtro é removido para o texto ficar nítido.
 */
export function motionBlur(node, id, posFn, t, { k = 0.012, minSpeed = 900, max = 26 } = {}) {
  const dt = 1 / 240;
  const [x1, y1] = posFn(t - dt), [x2, y2] = posFn(t + dt);
  const vx = (x2 - x1) / (2 * dt), vy = (y2 - y1) / (2 * dt);
  const sp = Math.hypot(vx, vy);
  if (sp < minSpeed) { node.style.filter = 'none'; return 0; }
  let f = blurNodes.get(id);
  if (!f) {
    const filter = el('filter', { attrs: { id: 'mb-' + id, x: '-50%', y: '-50%', width: '200%', height: '200%' } }, blurDefs());
    f = el('feGaussianBlur', { attrs: { stdDeviation: '0 0' } }, filter);
    blurNodes.set(id, f);
  }
  const amt = Math.min(max, (sp - minSpeed) * k);
  f.setAttribute('stdDeviation', `${(Math.abs(vx) / sp) * amt} ${(Math.abs(vy) / sp) * amt}`);
  node.style.filter = `url(#mb-${id})`;
  return amt;
}

// ---------- câmera ----------
/**
 * Câmera única do vídeo. `keys` = [{t, x, y, z}] (centro focado e zoom).
 * Soma um push contínuo de 1.00→1.04 por cena (cenas = lista de tempos de corte),
 * que volta a 1.00 durante a transição — a câmera nunca para e nunca salta.
 */
export function cameraAt(t, { cuts, W, H, focus = [] }) {
  // push por cena
  let push = 1;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i], b = cuts[i + 1];
    if (t >= a && t < b) {
      const p = invlerp(a, b, t);
      const ret = 0.22; // fração final da cena em que o push devolve a 1.0
      push = p < 1 - ret ? lerp(1, 1.04, p / (1 - ret)) : lerp(1.04, 1.0, cubicInOut((p - (1 - ret)) / ret));
    }
  }
  const f = focus.length ? keys(t, focus) : [W / 2, H / 2, 1];
  return { cx: f[0], cy: f[1], z: f[2] * push };
}
export function applyCamera(node, cam, W, H) {
  // leva (cx,cy) ao centro e escala em torno do centro
  const s = cam.z;
  const x = W / 2 - cam.cx * s, y = H / 2 - cam.cy * s;
  node.style.transformOrigin = '0 0';
  node.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
}

// ---------- vídeo ----------
/**
 * Registra o vídeo. A cena chama isso uma vez.
 * - marca: pasta em marcas/ (padrão 'keyve'); estilo: pasta em estilos/ (padrão = marca.estilo ou 'keyve')
 * - setup(stage, ctx): cria o DOM (pode ser async). Marca (M, C) e estilo (E) já estão carregados.
 * - render(t, ctx): define TODOS os estilos em função de t (pode devolver Promise, ex.: frame de filmagem)
 * - audio: trilha de motion { hits, big, riser, ticks } ou de vídeo falado { bed: { sections, sfx, end } }
 * - voice: { file, offset, edl, gain, bedGain, duck } para vídeos falados
 */
export function createVideo({ duration, format = '9x16', setup, render, audio = {}, title = '', subframes, voice, capture = 'jpeg', fps, marca = 'keyve', estilo }) {
  const F = FORMATS[format];
  const stage = document.querySelector('.stage') || el('div', { cls: 'stage' }, document.body);
  stage.style.setProperty('--W', F.W + 'px');
  stage.style.setProperty('--H', F.H + 'px');
  const ctx = { W: F.W, H: F.H, safe: F.safe, stage, duration, format };

  window.ready = (async () => {
    await loadMarca(marca);
    await loadEstilo(estilo || M.estilo || 'keyve');
    const bpm = E.bpm || MOTION.bpm;
    window.VIDEO = { duration, W: F.W, H: F.H, bpm, fps: fps ?? E.fps ?? MOTION.fps, subframes: subframes ?? MOTION.subframes, shutter: MOTION.shutter ?? 0.5, title, audio, voice, capture, marca, estilo: E.slug };
    await setup(stage, ctx);
    await Promise.all([...document.images].map((i) => (i.complete ? i.decode().catch(() => {}) : new Promise((r) => (i.onload = i.onerror = r)))));
    await document.fonts.ready;
    await window.seek(0);
    return true;
  })();
  // render pode devolver uma Promise (ex.: trocar o frame de uma filmagem e esperar o decode)
  window.seek = (t) => {
    const r = render(clamp(t, 0, duration), ctx);
    if (r && r.then) return r.then(() => void stage.offsetHeight);
    void stage.offsetHeight; // força layout síncrono
  };
  window.renderAudio = async () => {
    const A = await import('./audio.js');
    const bpm = window.VIDEO.bpm;
    // audio.bed = vídeo falado (trilha por seções + sfx); senão, trilha de motion (kick por batida)
    return audio.bed ? A.renderBed({ duration, bpm, ...audio.bed }) : A.renderSoundtrack({ duration, bpm, ...audio });
  };

  // Prévia no navegador: ?t=3.2 congela; ?play roda em tempo real (só para olhar, não para render).
  const q = new URLSearchParams(location.search);
  window.ready.then(() => {
    if (q.has('t')) window.seek(parseFloat(q.get('t')));
    if (q.has('play')) {
      const t0 = performance.now();
      let busy = false;
      const loop = async () => { if (!busy) { busy = true; await window.seek(((performance.now() - t0) / 1000) % duration); busy = false; } requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
    }
  });
  return ctx;
}
