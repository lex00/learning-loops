// Lint every piece of prose on the site with the `sentences` de-stink rules: MDX pages, scene manifests, README.
// usage: node tools/lint-prose.mjs [--min low|medium|high]   exits 1 if any finding at or above --min (default: medium)
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { RULES } from 'sentences/lint/registry';
import { runRules } from 'sentences/lint/engine';
import { buildDocAnalysis } from 'sentences/lint/build-doc';
import { buildReport } from 'sentences/lint/report';
import { extractProse } from 'sentences/lint/markdown-prose';
import { ROOT, listScenes, loadManifest } from './_scenes.mjs';

const RANK = { candidate: 0, low: 1, medium: 2, high: 3 };
const min = RANK[(process.argv.find(a => a.startsWith('--min=')) || '--min=medium').slice(6)] ?? 2;

function* walk(dir, ext) {
  for (const f of readdirSync(dir)) { const p = join(dir, f); if (statSync(p).isDirectory()) yield* walk(p, ext); else if (p.endsWith(ext)) yield p; }
}
// prose strings from a manifest, each labelled by its JSON path
function* manifestProse(m, path = '') {
  if (typeof m === 'string') { if (m.split(' ').length >= 4) yield [path, m]; return; }
  if (Array.isArray(m)) { for (let i = 0; i < m.length; i++) yield* manifestProse(m[i], `${path}[${i}]`); return; }
  if (m && typeof m === 'object') for (const k of Object.keys(m)) { if (k === 'expected') continue; yield* manifestProse(m[k], path ? `${path}.${k}` : k); }
}
const docs = [];
for (const p of walk(join(ROOT, 'src/content/docs'), '.mdx')) {
  // headings are labels, not sentences: drop them so consecutive short sections do not read as anaphora
  const raw = readFileSync(p, 'utf8').replace(/^---[\s\S]*?---\n/, '').replace(/^import .*$/gm, '').replace(/<[^>]+\/>/g, '').replace(/^#{1,6} .*$/gm, '');
  docs.push({ label: relative(ROOT, p), text: extractProse(raw) });
}
for (const slug of listScenes()) for (const [path, text] of manifestProse(loadManifest(slug))) docs.push({ label: `scenes/${slug}/manifest.json ${path}`, text });
docs.push({ label: 'README.md', text: extractProse(readFileSync(join(ROOT, 'README.md'), 'utf8').replace(/^#{1,6} .*$/gm, '')) });

let worst = -1, total = 0;
for (const d of docs) {
  if (!d.text.trim()) continue;
  const doc = buildDocAnalysis(d.text);
  const { findings, errors } = runRules(RULES, doc);
  const report = buildReport(d.text, findings, errors, RULES);
  const shown = report.findings.filter(f => RANK[f.severity] >= min);
  if (!shown.length && !errors.length) continue;
  console.log(`\n${d.label}  (score ${JSON.stringify(report.score.total ?? report.score)}, ${report.wordCount} words)`);
  for (const f of shown) {
    worst = Math.max(worst, RANK[f.severity]); total++;
    const snippet = d.text.slice(f.span.start, f.span.end).replace(/\s+/g, ' ');
    console.log(`  [${f.severity}] ${f.ruleId}: "${snippet.length > 90 ? snippet.slice(0, 87) + '...' : snippet}"\n      ${f.message}`);
  }
  for (const e of errors) console.log(`  rule error ${e.ruleId}: ${e.message}`);
}
console.log(total ? `\n${total} finding(s) at or above the threshold` : '\nno findings at or above the threshold');
process.exit(worst >= min ? 1 : 0);
