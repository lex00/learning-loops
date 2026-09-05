// Motion helpers shared by every renderer: SVG element creation and tweens driven by requestAnimationFrame.
// Positioning uses the SVG transform attribute, never CSS transforms:
// WebKit applies CSS transforms on SVG children in screen pixels, not user units, once a viewBox scales the drawing.
const NS = 'http://www.w3.org/2000/svg';
export const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const active = new WeakMap();
export const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
export function setPos(node, [x, y]) { node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`); node._pos = [x, y]; }
export function tween(node, points, ms, delay = 0, onDone, reduced = false, linear = false) {
  const prev = active.get(node); if (prev) cancelAnimationFrame(prev.raf);
  const pts = [node._pos || points[0], ...points];
  const lens = []; let total = 0;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); lens.push(d); total += d; }
  if (reduced || ms === 0 || total === 0) { setPos(node, points[points.length - 1]); if (onDone) onDone(); return; }
  // progress is measured on performance.now(), the same clock as the tick interval, never on frame timestamps
  const t0 = performance.now() + delay; const state = { raf: 0 };
  const frame = () => {
    const u = Math.min(1, Math.max(0, (performance.now() - t0) / ms));
    const e = (linear ? u : easeInOut(u)) * total;
    let acc = 0, i = 0; while (i < lens.length - 1 && acc + lens[i] < e) { acc += lens[i]; i++; }
    const f = lens[i] ? Math.min(1, (e - acc) / lens[i]) : 1;
    const a = pts[i], b = pts[i + 1];
    setPos(node, [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f]);
    if (u < 1) state.raf = requestAnimationFrame(frame); else { active.delete(node); if (onDone) onDone(); }
  };
  state.raf = requestAnimationFrame(frame); active.set(node, state);
}
export function tweenAngle(node, cx, cy, from, to, ms, delay = 0, reduced = false) {
  if (reduced || ms === 0) { node.setAttribute('transform', `rotate(${to} ${cx} ${cy})`); return; }
  const t0 = performance.now() + delay;
  const frame = () => { const u = Math.min(1, Math.max(0, (performance.now() - t0) / ms)); node.setAttribute('transform', `rotate(${(from + (to - from) * easeInOut(u)).toFixed(2)} ${cx} ${cy})`); if (u < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
export function tweenScale(node, from, to, ms, reduced = false) {
  if (reduced || ms === 0) { node.setAttribute('transform', `scale(${to})`); return; }
  const t0 = performance.now();
  const frame = () => { const u = Math.min(1, (performance.now() - t0) / ms); node.setAttribute('transform', `scale(${(from + (to - from) * easeInOut(u)).toFixed(3)})`); if (u < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
// run fn(u) for u from 0 to 1 over ms, after delay; for anything that is not a position
export function animate(ms, delay, fn, reduced = false) {
  if (reduced || ms === 0) { fn(1); return; }
  const t0 = performance.now() + delay;
  const frame = () => { const u = Math.min(1, Math.max(0, (performance.now() - t0) / ms)); fn(u); if (u < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
export const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const numberWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n);
