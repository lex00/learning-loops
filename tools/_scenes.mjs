import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export function listScenes() {
  return readdirSync(join(ROOT, 'scenes')).filter(d => !d.startsWith('_') && existsSync(join(ROOT, 'scenes', d, 'manifest.json')));
}
export function loadManifest(slug) { return JSON.parse(readFileSync(join(ROOT, 'scenes', slug, 'manifest.json'), 'utf8')); }
export async function loadSim(slug) { return (await import(pathToFileURL(join(ROOT, 'scenes', slug, 'sim.js')).href)).Sim; }
export const BASE = (readFileSync(join(ROOT, 'astro.config.mjs'), 'utf8').match(/base:\s*'([^']*)'/) || [, ''])[1].replace(/\/$/, '');
export const pageUrl = (m) => `${BASE}/${m.topic}/${m.slug}/`;
// the key a variant's schedule is filed under in the manifest's beat tables: a named schedule, or the slot count
export const rulesKey = (v) => String(v.schedule ?? v.slots);
