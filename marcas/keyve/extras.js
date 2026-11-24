// Extras só da Keyve: logos "Kyv." e "Keyve" com um <path> por letra (para animar letra a letra).
// Uso: import { KyvLogo, KeyveWordmark } from '../../marcas/keyve/extras.js';
import { el } from '../../engine/runtime.js';
import { C } from '../../engine/marca.js';
import { LOGOS } from './logos/letras.js';

/** "Kyv." com partes separadas (K, yv, dot, tm) e a geometria do ponto em px locais (dotLocal). */
export function KyvLogo(parent, { height = 200, color = C.tinta, dotColor = C.acento, tm = true } = {}) {
  const [vx, vy, vw, vh] = LOGOS.kyv.viewBox;
  const k = height / vh;
  const root = el('svg', { attrs: { viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw * k, height }, style: { position: 'absolute', overflow: 'visible' } }, parent);
  const mk = (d) => el('path', { attrs: { d, fill: color } }, root);
  const K = mk(LOGOS.kyv.K), yv = mk(LOGOS.kyv.yv), dot = mk(LOGOS.kyv.dot);
  dot.setAttribute('fill', dotColor);
  const tmP = tm ? mk(LOGOS.kyv.tm) : null;
  const b = LOGOS.kyv.dotBox;
  return { root, K, yv, dot, tm: tmP, width: vw * k, height, scale: k, dotLocal: { x: (b.x - vx) * k, y: (b.y - vy) * k, w: b.w * k, h: b.h * k } };
}

/** "Keyve" com uma letra por <path> (K, e1, y, v, e2, tm). */
export function KeyveWordmark(parent, { height = 80, color = C.tinta } = {}) {
  const [vx, vy, vw, vh] = LOGOS.keyve.viewBox;
  const k = height / vh;
  const root = el('svg', { attrs: { viewBox: `${vx} ${vy} ${vw} ${vh}`, width: vw * k, height }, style: { position: 'absolute', overflow: 'visible' } }, parent);
  const parts = {};
  for (const key of ['K', 'e1', 'y', 'v', 'e2', 'tm']) parts[key] = el('path', { attrs: { d: LOGOS.keyve[key], fill: color } }, root);
  return { root, ...parts, width: vw * k, height };
}
