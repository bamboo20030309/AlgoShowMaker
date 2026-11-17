#!/usr/bin/env node
'use strict';
const fs = require('node:fs/promises'), path = require('node:path');
global.ASMTraceProvenance = require('../../public/trace-provenance');
const A = require('../../public/asmdeck');
const { createHash } = require('node:crypto');
const { gzipSync } = require('node:zlib');
const { buildDefaultAlgorithmAssets } = require('./default-algorithm-assets');
(async () => {
  const deck = await A.decode(new Blob([await fs.readFile(path.join(__dirname, '../../public/guest-decks/linear-sieve.asmdeck'))]));
  await buildDefaultAlgorithmAssets(deck.deck);
  if (process.argv.includes('--with-trace')) {
    const baseIndex = process.argv.indexOf('--base-url');
    const base = baseIndex >= 0 ? process.argv[baseIndex + 1] : 'http://127.0.0.1:3100';
    const nativeFetch = global.fetch;
    global.fetch = (url, init) => nativeFetch(new URL(String(url), base), init);
    global.ASMTraceModel = { normalizeTraceDocument: value => JSON.parse(JSON.stringify(value)) };
    global.ASMTraceViewSource = require('../../public/trace-view-source');
    const recipe = deck.deck.groups.flatMap(group => group.slides || []).find(slide => slide.animation).animation;
    const animation = await A.rebuildMissingAnimation(recipe);
    const totalFrames = animation.traceDocument.frames.length;
    const engineVersion = `${global.ASMTraceProvenance.ENGINE_VERSION}/${global.ASMTraceProvenance.FORMAT_VERSION}`;
    const directory = path.join(__dirname, '../../public/default-animation');
    async function publish(kind, selected) {
      const payload = { format: 'AlgoShowMaker.default-animation', packageVersion: 1, kind, engineVersion, totalFrames, animation: selected };
      const json = JSON.stringify(payload);
      const contentHash = createHash('sha256').update(json).digest('hex');
      const bytes = Buffer.concat([Buffer.from('ASMTRACE1\n'), gzipSync(json)]);
      const name = `linear-sieve-${kind}-${contentHash}.asmtrace`;
      await fs.writeFile(path.join(directory, name), bytes);
      return { url: `/default-animation/${name}`, contentHash, bytes: bytes.length };
    }
    const full = await publish('full', animation);
    const preview = await publish('preview', { ...animation, traceDocument: { ...animation.traceDocument, frames: animation.traceDocument.frames.slice(0, 1) } });
    await fs.writeFile(path.join(directory, 'cached.json'), JSON.stringify({ format: 'AlgoShowMaker.default-animation', packageVersion: 1,
      engineVersion, totalFrames, generationFingerprint: animation.traceDocument.provenance?.generationFingerprint, full, preview }, null, 2) + '\n');
    console.log(JSON.stringify({ cachedDefault: true, totalFrames, bytes: full.bytes }));
    return;
  }
  console.log('Default linear sieve recipe published without Trace payloads');
})().catch(error => { console.error(error); process.exitCode = 1; });
