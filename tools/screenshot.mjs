// Screenshot a scene at a tick in a runtime, from the built site, in real time via the installed Chrome.
// usage: node tools/screenshot.mjs <slug> <variant> <tick> [out.png] [offset-ms]
import puppeteer from 'puppeteer-core';
import { loadManifest, pageUrl } from './_scenes.mjs';
import { serveDist, CHROME } from './_serve.mjs';
const [slug = 'waiting-on-io', v = 'asyncio', tick = '5', out = `shot-${slug}-${v}-${tick}.png`, offset = '700'] = process.argv.slice(2);
const M = loadManifest(slug);
const server = await serveDist();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1100, height: 1000 });
  await page.goto(`http://127.0.0.1:${server.port}${pageUrl(M)}?variant=${v}`, { waitUntil: 'networkidle0' });
  // ticks fire on an interval that started at load; wait for the requested tick, then the offset into it
  await page.waitForFunction(t => document.querySelector('.ll-tick').textContent === `tick ${t}`, { timeout: 60000 }, +tick);
  await new Promise(r => setTimeout(r, +offset));
  await page.screenshot({ path: out });
  console.log(out);
} finally { await browser.close(); server.close(); }
