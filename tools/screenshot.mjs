// Screenshot a scene at a tick in a runtime, from the built site. usage: node tools/screenshot.mjs <slug> <variant> <tick> [out.png]
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const run = promisify(execFile);
import { loadManifest, pageUrl } from './_scenes.mjs';
import { serveDist, CHROME } from './_serve.mjs';
const [slug = 'giving-up-control', v = 'asyncio', tick = '5', out = `shot-${slug}-${v}-${tick}.png`] = process.argv.slice(2);
const M = loadManifest(slug);
const server = await serveDist();
try {
  await run(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1100,1000', `--virtual-time-budget=${+tick * M.timing.periods[M.timing.default] + 100}`, `--screenshot=${out}`, `http://127.0.0.1:${server.port}${pageUrl(M)}?variant=${v}`]);
  console.log(out);
} finally { server.close(); }
