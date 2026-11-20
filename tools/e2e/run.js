// Runs every browser journey against a local server: bun run e2e [name ...]
import { coverage, launch, serve } from './helper.js';

const FLOWS = ['checklist', 'paint', 'share', 'story-export', 'offline', 'engine', 'rail', 'layout', 'a11y', 'segment'];
const only = process.argv.slice(2);
const server = serve();
const browser = await launch();
let failed = 0;
for (const name of FLOWS.filter(name => !only.length || only.includes(name))) {
  const started = performance.now();
  try {
    const { default: flow } = await import(`./${name}.js`);
    await flow({ browser, url: server.url });
    console.log(`pass  ${name} (${Math.round(performance.now() - started)} ms)`);
  } catch (error) {
    failed++;
    console.log(`FAIL  ${name}: ${error.message}`);
  }
}
await browser.close();
server.stop();

if (coverage) {
  // Bytes each file never ran (JS) or never matched (CSS) across all flows.
  const report = {};
  for (const [kind, entries] of Object.entries(coverage)) {
    for (const { url, text, ranges } of entries) {
      const file = new URL(url).pathname.slice(1) || 'index.html';
      const used = (report[file] ??= { kind, text, used: new Array(text.length).fill(false) }).used;
      for (const { start, end } of ranges) used.fill(true, start, end);
    }
  }
  for (const [file, { kind, text, used }] of Object.entries(report)) {
    const unused = used.filter(hit => !hit).length;
    console.log(`${kind} ${file}: ${unused} of ${text.length} bytes unused`);
  }
  await Bun.write('coverage-e2e.json', JSON.stringify(Object.fromEntries(Object.entries(report).map(([file, { text, used }]) => {
    const gaps = [];
    for (let i = 0; i < used.length; i++) if (!used[i]) { const start = i; while (i < used.length && !used[i]) i++; gaps.push(text.slice(start, i)); }
    return [file, gaps.filter(gap => gap.trim())];
  })), null, 1));
}
console.log(failed ? `${failed} flow(s) failed` : 'all flows passed');
process.exit(failed ? 1 : 0);
