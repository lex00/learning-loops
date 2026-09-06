// Renderer for "Yielding". Draws the marble run from the Sim; all vocabulary comes from the manifest.
// The Truly parallel track with a yield point a third of the way along each lane, where every marble steps off.
import { register } from '../_shared/loop-scene.js';
import { el, setPos, tween, tweenScale, animate, easeInOut, cap, esc, numberWord } from '../_shared/motion.js';
import { Sim } from './sim.js';

// geometry of the track, in SVG user units
const LANE_Y = [82, 54];
const P = {
  laneY: LANE_Y, laneStart: 190, laneEnd: 450, beat: 260 / 3,
  liftTop: i => [161, LANE_Y[i]], platformEnd: i => [450, LANE_Y[i]], gate: i => [190, LANE_Y[i]],
  ramp: i => [200 + 40 * i, 254], rampY: 254, liftBottom: [161, 254], trayDrop: [500, 140], tray: i => [488 + 12 * i, 189], trayOut: [500, 262],
  hook: [128, 96], tokenLift: [0, -14],
  clawRailY: 24, clawHome: 470, jawsBottom: 17,
};
const lift = ([x, y]) => [x + P.tokenLift[0], y + P.tokenLift[1]];
const RULER = (y) => `M190 ${y} v5 M276.7 ${y} v5 M363.3 ${y} v5 M450 ${y} v5`;

const TEMPLATE = (m) => `
  <div class="ll-controls">
    <label class="ll-pick">runtime <select class="ll-variant" aria-label="Runtime">${Object.entries(m.schedules).map(([k, s]) => `<optgroup label="${esc(s.label)}">${m.variantOrder.filter(v => m.variants[v].schedule === k).map(v => `<option value="${v}">${esc(m.variants[v].label)}</option>`).join('')}</optgroup>`).join('')}</select></label>
    <div class="ll-transport" role="group" aria-label="Playback">
      <button type="button" class="ll-btn ll-play" aria-pressed="true"><span class="ll-glyph">&#10074;&#10074;</span>Pause</button>
      <button type="button" class="ll-btn ll-step"><span class="ll-glyph">&#9654;&#10073;</span>Step</button>
      <label class="ll-speed">speed <select class="ll-speedsel">${Object.entries(m.timing.periods).map(([k, v]) => `<option value="${v}"${k === m.timing.default ? ' selected' : ''}>${k}</option>`).join('')}</select></label>
    </div>
    <span class="ll-tick">tick 0</span>
  </div>
  <p class="ll-note"></p>
  <div class="ll-scene">
    <svg class="ll-svg" viewBox="80 8 520 324" role="img" aria-label="Marble run showing units of work that step off their lane on purpose partway through, on one or two lanes">
      <rect x="150" y="70" width="22" height="220" rx="4" class="thin"/>
      <path d="M161 282 V82" class="thin dash"/>
      <rect class="carriage" x="152" y="262" width="18" height="6" rx="2" transform="translate(0 0)"/>
      <path class="thin ll-hook" d="M150 96 H136"/>
      <g class="ll-token" transform="translate(128 96)"><path class="shackle" d="M-4 -3 a4 4 0 0 1 8 0 V0"/><rect x="-8.5" y="0" width="17" height="10" rx="2"/><text y="7.6" text-anchor="middle">GIL</text></g>
      <path class="gate" d="M175 242 V272"/>
      <text x="161" y="308" text-anchor="middle" class="t ll-lift-label"></text>

      <rect class="ll-beat" x="172" y="14" width="0" height="3" rx="1.5"/>
      <path d="M180 24 H476" class="thin dash ll-claw-rail"/>
      <text x="486" y="28" class="t ll-claw-label"></text>
      <g class="lane2">
        <path d="M172 62 H450" class="rail-lit"/>
        <circle cx="276.7" cy="62" r="3" fill="var(--ll-ink)"/>
        <path d="${RULER(65)}" class="thin ruler"/>
        <text x="214" y="40" class="t ll-lane2-label"></text>
      </g>
      <path d="M172 90 H450" class="rail-lit"/>
      <circle cx="276.7" cy="90" r="3" fill="var(--ll-ink)"/>
      <path d="${RULER(93)}" class="thin ruler"/>
      <path class="gatebar" data-lane="1" d="M206 42 V66"/>
      <path class="gatebar" data-lane="0" d="M206 70 V94"/>
      <text x="200" y="108" class="t ts ll-gate-label"></text>

      <path d="M450 90 C480 90 500 110 500 140 V180" class="rail"/>
      <path d="M478 182 h44 v14 h-44 z" class="rail"/>
      <text x="540" y="192" class="t tk">done</text>
      <path d="M500 196 V262" class="thin dash"/>

      <path d="M560 262 H172" class="rail"/><path d="M184 256 L174 262 L184 268" class="thin"/>
      <text x="346" y="290" text-anchor="middle" class="t tk">runnable</text>
      <text x="346" y="304" text-anchor="middle" class="t">waiting for a lane</text>

      <g class="ll-marbles"></g>
      <g class="ll-claw" transform="translate(470 24)"><g class="jaws" transform="translate(0 0)"><path class="cable" d="M0 0 V7"/><path d="M-8 7 H8 M-8 7 V17 M8 7 V17"/></g></g>
      <g class="ll-words"></g>
    </svg>
    <div class="ll-trace-wrap">
      <svg class="ll-trace" viewBox="0 0 720 74" role="img" aria-label="Trace of the last ticks, one row per marble"></svg>
      <div class="ll-schedules"></div>
      <div class="ll-tkey"><span>trace, one column per tick</span><span><i class="k-run"></i>moving</span><span><i class="k-gate"></i>at the gate</span><span><i class="k-ready"></i>runnable, waiting for a lane</span><span><i class="k-end"></i>done</span><span>&#9662; runtime toggled</span></div>
    </div>
  </div>
  <p class="ll-caption"></p>
  <div class="ll-legend"></div>
  <p class="ll-look">${esc(m.look)}</p>
`;

