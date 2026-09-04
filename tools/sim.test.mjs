// Level 1: every scene's state machine against the beat tables in its manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listScenes, loadManifest, loadSim } from './_scenes.mjs';

for (const slug of listScenes()) {
  const M = loadManifest(slug);
  const Sim = await loadSim(slug);
  for (const [slots, expected] of Object.entries(M.expected)) {
    test(`${slug}: ${slots}-slot schedule matches the beat table`, () => {
      const sim = new Sim(M, +slots);
      expected.forEach((row, i) => { sim.step(); assert.equal(sim.locs().join(' '), row, `tick ${i + 1}`); });
    });
    test(`${slug}: ${slots}-slot loop repeats exactly`, () => {
      const sim = new Sim(M, +slots);
      for (let i = 0; i < expected.length; i++) sim.step();
      expected.forEach((row, i) => { sim.step(); assert.equal(sim.locs().join(' '), row, `second cycle tick ${i + 1}`); });
    });
  }
  test(`${slug}: toggling slots mid-run never loses or duplicates a marble`, () => {
    const sim = new Sim(M, 1);
    for (let t = 0; t < 4; t++) sim.step();
    sim.setSlots(2); sim.step(); sim.step(); sim.setSlots(1);
    for (let t = 0; t < 30; t++) {
      sim.step();
      const places = [...sim.slots.filter(Boolean), ...sim.pockets.filter(Boolean), ...sim.ramp, ...sim.tray];
      assert.equal(places.length, M.marbles, `step ${t}: marble count`);
      assert.equal(new Set(places).size, M.marbles, `step ${t}: a marble is in two places`);
    }
  });
}
