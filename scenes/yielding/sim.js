// The state machine for "Yielding". Knows nothing about drawing.
// The Truly parallel rules, with a skeleton that has a yield in it: a marble that reaches a yield leaves its lane on
// purpose, with nothing to wait for, and goes to the back of the ramp. A schedule supplies lanes, movers, and the claw.
export class Sim {
  constructor(manifest, key) {
    this.skeleton = manifest.skeleton;
    this.count = manifest.marbles;
    this.quantum = manifest.quantum;
    this.schedules = manifest.schedules;
    this.tick = 0; this.cycleTick = 0; this.recycled = false;
    this.applyRules(key);
    this.create();
  }
  applyRules(key) {
    const r = this.schedules[key]; if (!r) throw new Error(`no schedule "${key}"`);
    this.key = key; this.lanes = r.lanes; this.movers = r.movers; this.preempt = r.preempt;
  }
  create() {
    this.marbles = Array.from({ length: this.count }, (_, i) => ({ dots: i + 1, seg: 0, left: this.skeleton[0].ticks, done: 0, loc: 'ramp', lane: -1, shown: 0, waited: 0, token: false }));
    this.ramp = [...this.marbles];
    this.slots = [null, null];
    this.tray = [];
    this.pockets = [];
  }
  step() {
    const ev = [];
    if (this.recycled) { this.cycleTick = 0; this.recycled = false; }
    this.tick++; this.cycleTick++;
    // a moving marble consumes a tick of work; at the end of a segment it finishes, or yields if the skeleton says so
    for (let l = 0; l < 2; l++) {
      const m = this.slots[l]; if (!m || !m.token) continue;
      m.left--; m.done++;
      if (m.left > 0) continue;
      m.seg++;
      if (m.seg >= this.skeleton.length) { this.leave(m, l); m.loc = 'tray'; this.tray.push(m); ev.push({ type: 'done', m, from: l }); }
      else if (this.skeleton[m.seg].kind === 'yield') { m.seg++; m.left = this.skeleton[m.seg].ticks; this.leave(m, l); m.loc = 'ramp'; this.ramp.push(m); ev.push({ type: 'yield', m, from: l }); }
    }
    // the claw: a marble that has run its quantum goes back to the ramp, but only if someone would still be waiting once free lanes fill
    if (this.preempt) {
      let waiting = this.ramp.length - this.freeLanes();
      const cands = this.slots.filter(m => m && m.token && m.shown >= this.quantum).sort((a, b) => b.shown - a.shown || a.dots - b.dots);
      for (const m of cands) {
        if (waiting <= 0) break;
        const l = m.lane; this.leave(m, l); m.loc = 'ramp'; this.ramp.push(m); waiting--;
        ev.push({ type: 'claw', m, from: l });
      }
    }
    this.fill(ev);
    if (this.tray.length === this.count) { ev.push({ type: 'recycle' }); this.create(); this.recycled = true; }
    // the held picture: movers advance, marbles at the gate wait
    for (const m of this.slots) if (m) { if (m.token) m.shown++; else m.waited++; }
    return ev;
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
  // as many run tokens as there are movers, to the marbles that have waited longest at the gate
  grant(ev, raised = new Set()) {
    let held = this.slots.filter(m => m && m.token).length;
    const idle = this.slots.filter(m => m && !m.token).sort((a, b) => b.waited - a.waited || a.lane - b.lane);
    for (const m of idle) {
      if (held >= this.movers) break;
      m.token = true; m.loc = 'slot'; held++;
      if (!raised.has(m)) ev.push({ type: 'token', m, slot: m.lane });
    }
  }
  // a toggle mid-run: change the rules and continue from the current state
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
    this.fill(ev);
    return ev;
  }
  held() { return this.ramp.length > 0 && this.slots.slice(0, this.lanes).every(Boolean); }
  idle() { return false; }
  holder() { return this.slots.find(m => m && m.token) || null; }
  locs() { return this.marbles.map(m => m.loc); }
  places() { return [...this.slots.filter(Boolean), ...this.ramp, ...this.tray]; }
}
