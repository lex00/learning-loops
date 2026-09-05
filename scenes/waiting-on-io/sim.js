// The state machine for "Waiting on I/O". Knows nothing about drawing.
// Marbles follow the manifest's skeleton; the variant supplies only the slot count.
export class Sim {
  constructor(manifest, slotCount) {
    this.skeleton = manifest.skeleton;
    this.count = manifest.marbles;
    this.slotCount = +slotCount;
    this.tick = 0; this.cycleTick = 0; this.recycled = false;
    this.create();
  }
  create() {
    this.marbles = Array.from({ length: this.count }, (_, i) => ({ dots: i + 1, seg: 0, left: this.skeleton[0].ticks, loc: 'ramp', pocket: -1, slot: -1 }));
    this.ramp = [...this.marbles];
    this.slots = [null, null];
    this.pockets = Array(this.count).fill(null);
    this.tray = [];
  }
  step() {
    const ev = [];
    if (this.recycled) { this.cycleTick = 0; this.recycled = false; }
    this.tick++; this.cycleTick++;
    // pockets first: a marble that enters a pocket this tick must not also count down this tick
    for (let p = 0; p < this.pockets.length; p++) {
      const m = this.pockets[p]; if (!m) continue;
      m.left--;
      if (m.left === 0) { this.pockets[p] = null; m.seg++; m.left = this.skeleton[m.seg].ticks; m.loc = 'ramp'; m.pocket = -1; this.ramp.push(m); ev.push({ type: 'ready', m, pocket: p }); }
    }
    for (let i = 0; i < 2; i++) {
      const m = this.slots[i]; if (!m) continue;
      m.left--;
      if (m.left === 0) {
        m.seg++; this.slots[i] = null; m.slot = -1;
        if (m.seg >= this.skeleton.length) { m.loc = 'tray'; this.tray.push(m); ev.push({ type: 'done', m, from: i }); }
        else { const p = this.pockets.indexOf(null); this.pockets[p] = m; m.loc = 'pocket'; m.pocket = p; m.left = this.skeleton[m.seg].ticks; ev.push({ type: 'trap', m, from: i, pocket: p }); }
      }
    }
    this.fill(ev);
    if (this.tray.length === this.count) { ev.push({ type: 'recycle' }); this.create(); this.recycled = true; }
    return ev;
  }
  fill(ev) {
    for (let i = 0; i < this.slotCount; i++) {
      if (!this.slots[i] && this.ramp.length) { const m = this.ramp.shift(); this.slots[i] = m; m.loc = 'slot'; m.slot = i; ev.push({ type: 'run', m, slot: i }); }
    }
  }
  // a toggle mid-run: change the slot count and continue from the current state
  setSlots(n) {
    const ev = [];
    if (n < this.slotCount && this.slots[1]) { const m = this.slots[1]; this.slots[1] = null; m.slot = -1; m.loc = 'ramp'; this.ramp.unshift(m); ev.push({ type: 'demote', m }); }
    this.slotCount = n; this.fill(ev); return ev;
  }
  setRules(key) { return this.setSlots(+key); }
  held() { return this.ramp.length > 0 && this.slots.slice(0, this.slotCount).every(Boolean); }
  idle() { return !this.slots.some(Boolean) && this.ramp.length === 0 && this.tray.length < this.count; }
  locs() { return this.marbles.map(m => m.loc); }
  places() { return [...this.slots.filter(Boolean), ...this.pockets.filter(Boolean), ...this.ramp, ...this.tray]; }
}
