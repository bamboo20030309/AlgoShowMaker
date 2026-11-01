#!/usr/bin/env node
/**
 * 將公開範例動畫預建為獨立 Trace，投影片只保存內容 ID。
 *
 * 用法：
 *   node scripts/build/prebuild-guest-decks.js --base-url http://127.0.0.1:3100
 *   node scripts/build/prebuild-guest-decks.js --base-url http://127.0.0.1:3100 --only quick-sort,bubble-sort
 *   node scripts/build/prebuild-guest-decks.js --base-url http://127.0.0.1:3100 --force
 *
 * 腳本依 guest-decks.json 順序逐份處理，避免建置時同時占用多個編譯工作。
 * 每份檔案只有在所有動畫成功後才以原子 rename 取代，失敗不會破壞舊檔。
 */
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const publicRoot = path.join(root, 'public');
const args = process.argv.slice(2);
const option = name => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : null;
};
const baseUrl = option('--base-url') || process.env.ASM_PREBUILD_BASE_URL || 'http://127.0.0.1:3100';
const selected = new Set((option('--only') || '').split(',').map(value => value.trim()).filter(Boolean));
const force = args.includes('--force');

global.ASMTraceProvenance = require('../../public/trace-provenance.js');
global.ASMTraceViewSource = require('../../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => JSON.parse(JSON.stringify(value)) };
global.indexedDB = require('fake-indexeddb').indexedDB;
const nativeFetch = global.fetch;
global.fetch = (input, init) => {
  const url = new URL(String(input), baseUrl);
  if (force && url.pathname === '/compile' && init?.body) {
    init = { ...init, body: JSON.stringify({ ...JSON.parse(init.body), forceRecompile: true }) };
  }
  return nativeFetch(url, init);
};
const ASMDeck = require('../../public/asmdeck.js');
const { buildDefaultAlgorithmAssets } = require('./default-algorithm-assets.js');
const { registerDeckTraces } = require('./sample-trace-assets.js');

async function main() {
  const catalog = JSON.parse(await fs.readFile(path.join(publicRoot, 'guest-decks.json'), 'utf8'));
  const entries = catalog.decks.filter(entry => !selected.size || selected.has(entry.id));
  if (!entries.length) throw new Error('沒有符合 --only 的公開範例。');
  for (const entry of entries) {
    const relative = entry.archive.replace(/^\//, '').split('?')[0];
    const target = path.join(publicRoot, relative);
    const bytes = await fs.readFile(target);
    const decoded = await ASMDeck.decode(new Blob([bytes]));
    const failures = [];
    let rebuilt;
    if (force) {
      rebuilt = structuredClone(decoded.deck);
      for (const slide of rebuilt.groups.flatMap(group => group.slides || []).filter(slide => slide.kind === 'algorithm-animation')) {
        try {
          await ASMDeck.clearCache();
          slide.animation = await ASMDeck.rebuildMissingAnimation(slide.animation);
          console.log(`${entry.id}/${slide.id}: RUN ${slide.animation.traceDocument.frames.length} frames`);
        } catch (error) {
          failures.push(`${slide.id}: ${error.message}`);
        }
      }
    } else {
      rebuilt = await ASMDeck.rebuildDeck(decoded.deck, () => {}, (slide, kind) => {
        if (kind === 'pending') failures.push(`${slide.id}: ${slide.animation?.rebuildError || '重建失敗'}`);
      });
    }
    if (failures.length) throw new Error(`${entry.id} 預建失敗\n${failures.join('\n')}`);
    const projected = await ASMDeck.project(rebuilt, null, { includePrebuiltTraces: false });
    registerDeckTraces(publicRoot, entry, projected.deck, projected.cacheSeeds);
    const blob = await ASMDeck.encode(projected);
    const output = Buffer.from(await blob.arrayBuffer());
    const temporary = `${target}.prebuild-${process.pid}.tmp`;
    await fs.writeFile(temporary, output);
    await fs.rename(temporary, target);
    if (entry.id === 'linear-sieve') {
      await buildDefaultAlgorithmAssets(rebuilt, { publicRoot, engineVersion: ASMDeck.engineVersion() });
    }
    const count = projected.cacheSeeds.filter(seed => /^[a-f0-9]{64}$/.test(seed.key)).length;
    console.log(`${entry.id}: ${count} 個預建動畫，${output.length} bytes`);
  }
}

main().catch(error => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