export function mount(host, M) {
  host.innerHTML = TEMPLATE(M);
  const $ = sel => host.querySelector(sel);
  const svg = $('.ll-svg'), gM = $('.ll-marbles'), gW = $('.ll-words'), carriage = $('.carriage'), trace = $('.ll-trace');
  const claw = $('.ll-claw'), jaws = $('.ll-claw .jaws'), cable = $('.ll-claw .cable');
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
  setPos(claw, [P.clawHome, P.clawRailY]);
  const move = (node, points, ms, delay = 0) => tween(node, points, ms, delay, null, reduced);
  function liftAct(ms) {
    if (reduced) return;
    setPos(carriage, [0, 0]);
    tween(carriage, [[0, -172], [0, 0]], ms * 2.2, 0, null, reduced);
  }
  function word(text, [x, y], cls = '', anchor = 'middle') {
    if (!text) return;
    const t = el('text', { x, y, 'text-anchor': anchor, class: `word ${cls}` }); t.textContent = text;
    t.addEventListener('animationend', () => t.remove()); gW.appendChild(t);
  }
  // the claw's jaws hang from the rail on a cable; dy is how far below the rail they are
  function jawsTo(from, to, ms, delay) {
    animate(ms, delay, u => {
      const dy = from + (to - from) * easeInOut(u);
      jaws.setAttribute('transform', `translate(0 ${dy.toFixed(2)})`); cable.setAttribute('d', `M0 ${(-dy).toFixed(2)} V7`);
    }, reduced);
  }
  const busy = new Set();   // marbles the claw is carrying, which the ramp must not reposition
  // the claw slides over the marble, drops onto it, lowers it to the ramp, lets go, and retracts
  function clawPull(m, ms) {
    const node = els[m.dots], [x, y] = node._pos, r = 7 * scaleNow;
    const k = sim.ramp.indexOf(m); const slot = P.ramp(k < 0 ? M.marbles - 1 : k);
    if (y === P.laneY[1]) word(V.words.claw, [x, y - 18], 'hold'); else word(V.words.claw, [x + 14, y + 26], 'hold', 'start');
    if (reduced) { setPos(node, slot); return; }
    busy.add(m.dots);
    const t = f => Math.round(ms * f);
    const dyGrab = y - r - (P.clawRailY + P.jawsBottom), dyRamp = P.rampY - r - (P.clawRailY + P.jawsBottom);
    tween(claw, [[x, P.clawRailY]], t(0.3), 0, null, reduced);
    jawsTo(0, dyGrab, t(0.25), t(0.3));
    jawsTo(dyGrab, dyRamp, t(0.5), t(0.55));
    tween(node, [[x, P.rampY]], t(0.5), t(0.55), () => {
      jawsTo(dyRamp, 0, t(0.35), 0);
      tween(node, [slot], t(0.35), 0, () => busy.delete(m.dots), reduced);
      tween(claw, [[P.clawHome, P.clawRailY]], t(0.3), t(0.35), null, reduced);
    }, reduced);
  }

  // ----- trace strip -----
  const COLS = 25, X0 = 40, CW = 27, ROWS = [10, 32, 54];
  let history = [], pendingToggle = false;
  const cellClass = loc => loc === 'slot' ? 'cell-run' : loc === 'gate' ? 'cell-gate' : loc === 'ramp' ? 'cell-ready' : null;
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
        const cls = cellClass(loc);
        if (cls) trace.appendChild(el('rect', { x, y: ROWS[r], width: newest ? 0.5 : 22, height: 12, rx: 2, class: cls + (newest ? ' cell-new' : '') }));
        else if (loc === 'tray' && (i === 0 || history[i - 1].s[r] !== 'tray')) trace.appendChild(el('rect', { x, y: ROWS[r], width: 2.5, height: 12, class: 'cell-end' }));
      });
    });
  }

  // ----- controller -----
  const initial = new URLSearchParams(location.search).get('variant');
  let V = M.variants[M.variants[initial] ? initial : M.anchor], S = M.schedules[V.schedule];
  const sim = new Sim(M, V.schedule);
  let period = M.timing.periods[M.timing.default], timer = null, playing = true, visible = true;
  const moveMs = () => Math.round(period * M.timing.moveFraction);
  let lastBeat = performance.now();

  function applyVariant(key, fromToggle) {
    V = M.variants[key]; S = M.schedules[V.schedule];
    $('.ll-variant').value = key;
    $('.ll-lift-label').textContent = V.liftName;
    $('.ll-lane2-label').textContent = V.lane2;
    $('.lane2').classList.toggle('on', S.lanes === 2);
    for (const c of ['.ll-claw', '.ll-claw-rail', '.ll-claw-label']) $(c).classList.toggle('on', S.preempt);
    const [clawA, clawB = ''] = (V.clawName || '').split(', ');
    $('.ll-claw-label').innerHTML = `<tspan x="486">${esc(clawA)}</tspan><tspan x="486" dy="13">${esc(clawB)}</tspan>`;
    $('.ll-gate-label').textContent = S.movers < S.lanes ? V.words.gate : '';
    const token = $('.ll-token'); token.classList.toggle('on', !!V.token); $('.ll-hook').classList.toggle('on', !!V.token);
    if (V.token) {
      const h = sim.holder();
      if (h && els[h.dots]._pos) {
        const pos = els[h.dots]._pos; setPos(token, lift(pos));
        const left = Math.max(1, h.left * period - (performance.now() - lastBeat));
        tween(token, [lift([Math.min(P.laneEnd, pos[0] + P.beat * h.left), pos[1]])], left, 0, null, reduced, true);
      } else setPos(token, P.hook);
    }
    $('.ll-note').textContent = V.note;
    for (let d = 1; d <= M.marbles; d++) tweenScale(els[d].querySelector('.body'), scaleNow, V.weight, fromToggle ? 400 : 0, reduced);
    scaleNow = V.weight;
    renderLegend(); drawSchedules();
    if (fromToggle) { pendingToggle = true; render(sim.setRules(V.schedule), true); }
  }
  // the schedules this scene can produce, from the manifest's beat tables, with the runtimes that share each
  function drawSchedules() {
    const box = $('.ll-schedules'); box.innerHTML = '';
    const groups = new Map();
    for (const [key, sch] of Object.entries(M.schedules)) {
      const sig = M.expected[key].join('|');
      if (!groups.has(sig)) groups.set(sig, { keys: [], labels: [] });
      groups.get(sig).keys.push(key); groups.get(sig).labels.push(sch.label);
    }
    for (const { keys, labels } of groups.values()) {
      const rows = M.expected[keys[0]], sch = { label: labels.join(', or ') };
      const names = M.variantOrder.filter(k => keys.includes(M.variants[k].schedule)).map(k => M.variants[k].label);
      const wrap = document.createElement('div'); wrap.className = 'll-sched' + (keys.includes(V.schedule) ? ' on' : '');
      const g = el('svg', { viewBox: `0 0 ${rows.length * 16 + 2} ${M.marbles * 10 + 2}`, class: 'll-sched-svg' });
      rows.forEach((row, t) => row.split(' ').forEach((loc, r) => {
        const cls = cellClass(loc);
        if (cls) g.appendChild(el('rect', { x: 1 + t * 16, y: 1 + r * 10, width: 13, height: 7, rx: 1.5, class: cls }));
      }));
      const label = document.createElement('div'); label.className = 'll-sched-label';
      label.innerHTML = `<b>${esc(sch.label)}</b>, ${rows.length} ticks a cycle<br>${esc(names.join(', '))}`;
      wrap.appendChild(g); wrap.appendChild(label); box.appendChild(wrap);
    }
  }
  function renderLegend() {
    const g = V.gloss;
    const rows = [
      ['Marble', g.marble], ['Lane', g.lane], ['Lift', g.lift], ['Claw', g.claw],
      ['On the platform', ['', g.run[1] + ' No word fires here: the green marble travelling along its lane says it.']],
      ['At the yield', g.yield],
      ['At the gate', g.gate],
      ['Into the tray', g.done],
      ['Lock', g.token],
      ['Red gate at the lift', ['', 'a marble is runnable and every lane is taken. The lift holds until a lane frees.']],
    ];
    $('.ll-legend').innerHTML = rows.map(([k, [w, gl]]) => `<span class="k">${esc(k)}</span><span>${w ? `<span class="w">${esc(w)}</span> ` : ''}<span class="g">${esc(gl)}</span></span>`).join('');
  }

  function render(ev, mid = false) {
    const ms = moveMs(), half = Math.round(ms / 2);
    const phrases = [];
    const paths = new Map();
    const add = (m, pts, delay = 0) => { const cur = paths.get(m.dots); if (cur) cur.points.push(...pts); else paths.set(m.dots, { points: pts, delay }); };
    const glides = new Map();   // dots -> where the marble glides to, at steady speed, until its work runs out
    const glideOf = (m, [x, y]) => ({ to: [Math.min(P.laneEnd, x + P.beat * m.left), y], ms: Math.max(1, m.left * period - ms), delay: ms });
    const raised = new Set(ev.filter(e => e.type === 'run').map(e => e.m.dots));
    // the mark a marble's work has reached along its lane; a preempted marble comes back to it
    const mark = m => [P.laneStart + P.beat * m.done, P.laneY[m.lane]];
    const raiseTo = new Map();
    const gated = S.movers < S.lanes;
    const laneWord = l => (S.lanes > 1 ? ` to lane ${l + 1}` : '');
    let lifted = false;
    for (const e of ev) {
      const nm = e.m ? NAMES[e.m.dots - 1] : '';
      if (e.type === 'run') {
        // raised to the lane, then along it to the mark its work had reached, so a preempted marble picks up where it left off
        const at = mark(e.m), resumed = e.m.done > 0; raiseTo.set(e.m.dots, at);
        add(e.m, [P.liftBottom, P.liftTop(e.slot), at]); lifted = true;
        const where = `${laneWord(e.slot)}${resumed ? ', back where it left off' : ''}`;
        if (e.m.token) { glides.set(e.m.dots, glideOf(e.m, at)); phrases.push(`Lift raises ${nm}${where}.`); }
        else phrases.push(`Lift raises ${nm}${where}, and it stands there: <b class="hold">${esc(V.words.gate)}</b>.`);
      }
      else if (e.type === 'token') {
        if (raised.has(e.m.dots)) continue;
        glides.set(e.m.dots, glideOf(e.m, els[e.m.dots]._pos));
        phrases.push(V.token ? `${cap(nm)} takes the ${V.token} and moves.` : `${cap(nm)} moves.`);
      }
      else if (e.type === 'yield') {
        const [x, y] = els[e.m.dots]._pos; const k = sim.ramp.indexOf(e.m);
        add(e.m, [[x, P.rampY], P.ramp(k < 0 ? M.marbles - 1 : k)]);
        // the word sits clear of the lane labels: beside the upper lane, well below the lower one
        if (y === P.laneY[1]) word(V.words.yield, [x + 14, y - 8], '', 'start'); else word(V.words.yield, [x, y + 40]);
        phrases.push(`${cap(nm)}: <b>${esc(V.words.yield)}</b>. It steps off to the back of the ramp${V.token ? ` and drops the ${V.token}` : ''}.`);
      }
      else if (e.type === 'claw') {
        clawPull(e.m, ms);
        phrases.push(V.token ? `<b class="hold">${esc(cap(V.clawName))}.</b> The claw pulls ${nm} off and it ${esc(V.words.claw)}.` : `${cap(nm)} is <b class="hold">${esc(V.words.claw)}</b>. The claw sets it down at the back of the ramp.`);
      }
      else if (e.type === 'done') { const k = sim.tray.indexOf(e.m); add(e.m, [P.platformEnd(e.from), P.trayDrop, P.tray(k < 0 ? M.marbles - 1 : k)]); phrases.push(`${cap(nm)} ${esc(V.words.done)}.`); }
      else if (e.type === 'recycle') { for (const m of sim.marbles) add(m, [P.trayOut, P.ramp(m.dots - 1)], half); phrases.push(`The tray tips. ${cap(numberWord(M.marbles))} marbles are created.`); }
      else if (e.type === 'demote') { add(e.m, [P.liftTop(1), P.liftBottom, P.ramp(0)]); phrases.push(`The second lane closes. ${cap(nm)} goes back to the front of the ramp.`); }
      else if (e.type === 'freeze') { tween(els[e.m.dots], [els[e.m.dots]._pos], 0); phrases.push(`The padlock appears. ${cap(nm)} stops where it is: <b class="hold">${esc(V.words.gate)}</b>.`); }
    }
    sim.ramp.forEach((m, i) => { if (!paths.has(m.dots) && !busy.has(m.dots)) add(m, [P.ramp(i)]); });
    for (const m of sim.slots) {
      if (!m || paths.has(m.dots) || glides.has(m.dots) || ev.some(e => e.m === m)) continue;
      if (m.token) phrases.push(`${cap(NAMES[m.dots - 1])} runs on, ${m.left} tick${m.left === 1 ? '' : 's'} of work left.`);
      else phrases.push(`${cap(NAMES[m.dots - 1])} stands at the gate.`);
    }
    if (sim.held() && !lifted) for (const m of sim.ramp) if (!ev.some(e => e.m === m)) phrases.push(`${cap(NAMES[m.dots - 1])} waits for a lane.`);
    for (const [dots, { points, delay }] of paths) {
      const g = glides.get(dots);
      if (!g) { move(els[dots], points, ms, delay); continue; }
      // raise, then glide at steady speed so the work ends exactly on its last beat
      tween(els[dots], points, ms, delay, () => tween(els[dots], [g.to], g.ms, 0, null, reduced, true), reduced);
    }
    // a marble that took the token where it stood: it moves once the move window has passed
    for (const [dots, g] of glides) if (!paths.has(dots)) tween(els[dots], [g.to], g.ms, g.delay, null, reduced, true);
    // the padlock rides with whoever holds it
    if (V.token) {
      const tk = $('.ll-token'), h = sim.holder();
      if (!h) move(tk, [P.hook], ms);
      else {
        const g = glides.get(h.dots);
        if (g) {
          const pre = paths.has(h.dots) ? [lift(P.liftTop(h.lane)), lift(raiseTo.get(h.dots) || P.gate(h.lane))] : [lift(els[h.dots]._pos)];
          tween(tk, pre, ms, 0, () => tween(tk, [lift(g.to)], g.ms, 0, null, reduced, true), reduced);
        }
      }
    }
    if (lifted) liftAct(ms);
    for (let d = 1; d <= M.marbles; d++) els[d].classList.toggle('lit', sim.slots.some(m => m && m.dots === d && m.token));
    // the red bar stands just ahead of a marble that is on a lane and cannot move, wherever it stopped
    for (const g of host.querySelectorAll('.gatebar')) {
      const m = sim.slots[+g.dataset.lane]; const stalled = gated && !!(m && !m.token);
      g.classList.toggle('on', stalled);
      if (stalled) tween(g, [[(raiseTo.get(m.dots) || els[m.dots]._pos)[0] - P.laneStart, 0]], ms, 0, null, reduced);
    }

    const held = sim.held();
    svg.classList.toggle('held', held);
    if (held && !lifted && !ev.some(e => e.type === 'claw')) word('holds', [140, 250], 'hold', 'end');

    if (!mid) recordTrace(sim, ev.some(e => e.type === 'recycle'));
    $('.ll-caption').innerHTML = (mid ? '' : `<span class="ll-eyebrow">tick ${sim.cycleTick}</span> &nbsp; `) + phrases.join(' ');
    $('.ll-tick').textContent = `tick ${sim.tick}`;
  }

  let beatRaf = 0;
  function beatLoop() {
    cancelAnimationFrame(beatRaf); const bar = $('.ll-beat');
    const frame = () => {
      const f = Math.min(1, (performance.now() - lastBeat) / period);
      bar.setAttribute('width', (278 * f).toFixed(1));
      const w = Math.max(0.5, 22 * f).toFixed(1);
      for (const c of trace.querySelectorAll('.cell-new')) c.setAttribute('width', w);
      beatRaf = requestAnimationFrame(frame);
    };
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
  drawTrace(); beatLoop();
  $('.ll-caption').innerHTML = `<span class="ll-eyebrow">tick 0</span> &nbsp; ${cap(numberWord(M.marbles))} marbles are created on the ramp.`;
  start();
}

register('yielding', mount);
