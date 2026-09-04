// Real-time probe: drive the installed Chrome, play a scene, and print where each marble is every sample.
// usage: node tools/probe.mjs <slug> <variant> <seconds> [every-ms]   (needs dist/)
import puppeteer from 'puppeteer-core';
import { loadManifest, pageUrl } from './_scenes.mjs';
import { serveDist, CHROME } from './_serve.mjs';
const [slug = 'waiting-on-io', v = 'threads', secs = '8', every = '350'] = process.argv.slice(2);
const M = loadManifest(slug);
const server = await serveDist();
const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--no-first-run', '--disable-gpu'] });
try {
  const page = await browser.newPage(); await page.setViewport({ width: 1000, height: 900 });
  page.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await page.goto(`http://127.0.0.1:${server.port}${pageUrl(M)}?variant=${v}`, { waitUntil: 'networkidle0' });
  const t0 = Date.now();
  while (Date.now() - t0 < +secs * 1000) {
    const s = await page.evaluate(() => {
      const q = sel => document.querySelector(sel);
      const pos = el => (el.getAttribute('transform') || '').replace('translate(', '').replace(')', '').split(' ').map(n => Math.round(+n)).join(',');
      return { tick: q('.ll-tick').textContent, marbles: [...document.querySelectorAll('.marble')].map(m => pos(m) + (m.classList.contains('lit') ? '*' : '')), token: q('.ll-token') && pos(q('.ll-token')) };
    });
    console.log(String(Date.now() - t0).padStart(5), s.tick.padEnd(8), s.marbles.join('  '), ' token', s.token);
    await new Promise(r => setTimeout(r, +every));
  }
} finally { await browser.close(); server.close(); }
