// Renderer for "Giving Up Control". Draws the marble run from the Sim; all vocabulary comes from the manifest.
import { register } from '../_shared/loop-scene.js';
import { Sim } from './sim.js';

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); return e; };
const tr = ([x, y]) => `translate(${x}px, ${y}px)`;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// geometry of the track, in SVG user units
const P = {
  laneY: [82, 64], laneStart: 190,
  trap: i => [330, [82, 64][i]], drop: [346, 104], platformEnd: i => [450, [82, 64][i]], liftTop: i => [161, [82, 64][i]],
  pocket: [[326, 156], [370, 156], [414, 156]], pocketExit: [[326, 236], [370, 236], [414, 236]],
  chute: [[300, 236], [284, 258]], ramp: i => [200 + 40 * i, 254],
  liftBottom: [161, 254], trayDrop: [500, 140], tray: i => [488 + 12 * i, 189], trayOut: [500, 262], replyFrom: [290, 160],
};
// where a running marble sits on its lane after k ticks of its run segment: the first run ends at the trapdoor, the second crosses it
const RUN_X = { 0: [190], 2: [190, 390] };

const TEMPLATE = (m) => `
  <div class="ll-controls">
    <div class="ll-seg" role="group" aria-label="Runtime">
      ${m.variantOrder.map(k => `<button type="button" data-variant="${k}" aria-pressed="false">${esc(m.variants[k].label)}</button>`).join('')}
    </div>
    <button type="button" class="ll-btn ll-play" aria-pressed="true">Pause</button>
    <button type="button" class="ll-btn ll-step">Step</button>
    <label class="ll-speed">speed <select class="ll-speedsel">${Object.entries(m.timing.periods).map(([k, v]) => `<option value="${v}"${k === m.timing.default ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
    <span class="ll-tick">tick 0</span>
  </div>
  <p class="ll-note"></p>
  <div class="ll-scene">
    <svg class="ll-svg" viewBox="80 8 520 324" role="img" aria-label="Marble run showing one unit of work giving up control at a wait point">
      <rect x="150" y="70" width="22" height="220" rx="4" class="thin"/>
      <path d="M161 282 V82" class="thin dash"/>
      <rect class="carriage" x="152" y="262" width="18" height="6" rx="2"/>
      <g class="dial"><circle cx="161" cy="56" r="7" class="thin"/><path d="M161 56 V50" class="thin"/><path d="M161 56 L165 58" class="thin"/></g>
      <path class="gate" d="M175 242 V272"/>
      <text x="161" y="308" text-anchor="middle" class="t ll-lift-label"></text>

      <g class="lane2">
        <path d="M172 72 H330" class="rail-lit"/><path d="M352 72 H450" class="rail-lit"/><path d="M330 72 L346 104" class="rail-lit"/>
        <circle cx="330" cy="72" r="3" fill="var(--ll-ink)"/>
        <text x="178" y="62" class="t ll-lane2-label"></text>
      </g>
      <path d="M172 90 H330" class="rail-lit"/><path d="M352 90 H450" class="rail-lit"/><path d="M330 90 L346 104" class="rail-lit"/>
      <circle cx="330" cy="90" r="3" fill="var(--ll-ink)"/>

      <rect x="180" y="146" width="110" height="54" rx="4" class="thin dash"/>
      <text x="235" y="163" text-anchor="middle" class="t tk">outside world</text>
      <text x="235" y="177" text-anchor="middle" class="t">network, disk,</text>
      <text x="235" y="191" text-anchor="middle" class="t">or a timer</text>
      <path d="M290 160 H308" class="thin dash"/><path d="M302 156 L308 160 L302 164" class="thin"/>

      <path d="M312 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <path d="M356 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <path d="M400 130 v28 a14 14 0 0 0 28 0 v-28" class="rail"/>
      <circle cx="326" cy="116" r="6" class="ring"/><circle cx="326" cy="116" r="6" class="ring-fill" data-p="0"/>
      <circle cx="370" cy="116" r="6" class="ring"/><circle cx="370" cy="116" r="6" class="ring-fill" data-p="1"/>
      <circle cx="414" cy="116" r="6" class="ring"/><circle cx="414" cy="116" r="6" class="ring-fill" data-p="2"/>
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
    g.appendChild(body); gM.appendChild(g); g.style.transform = tr(P.ramp(d - 1)); els[d] = g;
  }
  function move(node, points, ms, delay = 0) {
    const last = tr(points[points.length - 1]);
    if (reduced || ms === 0) { node.style.transform = last; return; }
    const frames = [{ transform: node.style.transform || tr(points[0]) }, ...points.map(p => ({ transform: tr(p) }))];
    const a = node.animate(frames, { duration: ms, delay, easing: 'ease-in-out', fill: 'forwards' });
    a.onfinish = () => { node.style.transform = last; a.cancel(); };
  }
  function liftAct(ms) {
    if (reduced) return;
    const a = carriage.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-172px)', offset: 0.45 }, { transform: 'translateY(-172px)', offset: 0.6 }, { transform: 'translateY(0)' }], { duration: ms * 2.2, easing: 'ease-in-out' });
    a.onfinish = () => a.cancel();
  }
  function word(text, [x, y], cls = '', anchor = 'middle') {
    const t = el('text', { x, y, 'text-anchor': anchor, class: `word ${cls}` }); t.textContent = text;
    t.addEventListener('animationend', () => t.remove()); gW.appendChild(t);
  }
  function reply(p, ms) {
    const c = el('circle', { r: 5, class: 'reply' }); c.style.transform = tr(P.replyFrom); gR.appendChild(c);
    if (reduced) { c.remove(); return; }
    const a = c.animate([{ transform: tr(P.replyFrom) }, { transform: tr(P.pocket[p]) }], { duration: ms, easing: 'ease-in', fill: 'forwards' });
    a.onfinish = () => c.remove();
  }
  const CIRC = 2 * Math.PI * 6;
  function rings(sim) {
    for (const r of host.querySelectorAll('.ring-fill[data-p]')) {
      const m = sim.pockets[+r.dataset.p]; const frac = m ? m.left / M.skeleton[1].ticks : 0;
      r.setAttribute('stroke-dasharray', CIRC); r.setAttribute('stroke-dashoffset', CIRC * (1 - frac));
    }
  }
  const lanePos = m => { const xs = RUN_X[m.seg]; const k = Math.min(M.skeleton[m.seg].ticks - m.left, xs.length - 1); return [xs[k], P.laneY[m.slot]]; };

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
      h.s.forEach((loc, r) => {
        const cls = loc === 'slot' ? 'cell-run' : loc === 'pocket' ? 'cell-wait' : loc === 'ramp' ? 'cell-ready' : null;
        if (cls) trace.appendChild(el('rect', { x, y: ROWS[r], width: 22, height: 12, rx: 2, class: cls }));
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
    for (const b of host.querySelectorAll('[data-variant]')) b.setAttribute('aria-pressed', String(b.dataset.variant === key));
    $('.ll-lift-label').textContent = V.liftName;
    $('.ll-lane2-label').textContent = V.lane2;
    $('.lane2').classList.toggle('on', V.slots === 2);
    $('.dial').classList.toggle('on', V.preempt);
    $('.ll-note').textContent = V.note;
    for (let d = 1; d <= M.marbles; d++) els[d].querySelector('.body').style.transform = `scale(${V.weight})`;
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
      ['Pocket ring', ['', 'counts ticks until the reply lands.']],
      ['Red gate', ['', 'a marble is ready and every slot is taken. The lift holds until the running marble leaves.']],
      ['Dial', ['', V.preempt ? 'this lift can take a running marble off the platform on a timer. It never needs to in this scene, because every marble reaches the wait point. The next scene is where it matters.' : 'this lift has no dial. A marble leaves the platform only when it reaches the wait point. If it never did, nothing could remove it.']],
    ];
    $('.ll-legend').innerHTML = rows.map(([k, [w, gl]]) => `<span class="k">${esc(k)}</span><span>${w ? `<span class="w">${esc(w)}</span> ` : ''}<span class="g">${esc(gl)}</span></span>`).join('');
  }

  function render(ev, mid = false) {
    const ms = moveMs(), half = Math.round(ms / 2);
    const phrases = [];
    const paths = new Map();
    const add = (m, pts, delay = 0) => { const cur = paths.get(m.dots); if (cur) cur.points.push(...pts); else paths.set(m.dots, { points: pts, delay }); };
    let readyHeld = false, lifted = false;
    for (const e of ev) {
      const nm = e.m ? NAMES[e.m.dots - 1] : '';
      if (e.type === 'run') { add(e.m, [P.liftBottom, P.liftTop(e.slot), [P.laneStart, P.laneY[e.slot]]]); lifted = true; phrases.push(`Lift raises ${nm}.`); }
      else if (e.type === 'trap') { add(e.m, [P.trap(e.from), P.drop, P.pocket[e.pocket]]); phrases.push(`${cap(nm)} ${V.words.trap}.`); }
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
      add(m, [lanePos(m)]);
      phrases.push(`${cap(NAMES[m.dots - 1])} runs on, ${m.left} tick${m.left === 1 ? '' : 's'} of work left.`);
    }
    for (const m of sim.ramp) if (held0 && !ev.some(e => e.m === m)) phrases.push(`${cap(NAMES[m.dots - 1])} waits for a slot.`);
    for (const [dots, { points, delay }] of paths) move(els[dots], points, ms, delay);
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

  function tickOnce() { render(sim.step()); }
  function start() { stop(); host.style.setProperty('--ll-wordms', Math.round(period * M.timing.wordFraction) + 'ms'); if (playing && visible) timer = setInterval(tickOnce, period); }
  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  const playBtn = $('.ll-play');
  const setPlaying = p => { playing = p; playBtn.textContent = p ? 'Pause' : 'Play'; playBtn.setAttribute('aria-pressed', String(p)); start(); };

  host.querySelectorAll('[data-variant]').forEach(b => b.addEventListener('click', () => applyVariant(b.dataset.variant, true)));
  playBtn.addEventListener('click', () => setPlaying(!playing));
  $('.ll-step').addEventListener('click', () => { if (playing) setPlaying(false); tickOnce(); });
  $('.ll-speedsel').addEventListener('change', e => { period = +e.target.value; start(); });
  new IntersectionObserver(entries => { visible = entries[0].isIntersecting && !document.hidden; start(); }, { threshold: 0.2 }).observe(svg);
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; start(); });

  applyVariant(M.variants[initial] ? initial : M.anchor, false);
  sim.slotCount = V.slots;   // set the count only; the first raise belongs to tick 1
  rings(sim); drawTrace();
  $('.ll-caption').innerHTML = `<span class="ll-eyebrow">tick 0</span> &nbsp; ${cap(numberWord(M.marbles))} marbles are created on the ramp.`;
  start();
}

register('giving-up-control', mount);
