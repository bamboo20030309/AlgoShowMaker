#!/usr/bin/env node
'use strict';
// Publish portable source/settings + native executable IDs. Results never become assets.
const fs = require('node:fs/promises');
const path = require('node:path');
const args = process.argv.slice(2);
const option = name => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const publicRoot = path.resolve(option('--public-root') || path.join(__dirname, '../../public'));
const base = option('--base-url') || 'http://127.0.0.1:3100';
const nativeFetch = global.fetch;
global.fetch = (input, init) => nativeFetch(new URL(String(input), base), init);
global.ASMTraceProvenance = require('../../public/trace-provenance');
global.ASMTraceViewSource = require('../../public/trace-view-source');
global.ASMTraceModel = { normalizeTraceDocument: value => JSON.parse(JSON.stringify(value)) };
const A = require('../../public/asmdeck');
const Recipe = require('../../public/animation-recipe');
async function write(file, bytes) {
  const target = path.resolve(publicRoot, file.replace(/^\//, '').split('?')[0]);
  if (!target.startsWith(publicRoot + path.sep)) throw new Error('Asset path escaped public');
  const tmp = target + '.' + process.pid + '.tmp';
  await fs.writeFile(tmp, bytes); await fs.rename(tmp, target);
}
async function main() {
  const catalog = JSON.parse(await fs.readFile(path.join(publicRoot, 'guest-decks.json'), 'utf8'));
  if (args.includes('--verify-only')) {
    let verified = 0;
    for (const entry of catalog.decks) {
      const bytes = await fs.readFile(path.join(publicRoot, entry.archive.slice(1)));
      if (!entry.archive.includes(await A.sha256(bytes))) throw new Error(entry.id + ': archive URL hash mismatch');
      const cover = await A.readCover(new Blob([bytes]));
      const body = JSON.parse(require('node:zlib').gunzipSync(bytes.subarray(cover?.bodyOffset || 9))).body;
      if (Object.keys(body.prebuiltTraces || {}).length) throw new Error(entry.id + ': embedded Trace payload');
      for (const slide of body.deck.groups.flatMap(group => group.slides || [])) if (slide.animation) {
        const a = slide.animation;
        if (!a.code?.trim() || a.traceRef || a.traceDocument || a.prebuilt || !/^[a-f0-9]{64}$/.test(a.executableRef?.id || '')) throw new Error(entry.id + '/' + slide.id + ': invalid executable recipe');
        verified++;
      }
    }
    console.log(JSON.stringify({ decks: catalog.decks.length, animations: verified, traceAssets: 0 })); return;
  }
  let count = 0;
  const published = new Set();
  for (const entry of catalog.decks) {
    const source = entry.source_archive || entry.archive.split('?')[0];
    const decoded = await A.decode(new Blob([await fs.readFile(path.join(publicRoot, source.slice(1)))]));
    for (const slide of decoded.deck.groups.flatMap(group => group.slides || [])) {
      if (!slide.animation) continue;
      if (!slide.animation.code?.trim()) throw new Error(`${entry.id}/${slide.id}: no recoverable source`);
      if (args.includes('--prewarm')) {
        const rebuilt = await A.rebuildMissingAnimation(slide.animation);
        if (!rebuilt.traceDocument?.frames?.length) throw new Error(`${entry.id}/${slide.id}: no frames`);
        slide.animation = Recipe.strip(rebuilt);
      } else slide.animation = Recipe.strip(slide.animation);
      count++;
    }
    const projected = await A.project(decoded.deck);
    if (decoded.cover) projected.cover = decoded.cover;
    const bytes = Buffer.from(await (await A.encode(projected)).arrayBuffer());
    const hash = await A.sha256(bytes);
    const archive = `/guest-decks/${path.basename(source, '.asmdeck')}-${hash}.asmdeck`;
    await write(source, bytes); await write(archive, bytes);
    published.add(path.basename(archive));
    entry.source_archive = source; entry.archive = archive; entry.execution_policy = 'executable-only-v1';
    delete entry.trace_generation;
    if (entry.id === 'linear-sieve') {
      const animation = projected.deck.groups.flatMap(group => group.slides || []).find(slide => slide.animation)?.animation;
      await write('/default-animation/manifest.json', JSON.stringify({ format: 'AlgoShowMaker.default-animation', packageVersion: 2, id: 'linear-sieve', animation }, null, 2) + '\n');
    }
    console.log(`${entry.id}: recipe published`);
  }
  // Old URLs stay importable but also contain no embedded result payloads.
  for (const name of await fs.readdir(path.join(publicRoot, 'guest-decks'))) {
    if (!name.endsWith('.asmdeck') || published.has(name)) continue;
    const decoded = await A.decode(new Blob([await fs.readFile(path.join(publicRoot, 'guest-decks', name))]));
    const projected = await A.project(decoded.deck);
    if (decoded.cover) projected.cover = decoded.cover;
    await write('/guest-decks/' + name, Buffer.from(await (await A.encode(projected)).arrayBuffer()));
  }
  await write('/guest-decks.json', JSON.stringify(catalog, null, 2) + '\n');
  console.log(JSON.stringify({ decks: catalog.decks.length, animations: count, traceAssets: 0 }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
