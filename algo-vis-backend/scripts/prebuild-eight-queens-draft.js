const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const target = path.join(root, 'drafts', 'eight-queens-teaching.asmdeck');
const baseUrl = process.argv[2] || 'http://127.0.0.1:3100';

global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMTraceViewSource = require('../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => JSON.parse(JSON.stringify(value)) };
global.indexedDB = require('fake-indexeddb').indexedDB;
const nativeFetch = global.fetch;
global.fetch = (input, init) => nativeFetch(new URL(String(input), baseUrl), init);
const ASMDeck = require('../public/asmdeck.js');

(async () => {
  const decoded = await ASMDeck.decode(new Blob([await fs.readFile(target)]));
  const failures = [];
  const rebuilt = await ASMDeck.rebuildDeck(decoded.deck, () => {}, (slide, kind) => {
    if (kind === 'pending') failures.push(`${slide.id}: ${slide.animation?.rebuildError || '重建失敗'}`);
  });
  if (failures.length) throw new Error(failures.join('\n'));
  const projected = await ASMDeck.project(rebuilt, null, { includePrebuiltTraces: false });
  const traceDirectory = path.join(root, 'public', 'deck-traces');
  await fs.mkdir(traceDirectory, { recursive: true });
  for (const seed of projected.cacheSeeds) if (/^[a-f0-9]{64}$/.test(seed.key)) {
    await fs.writeFile(path.join(traceDirectory, seed.key + '.json'), JSON.stringify(seed.trace));
  }
  const output = Buffer.from(await (await ASMDeck.encode(projected)).arrayBuffer());
  const temporary = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temporary, output);
  await fs.rename(temporary, target);
  console.log(`draft: ${projected.cacheSeeds.filter(seed => /^[a-f0-9]{64}$/.test(seed.key)).length} animations, ${output.length} bytes`);
})().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
