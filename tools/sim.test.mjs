// Level 1: every scene's state machine against the beat tables in its manifest.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listScenes, loadManifest, loadSim } from './_scenes.mjs';

// a manifest's beat tables are keyed by the rules that produce them: a slot count, or a named schedule
for (const slug of listScenes()) {
  const M = loadManifest(slug);
  const Sim = await loadSim(slug);
  const keys = Object.keys(M.expected);
  for (const [key, expected] of Object.entries(M.expected)) {
    test(`${slug}: ${key} schedule matches the beat table`, () => {
      const sim = new Sim(M, key);
      expected.forEach((row, i) => { sim.step(); assert.equal(sim.locs().join(' '), row, `tick ${i + 1}`); });
    });
    test(`${slug}: ${key} loop repeats exactly`, () => {
      const sim = new Sim(M, key);
      for (let i = 0; i < expected.length; i++) sim.step();
      expected.forEach((row, i) => { sim.step(); assert.equal(sim.locs().join(' '), row, `second cycle tick ${i + 1}`); });
    });
  }
  test(`${slug}: toggling rules mid-run never loses or duplicates a marble`, () => {
    const sim = new Sim(M, keys[0]);
    for (let t = 0; t < 4; t++) sim.step();
    for (const k of keys.slice(1)) { sim.setRules(k); sim.step(); sim.step(); }
    sim.setRules(keys[0]);
    for (let t = 0; t < 30; t++) {
      sim.step();
      const places = sim.places();
      assert.equal(places.length, M.marbles, `step ${t}: marble count`);
      assert.equal(new Set(places).size, M.marbles, `step ${t}: a marble is in two places`);
    }
  });
}
