#!/usr/bin/env node
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
global.ASMTraceProvenance = require('../../public/trace-provenance.js');
global.ASMTraceViewSource = require('../../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => JSON.parse(JSON.stringify(value)) };
const ASMDeck = require('../../public/asmdeck.js');
const { buildDefaultAlgorithmAssets } = require('./default-algorithm-assets.js');

async function main() {
  const bytes = await fs.readFile(path.join(publicRoot, 'guest-decks/linear-sieve.asmdeck'));
  const decoded = await ASMDeck.decode(new Blob([bytes]));
  const index = JSON.parse(await fs.readFile(path.join(publicRoot, 'deck-traces/index.json'), 'utf8'));
  const generationFingerprint = require('../../trace-generation').generationFingerprint();
  for (const slide of decoded.deck.groups.flatMap(group => group.slides || []).filter(slide => slide.animation?.traceRef)) {
    const animation = slide.animation;
    const file = require('../../public/sample-trace-assets').filenameFor(index, animation.traceRef);
    const trace = JSON.parse(await fs.readFile(path.join(publicRoot, 'deck-traces', file), 'utf8'));
    if (trace.provenance?.generationFingerprint !== generationFingerprint) throw new Error('線篩 Trace 已過期，請先執行 prebuild:guest-decks -- --only linear-sieve --rerun');
    animation.traceDocument = { ...trace, ...animation.traceView };
  }
  const manifest = await buildDefaultAlgorithmAssets(decoded.deck, {
    publicRoot,
    engineVersion: ASMDeck.engineVersion(), immutable: true
  });
  console.log(`default ${manifest.id}: preview ${manifest.preview.bytes} bytes, full ${manifest.full.bytes} bytes, ${manifest.totalFrames} frames`);
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
