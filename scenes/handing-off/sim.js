// The state machine for "Handing off". Knows nothing about drawing.
// Two marbles with different skeletons: one makes values and sends them, one receives values and uses them. Between
// them is a box with a size. A send into a full box blocks; a receive from an empty box blocks; with no box at all a
// send blocks until a receiver takes the value from the sender's hand. A blocked marble leaves its lane for a pocket
// and comes back through the ramp when the box lets it go. Lanes, movers, and the claw are the Truly parallel rules.
export class Sim {
  constructor(manifest, key) {
    this.roles = manifest.roles;
    this.cast = manifest.cast;
    this.count = manifest.marbles;
    this.quantum = manifest.quantum;
    this.schedules = manifest.schedules;
    this.tick = 0; this.cycleTick = 0; this.recycled = false;
    this.applyRules(key);
    this.create();
  }
  applyRules(key) {
    const r = this.schedules[key]; if (!r) throw new Error(`no schedule "${key}"`);
    this.key = key; this.lanes = r.lanes; this.movers = r.movers; this.preempt = r.preempt; this.cap = r.box;
  }
  skel(m) { return this.roles[m.role]; }
  create() {
    this.nextValue = 1;
    this.marbles = Array.from({ length: this.count }, (_, i) => ({ dots: i + 1, role: this.cast[i], seg: 0, left: 0, done: 0, loc: 'ramp', lane: -1, pocket: -1, shown: 0, waited: 0, token: false, value: null }));
    for (const m of this.marbles) this.enter(m, 0);
    this.ramp = [...this.marbles];
    this.slots = [null, null];
    this.box = [];
    this.pockets = Array(this.count).fill(null);
    this.tray = [];
  }
  // a marble starts a run segment; a run that leads to a send is the making of a value, so the value exists from here
  enter(m, seg) {
    m.seg = seg; const s = this.skel(m)[seg]; m.left = s.ticks;
    const next = this.skel(m)[seg + 1];
    if (next && next.kind === 'send') m.value = this.nextValue++;
  }
  step() {
    const ev = [];
    if (this.recycled) { this.cycleTick = 0; this.recycled = false; }
    this.tick++; this.cycleTick++;
    // a moving marble consumes a tick of work; at the end of a segment it finishes, or arrives at the box
    const arrived = [];
    for (let l = 0; l < 2; l++) {
      const m = this.slots[l]; if (!m || !m.token) continue;
      m.left--; m.done++;
      if (m.left > 0) continue;
      if (m.role === 'consumer') m.value = null;   // the value it was using is used up
      m.seg++;
      if (m.seg >= this.skel(m).length) { this.leave(m, l); m.loc = 'tray'; this.tray.push(m); ev.push({ type: 'done', m, from: l }); }
      else arrived.push(m);
    }
    this.exchange(ev, arrived);
    // whoever could not be served leaves its lane for a pocket, holding whatever it holds
    for (const m of arrived) {
      if (m.seg < this.skel(m).length && this.skel(m)[m.seg].kind !== 'run') {
        const p = this.pockets.indexOf(null); const l = m.lane; this.leave(m, l);
        this.pockets[p] = m; m.pocket = p; m.loc = 'box';
        ev.push({ type: 'block', m, from: l, pocket: p, kind: this.skel(m)[m.seg].kind });
      }
    }
    // the claw: a marble that has run its quantum goes back to the ramp, but only if someone would still be waiting once
    // free lanes fill. A marble standing at the gate is waiting too: with two marbles the ramp is often empty while it stands
    if (this.preempt) {
      let waiting = this.ramp.length - this.freeLanes() + this.slots.filter(m => m && !m.token).length;
      const cands = this.slots.filter(m => m && m.token && m.shown >= this.quantum).sort((a, b) => b.shown - a.shown || a.dots - b.dots);
      for (const m of cands) {
        if (waiting <= 0) break;
        const l = m.lane; this.leave(m, l); m.loc = 'ramp'; this.ramp.push(m); waiting--;
        ev.push({ type: 'claw', m, from: l });
      }
    }
    this.fill(ev);
    if (this.tray.length === this.count) { ev.push({ type: 'recycle' }); this.create(); this.recycled = true; }
    for (const m of this.slots) if (m) { if (m.token) m.shown++; else m.waited++; }
    return ev;
  }
  kind(m) { const s = this.skel(m)[m.seg]; return s ? s.kind : 'done'; }
  // the box, to a fixpoint: receives are served from the box, sends fill it, and a receive that makes room lets a
  // blocked send in. With no box, a send and a receive meet hand to hand. Marbles already blocked in pockets go first.
  exchange(ev, arrived) {
    const waiting = k => this.pockets.filter(m => m && this.kind(m) === k);
    const fresh = k => arrived.filter(m => this.kind(m) === k);
    let progress = true;
    while (progress) {
      progress = false;
      for (const r of [...waiting('recv'), ...fresh('recv')]) {
        if (this.box.length) { this.complete(ev, r, 'recv', this.box.shift(), null); progress = true; }
        else if (this.cap === 0) {
          const s = [...waiting('send'), ...fresh('send')][0];
          if (s) { const v = s.value; this.complete(ev, s, 'send', v, r); this.complete(ev, r, 'recv', v, s); progress = true; }
        }
      }
      for (const s of [...waiting('send'), ...fresh('send')]) {
        if (this.box.length < this.cap) { this.box.push(s.value); this.complete(ev, s, 'send', s.value, null); progress = true; }
      }
    }
  }
  complete(ev, m, kind, value, other) {
    const woke = m.pocket >= 0, pocket = m.pocket;
    if (woke) { this.pockets[pocket] = null; m.pocket = -1; m.loc = 'ramp'; this.ramp.push(m); }
    if (kind === 'send') m.value = null; else m.value = value;
    this.enter(m, m.seg + 1);
    ev.push({ type: kind, m, value, other, woke, pocket, from: m.lane });
  }
  leave(m, l) { this.slots[l] = null; m.lane = -1; m.token = false; m.shown = 0; }
  freeLanes() { let n = 0; for (let l = 0; l < this.lanes; l++) if (!this.slots[l]) n++; return n; }
  // the lift fills free lanes from the front of the ramp; a raised marble moves only if a run token is free for it
  fill(ev) {
    const raised = new Set();
    for (let l = 0; l < this.lanes; l++) {
      if (!this.slots[l] && this.ramp.length) {
        const m = this.ramp.shift(); this.slots[l] = m; m.lane = l; m.shown = 0; m.waited = 0; m.token = false; m.loc = 'gate'; raised.add(m);
        ev.push({ type: 'run', m, slot: l });
      }
    }
    this.grant(ev, raised);
  }
  grant(ev, raised = new Set()) {
    let held = this.slots.filter(m => m && m.token).length;
    const idle = this.slots.filter(m => m && !m.token).sort((a, b) => b.waited - a.waited || a.lane - b.lane);
    for (const m of idle) {
      if (held >= this.movers) break;
      m.token = true; m.loc = 'slot'; held++;
      if (!raised.has(m)) ev.push({ type: 'token', m, slot: m.lane });
    }
  }
  // a toggle mid-run: change the rules and continue from the current state. A box that shrinks keeps what it holds
  // until that is taken; a box that grows lets a blocked sender in at once.
  setRules(key) {
    const ev = []; const was = { lanes: this.lanes, movers: this.movers };
    this.applyRules(key);
    if (this.lanes < was.lanes && this.slots[1]) {
      const m = this.slots[1]; this.leave(m, 1); m.loc = 'ramp'; this.ramp.unshift(m);
      ev.push({ type: 'demote', m });
    }
    if (this.movers < was.movers) {
      const holders = this.slots.filter(m => m && m.token).sort((a, b) => b.shown - a.shown || a.dots - b.dots);
      for (const m of holders.slice(this.movers)) { m.token = false; m.loc = 'gate'; m.waited = 0; ev.push({ type: 'freeze', m, slot: m.lane }); }
    }
    this.exchange(ev, []);
    this.fill(ev);
    return ev;
  }
  held() { return this.ramp.length > 0 && this.slots.slice(0, this.lanes).every(Boolean); }
  idle() { return !this.slots.some(Boolean) && this.ramp.length === 0 && this.tray.length < this.count; }
  holder() { return this.slots.find(m => m && m.token) || null; }
  locs() { return this.marbles.map(m => m.loc); }
  places() { return [...this.slots.filter(Boolean), ...this.pockets.filter(Boolean), ...this.ramp, ...this.tray]; }
}
