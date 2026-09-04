// Level 2: render every scene in headless Chrome with virtual time and diff the trace strip against the state machine.
// Run after `npm run build`.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { listScenes, loadManifest, loadSim, pageUrl } from './_scenes.mjs';
import { serveDist, CHROME } from './_serve.mjs';

const toCell = { slot: 'run', pocket: 'wait', ramp: 'ready', tray: null };
const server = await serveDist();
let bad = 0;
try {
  for (const slug of listScenes()) {
    const M = loadManifest(slug); const Sim = await loadSim(slug);
    const period = M.timing.periods[M.timing.default];
    for (const v of M.variantOrder) {
      const url = `http://127.0.0.1:${server.port}${pageUrl(M)}?variant=${v}`;
      const { stdout: dom } = await run(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1000,900', `--virtual-time-budget=${period * 10 + 200}`, '--dump-dom', url], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
      const start = dom.indexOf('class="ll-trace"');
      const trace = dom.slice(start, dom.indexOf('</svg>', start));
      const rects = [...trace.matchAll(/<rect x="(\d+)" y="(\d+)"[^>]*class="cell-(\w+)[^"]*"/g)].map(m => ({ col: (m[1] - 40) / 27, row: { 10: 0, 32: 1, 54: 2 }[m[2]], state: m[3] }));
      const cols = Math.max(-1, ...rects.map(r => r.col)) + 1;
      const rendered = Array.from({ length: cols }, () => Array(M.marbles).fill(null));
      for (const r of rects) rendered[r.col][r.row] = r.state;
      const tick = +(dom.match(/class="ll-tick">tick (\d+)</) || [0, 0])[1];
      const sim = new Sim(M, M.variants[v].slots); let mism = 0;
      for (let t = 1; t <= tick; t++) {
        sim.step();
        const expected = sim.locs().map(l => toCell[l]); const got = rendered[t - 1] || [];
        if (!expected.every((e, i) => e === got[i])) { mism++; console.log(`  ${slug} ${v} col ${t}: rendered ${got.join(' ')} expected ${expected.join(' ')}`); }
      }
      if (cols !== tick) { mism++; console.log(`  ${slug} ${v}: ${cols} columns rendered but ${tick} ticks fired`); }
      if (tick === 0) { mism++; console.log(`  ${slug} ${v}: no ticks fired (page failed to load or script errored)`); }
      console.log(`${slug} ${v}: ${tick} ticks, ${mism ? mism + ' problem(s)' : 'strip matches the state machine'}`);
      bad += mism;
    }
  }
} finally { server.close(); }
process.exit(bad ? 1 : 0);
