// Renderer for "Waiting on I/O". Draws the marble run from the Sim; all vocabulary comes from the manifest.
import { register } from '../_shared/loop-scene.js';
import { Sim } from './sim.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
// Positioning uses the SVG transform attribute driven by requestAnimationFrame, never CSS transforms:
// WebKit applies CSS transforms on SVG children in screen pixels, not user units, once a viewBox scales the drawing.
const active = new WeakMap();
const easeInOut = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function setPos(node, [x, y]) { node.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`); node._pos = [x, y]; }
function tween(node, points, ms, delay = 0, onDone, reduced = false, linear = false) {
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
function tweenAngle(node, cx, cy, from, to, ms, delay = 0, reduced = false) {
  if (reduced || ms === 0) { node.setAttribute('transform', `rotate(${to} ${cx} ${cy})`); return; }
  const t0 = performance.now() + delay;
  const frame = () => { const u = Math.min(1, Math.max(0, (performance.now() - t0) / ms)); node.setAttribute('transform', `rotate(${(from + (to - from) * easeInOut(u)).toFixed(2)} ${cx} ${cy})`); if (u < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
function tweenScale(node, from, to, ms, reduced = false) {
  if (reduced || ms === 0) { node.setAttribute('transform', `scale(${to})`); return; }
  const t0 = performance.now();
  const frame = () => { const u = Math.min(1, (performance.now() - t0) / ms); node.setAttribute('transform', `scale(${(from + (to - from) * easeInOut(u)).toFixed(3)})`); if (u < 1) requestAnimationFrame(frame); };
  requestAnimationFrame(frame);
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// geometry of the track, in SVG user units
const P = {
  laneY: [82, 64], laneStart: 190, beat: 130,
  trap: i => [320, [82, 64][i]], drop: [336, 104], platformEnd: i => [450, [82, 64][i]], liftTop: i => [161, [82, 64][i]],
  pocket: [[326, 156], [370, 156], [414, 156]], pocketExit: [[326, 236], [370, 236], [414, 236]],
  chute: [[300, 236], [284, 258]], ramp: i => [200 + 40 * i, 254],
  liftBottom: [161, 254], trayDrop: [500, 140], tray: i => [488 + 12 * i, 189], trayOut: [500, 262], replyFrom: [290, 160],
  hook: [128, 96], tokenLift: [0, -14],
};
const lift = ([x, y]) => [x + P.tokenLift[0], y + P.tokenLift[1]];

const DEVICES = `
      <g class="ll-devices">
        <rect x="180" y="146" width="110" height="54" rx="4" class="thin dash"/>
        <g class="thin"><circle cx="200" cy="166" r="8"/><ellipse cx="200" cy="166" rx="3.5" ry="8"/><path d="M192 166 H208"/></g>
        <g class="thin"><ellipse cx="235" cy="159" rx="8" ry="3"/><path d="M227 159 V173 a8 3 0 0 0 16 0 V159"/><path d="M227 166 a8 3 0 0 0 16 0"/></g>
        <g class="thin"><circle cx="270" cy="166" r="8"/><path d="M270 166 V160"/><path d="M270 166 L274 168"/></g>
        <text x="200" y="192" text-anchor="middle" class="t ts">net</text>
        <text x="235" y="192" text-anchor="middle" class="t ts">disk</text>
        <text x="270" y="192" text-anchor="middle" class="t ts">timer</text>
        <path d="M290 160 H308" class="thin dash"/><path d="M302 156 L308 160 L302 164" class="thin"/>
      </g>`;

const TEMPLATE = (m) => `
  <div class="ll-controls">
    <label class="ll-pick">runtime <select class="ll-variant" aria-label="Runtime">${m.variantOrder.map(k => `<option value="${k}">${esc(m.variants[k].label)}</option>`).join('')}</select></label>
    <div class="ll-transport" role="group" aria-label="Playback">
      <button type="button" class="ll-btn ll-play" aria-pressed="true"><span class="ll-glyph">&#10074;&#10074;</span>Pause</button>
      <button type="button" class="ll-btn ll-step"><span class="ll-glyph">&#9654;&#10073;</span>Step</button>
      <label class="ll-speed">speed <select class="ll-speedsel">${Object.entries(m.timing.periods).map(([k, v]) => `<option value="${v}"${k === m.timing.default ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
    </div>
    <span class="ll-tick">tick 0</span>
  </div>
  <p class="ll-note"></p>
  <div class="ll-scene">
    <svg class="ll-svg" viewBox="80 8 520 324" role="img" aria-label="Marble run showing one unit of work giving up control at a wait point">
      <rect x="150" y="70" width="22" height="220" rx="4" class="thin"/>
      <path d="M161 282 V82" class="thin dash"/>
      <rect class="carriage" x="152" y="262" width="18" height="6" rx="2" transform="translate(0 0)"/>
      <path class="thin ll-hook" d="M150 96 H136"/>
      <g class="ll-token" transform="translate(128 96)"><path class="shackle" d="M-4 -3 a4 4 0 0 1 8 0 V0"/><rect x="-8.5" y="0" width="17" height="10" rx="2"/><text y="7.6" text-anchor="middle">GIL</text></g>
      <path class="gate" d="M175 242 V272"/>
      <text x="161" y="308" text-anchor="middle" class="t ll-lift-label"></text>

      <rect class="ll-beat" x="172" y="12" width="0" height="3" rx="1.5"/>
      <g class="lane2">
        <path d="M172 72 H320" class="rail-lit"/><path d="M342 72 H450" class="rail-lit"/>
        <path d="M320 72 H342" class="rail-lit flap" data-lane="1" transform="rotate(0 320 72)"/>
        <circle cx="320" cy="72" r="3" fill="var(--ll-ink)"/>
        <path d="M190 75 v5 M320 75 v5 M450 75 v5" class="thin ruler"/>
        <text x="214" y="62" class="t ll-lane2-label"></text>
      </g>
      <g class="claw">
        <path d="M372 30 H448" class="thin"/>
        <circle cx="384" cy="30" r="7" class="thin"/><path class="thin hand" d="M384 30 V24" transform="rotate(0 384 30)"/>
        <path d="M410 30 V46" class="thin"/><path d="M402 46 H418" class="thin"/><path d="M402 46 V54" class="thin"/><path d="M418 46 V54" class="thin"/>
      </g>
      <path d="M172 90 H320" class="rail-lit"/><path d="M342 90 H450" class="rail-lit"/>
      <path d="M320 90 H342" class="rail-lit flap" data-lane="0" transform="rotate(0 320 90)"/>
      <circle cx="320" cy="90" r="3" fill="var(--ll-ink)"/>
      <path d="M190 93 v5 M320 93 v5 M450 93 v5" class="thin ruler"/>

      ${DEVICES}

      <path d="M312 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <path d="M356 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <path d="M400 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <circle cx="326" cy="116" r="6" class="ring"/><circle cx="326" cy="116" r="6" class="ring-fill" data-p="0" transform="rotate(-90 326 116)"/>
      <circle cx="370" cy="116" r="6" class="ring"/><circle cx="370" cy="116" r="6" class="ring-fill" data-p="1" transform="rotate(-90 370 116)"/>
      <circle cx="414" cy="116" r="6" class="ring"/><circle cx="414" cy="116" r="6" class="ring-fill" data-p="2" transform="rotate(-90 414 116)"/>
      <path d="M326 172 V236" class="thin"/><path d="M370 172 V236" class="thin"/><path d="M414 172 V236" class="thin"/>
      <path d="M300 236 H440" class="thin"/><path d="M300 236 L284 258" class="thin"/>

      <path d="M450 90 C480 90 500 110 500 140 V180" class="rail"/>
      <path d="M478 182 h44 v14 h-44 z" class="rail"/>
      <text x="540" y="192" class="t tk">done</text>
      <path d="M500 196 V262" class="thin dash"/>

      <path d="M560 262 H172" class="rail"/><path d="M184 256 L174 262 L184 268" class="thin"/>
      <text x="346" y="290" text-anchor="middle" class="t tk">runnable</text>

      <g class="ll-replies"></g><g class="ll-marbles"></g><g class="ll-words"></g>
    </svg>
    <div class="ll-trace-wrap">
      <svg class="ll-trace" viewBox="0 0 720 74" role="img" aria-label="Trace of the last ticks, one row per marble"></svg>
      <div class="ll-tkey"><span>trace, one column per tick</span><span><i class="k-run"></i>running</span><span><i class="k-wait"></i>waiting for a reply</span><span><i class="k-ready"></i>ready, queued on the ramp</span><span>&#9662; runtime toggled</span></div>
    </div>
  </div>
  <p class="ll-caption"></p>
  <div class="ll-legend"></div>
  <p class="ll-look">${esc(m.look)}</p>
`;

export function mount(host, M) {
  host.innerHTML = TEMPLATE(M);
  const $ = sel => host.querySelector(sel);
  const svg = $('.ll-svg'), gM = $('.ll-marbles'), gW = $('.ll-words'), gR = $('.ll-replies'), carriage = $('.carriage'), trace = $('.ll-trace');
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const NAMES = M.names;

  // ----- marbles -----
  const els = {};
  const dotOffsets = n => n === 1 ? [0] : n === 2 ? [-3.2, 3.2] : [-4.4, 0, 4.4];
  for (let d = 1; d <= M.marbles; d++) {
    const g = el('g', { class: 'marble' }), body = el('g', { class: 'body' });
    body.appendChild(el('circle', { r: 7, class: 'm' }));
    for (const o of dotOffsets(d)) body.appendChild(el('circle', { cx: o, r: 1.5, class: 'd' }));
    g.appendChild(body); gM.appendChild(g); setPos(g, P.ramp(d - 1)); body.setAttribute('transform', 'scale(1)'); els[d] = g;
  }
  let scaleNow = 1;
  const move = (node, points, ms, delay = 0) => tween(node, points, ms, delay, null, reduced);
  const tokenPath0 = () => [lift(P.liftTop(0)), lift([P.laneStart, P.laneY[0]])];
  function liftAct(ms) {
    if (reduced) return;
    setPos(carriage, [0, 0]);
    tween(carriage, [[0, -172], [0, 0]], ms * 2.2, 0, null, reduced);
  }
  function word(text, [x, y], cls = '', anchor = 'middle') {
    const t = el('text', { x, y, 'text-anchor': anchor, class: `word ${cls}` }); t.textContent = text;
    t.addEventListener('animationend', () => t.remove()); gW.appendChild(t);
  }
  function request(p, ms, delay) {
    const c = el('circle', { r: 4, class: 'request' }); gR.appendChild(c); setPos(c, P.pocket[p]);
    if (reduced) { c.remove(); return; }
    tween(c, [P.replyFrom], ms, delay, () => c.remove(), reduced);
  }
  function flap(lane, ms) {
    const f = host.querySelector(`.flap[data-lane="${lane}"]`); const cy = P.laneY[lane] + 8;
    tweenAngle(f, 320, cy, 0, 55, Math.round(ms * 0.35), 0, reduced);
    tweenAngle(f, 320, cy, 55, 0, Math.round(ms * 0.3), Math.round(ms * 0.85), reduced);
  }
  function reply(p, ms) {
    const c = el('circle', { r: 5, class: 'reply' }); gR.appendChild(c); setPos(c, P.replyFrom);
    if (reduced) { c.remove(); return; }
    tween(c, [P.pocket[p]], ms, 0, () => c.remove(), reduced);
  }
  const CIRC = 2 * Math.PI * 6;
  function rings(sim) {
    for (const r of host.querySelectorAll('.ring-fill[data-p]')) {
      const m = sim.pockets[+r.dataset.p]; const frac = m ? m.left / M.skeleton[1].ticks : 0;
      r.setAttribute('stroke-dasharray', CIRC); r.setAttribute('stroke-dashoffset', CIRC * (1 - frac));
    }
  }

  // ----- trace strip -----
  const COLS = 25, X0 = 40, CW = 27, ROWS = [10, 32, 54];
  let history = [], pendingToggle = false;
  function recordTrace(sim, cycleStart) {
    history.push({ s: sim.locs(), cycleStart, toggled: pendingToggle }); pendingToggle = false;
    if (history.length > COLS) history.shift();
    drawTrace();
  }
  function drawTrace() {
    trace.innerHTML = '';
    for (let r = 0; r < M.marbles; r++) {
      trace.appendChild(el('circle', { cx: 18, cy: ROWS[r] + 6, r: 6, fill: 'var(--ll-marble)' }));
      for (const o of dotOffsets(r + 1)) trace.appendChild(el('circle', { cx: 18 + o, cy: ROWS[r] + 6, r: 1.4, fill: 'var(--ll-ground)' }));
    }
    history.forEach((h, i) => {
      const x = X0 + i * CW;
      if (h.cycleStart) trace.appendChild(el('line', { x1: x - 2.5, y1: 4, x2: x - 2.5, y2: 70, class: 'cycle' }));
      if (h.toggled) trace.appendChild(el('path', { d: `M${x + 7} 1 l8 0 l-4 5 z`, class: 'vmark' }));
      const newest = i === history.length - 1;
      h.s.forEach((loc, r) => {
        const cls = loc === 'slot' ? 'cell-run' : loc === 'pocket' ? 'cell-wait' : loc === 'ramp' ? 'cell-ready' : null;
        if (cls) trace.appendChild(el('rect', { x, y: ROWS[r], width: 22, height: 12, rx: 2, class: cls + (newest ? ' cell-new' : '') }));
      });
    });
  }

  // ----- controller -----
  const initial = new URLSearchParams(location.search).get('variant');
  let V = M.variants[M.variants[initial] ? initial : M.anchor];
  const sim = new Sim(M, V.slots);
  let period = M.timing.periods[M.timing.default], timer = null, playing = true, visible = true;
  const moveMs = () => Math.round(period * M.timing.moveFraction);

  function applyVariant(key, fromToggle) {
    V = M.variants[key];
    $('.ll-variant').value = key;
    $('.ll-lift-label').textContent = V.liftName;
    $('.ll-lane2-label').textContent = V.lane2;
    $('.lane2').classList.toggle('on', V.slots === 2);
    $('.claw').classList.toggle('on', V.preempt);
    spinDial(V.preempt);
    const token = $('.ll-token'); token.classList.toggle('on', !!V.token); $('.ll-hook').classList.toggle('on', !!V.token);
    if (V.token) { const m = sim.slots[0]; setPos(token, m && els[m.dots]._pos ? lift(els[m.dots]._pos) : P.hook); }
    $('.ll-note').textContent = V.note;
    for (let d = 1; d <= M.marbles; d++) tweenScale(els[d].querySelector('.body'), scaleNow, V.weight, fromToggle ? 400 : 0, reduced);
    scaleNow = V.weight;
    renderLegend();
    if (fromToggle) { pendingToggle = true; render(sim.setSlots(V.slots), true); }
  }
  function renderLegend() {
    const g = V.gloss;
    const rows = [
      ['Marble', g.marble], ['Slot', g.slot], ['Lift', g.lift],
      ['At the trapdoor', g.trap], ['When the reply lands', g.ready],
      ['On the platform', ['', g.run[1] + ' No word fires here: the green marble travelling along its lane says it.']],
      ['Into the tray', g.done],
      ['Lock', g.token],
      ['Pocket ring', ['', 'counts ticks until the reply lands.']],
      ['Red gate', ['', 'a marble is ready and every slot is taken. The lift holds until the running marble leaves.']],
      ['Claw', ['', V.preempt ? 'the scheduler\'s clock hangs over the platform. When a running marble\'s time slice ends, the claw can lift it off and put it back on the ramp. In this scene every marble leaves before that happens. The next scene is where the claw comes down.' : 'no claw. Nothing can take a marble off the platform. It leaves only when it reaches the wait point, and if it never did, nothing could remove it.']],
    ];
    $('.ll-legend').innerHTML = rows.map(([k, [w, gl]]) => `<span class="k">${esc(k)}</span><span>${w ? `<span class="w">${esc(w)}</span> ` : ''}<span class="g">${esc(gl)}</span></span>`).join('');
  }

  function render(ev, mid = false) {
    const ms = moveMs(), half = Math.round(ms / 2);
    const phrases = [];
    const paths = new Map();
    const add = (m, pts, delay = 0) => { const cur = paths.get(m.dots); if (cur) cur.points.push(...pts); else paths.set(m.dots, { points: pts, delay }); };
    let readyHeld = false, lifted = false, tokenPath = null;
    const glides = new Map();   // dots -> [x, y] the marble glides to, at steady speed, until its run ends
    for (const e of ev) {
      if (V.token) {
        if (e.type === 'run' && e.slot === 0) tokenPath = tokenPath0();
        else if ((e.type === 'trap' || e.type === 'done') && e.from === 0) tokenPath = [P.hook];
      }
      const nm = e.m ? NAMES[e.m.dots - 1] : '';
      if (e.type === 'run') {
        add(e.m, [P.liftBottom, P.liftTop(e.slot), [P.laneStart, P.laneY[e.slot]]]); lifted = true; phrases.push(`Lift raises ${nm}.`);
        glides.set(e.m.dots, { to: [P.laneStart + P.beat * M.skeleton[e.m.seg].ticks, P.laneY[e.slot]], ticks: M.skeleton[e.m.seg].ticks });
      }
      else if (e.type === 'trap') { add(e.m, [P.trap(e.from), P.drop, P.pocket[e.pocket]]); flap(e.from, ms); request(e.pocket, Math.round(ms * 0.6), ms); phrases.push(`${cap(nm)} ${V.words.trap} and asks the outside world.`); }
      else if (e.type === 'ready') {
        reply(e.pocket, half);
        add(e.m, [P.pocketExit[e.pocket], P.chute[0], P.chute[1], P.ramp(Math.max(0, sim.ramp.indexOf(e.m)))], half);
        phrases.push(`${cap(nm)}'s reply arrives from outside. ${cap(V.words.ready)}.`); readyHeld = true;
      }
      else if (e.type === 'done') { const k = sim.tray.indexOf(e.m); add(e.m, [P.platformEnd(e.from), P.trayDrop, P.tray(k < 0 ? M.marbles - 1 : k)]); phrases.push(`${cap(nm)} ${V.words.done}.`); }
      else if (e.type === 'recycle') { for (const m of sim.marbles) add(m, [P.trayOut, P.ramp(m.dots - 1)], half); phrases.push(`The tray tips. ${cap(numberWord(M.marbles))} marbles are created.`); }
      else if (e.type === 'demote') { add(e.m, [P.liftTop(1), P.liftBottom, P.ramp(0)]); phrases.push(`The second slot closes. ${cap(nm)} goes back to the front of the ramp.`); }
    }
    sim.ramp.forEach((m, i) => { if (!paths.has(m.dots)) add(m, [P.ramp(i)]); });
    const held0 = sim.held();
    for (const m of sim.slots) {
      if (!m || paths.has(m.dots)) continue;
      phrases.push(`${cap(NAMES[m.dots - 1])} runs on, ${m.left} tick${m.left === 1 ? '' : 's'} of work left.`);
    }
    for (const m of sim.ramp) if (held0 && !ev.some(e => e.m === m)) phrases.push(`${cap(NAMES[m.dots - 1])} waits for a slot.`);
    for (const [dots, { points, delay }] of paths) {
      const g = glides.get(dots);
      if (!g) { move(els[dots], points, ms, delay); continue; }
      // raise, then glide at steady speed so the run ends exactly on its last beat
      const glideMs = Math.max(1, g.ticks * period - ms);
      tween(els[dots], points, ms, delay, () => tween(els[dots], [g.to], glideMs, 0, null, reduced, true), reduced);
      if (V.token && sim.slots[0] && sim.slots[0].dots === dots) tokenPath = null,
        tween($('.ll-token'), tokenPath0(), ms, delay, () => tween($('.ll-token'), [lift(g.to)], glideMs, 0, null, reduced, true), reduced);
    }
    if (V.token && tokenPath) move($('.ll-token'), tokenPath, ms);
    if (lifted) liftAct(ms);
    for (let d = 1; d <= M.marbles; d++) els[d].classList.toggle('lit', sim.slots.some(m => m && m.dots === d));
    rings(sim);

    const held = sim.held(), idle = sim.idle();
    svg.classList.toggle('held', held); svg.classList.toggle('idle', idle);
    if (readyHeld && held && !lifted) { word('holds', [140, 250], 'hold', 'end'); phrases.push(`<b class="hold">The ${sim.slotCount === 1 ? 'slot is' : 'slots are'} taken. The lift holds.</b>`); }
    if (idle) phrases.push('<b>Every marble is waiting. Nothing runs.</b>');

    if (!mid) recordTrace(sim, ev.some(e => e.type === 'recycle'));
    $('.ll-caption').innerHTML = (mid ? '' : `<span class="ll-eyebrow">tick ${sim.cycleTick}</span> &nbsp; `) + phrases.join(' ');
    $('.ll-tick').textContent = `tick ${sim.tick}`;
  }
  const numberWord = n => ['zero', 'one', 'two', 'three', 'four', 'five', 'six'][n] || String(n);

  let dialRaf = 0;
  function spinDial(on) {
    cancelAnimationFrame(dialRaf); const hand = $('.claw .hand');
    if (!on || reduced) { hand.setAttribute('transform', 'rotate(0 384 30)'); return; }
    const frame = () => { hand.setAttribute('transform', `rotate(${((performance.now() % period) / period * 360).toFixed(1)} 384 30)`); dialRaf = requestAnimationFrame(frame); };
    dialRaf = requestAnimationFrame(frame);
  }
  let lastBeat = performance.now(), beatRaf = 0;
  function beatLoop() {
    cancelAnimationFrame(beatRaf); const bar = $('.ll-beat');
    const frame = () => { const f = playing ? Math.min(1, (performance.now() - lastBeat) / period) : 0; bar.setAttribute('width', (278 * f).toFixed(1)); beatRaf = requestAnimationFrame(frame); };
    beatRaf = requestAnimationFrame(frame);
  }
  function tickOnce() { lastBeat = performance.now(); render(sim.step()); }
  function start() { stop(); host.style.setProperty('--ll-wordms', Math.round(period * M.timing.wordFraction) + 'ms'); if (playing && visible) timer = setInterval(tickOnce, period); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  const playBtn = $('.ll-play');
  const setPlaying = p => { playing = p; playBtn.innerHTML = p ? '<span class="ll-glyph">&#10074;&#10074;</span>Pause' : '<span class="ll-glyph">&#9654;</span>Play'; playBtn.setAttribute('aria-pressed', String(p)); start(); };

  $('.ll-variant').addEventListener('change', e => applyVariant(e.target.value, true));
  playBtn.addEventListener('click', () => setPlaying(!playing));
  $('.ll-step').addEventListener('click', () => { if (playing) setPlaying(false); tickOnce(); });
  $('.ll-speedsel').addEventListener('change', e => { period = +e.target.value; start(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting && !document.hidden; start(); }, { threshold: 0.2 }).observe(svg);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; start(); });

  applyVariant(M.variants[initial] ? initial : M.anchor, false);
  sim.slotCount = V.slots;   // set the count only; the first raise belongs to tick 1
  rings(sim); drawTrace(); beatLoop();
  $('.ll-caption').innerHTML = `<span class="ll-eyebrow">tick 0</span> &nbsp; ${cap(numberWord(M.marbles))} marbles are created on the ramp.`;
  start();
}

register('waiting-on-io', mount);
