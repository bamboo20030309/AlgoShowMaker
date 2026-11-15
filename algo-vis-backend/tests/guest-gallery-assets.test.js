'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), { gunzipSync } = require('node:zlib');
global.ASMTraceProvenance = require('../public/trace-provenance');
global.ASMTraceViewSource = require('../public/trace-view-source');
const archive = require('../public/asmdeck');
const { readPackage, savedTrace } = require('./helpers/deck-package');
const { canonical } = require('../public/slides-storage');
const root = path.resolve(__dirname, '../public');

test('every real catalog asset has an intact archive and executable recipes without persisted Trace results', async () => {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'guest-decks.json')));
  for (const entry of catalog.decks) {
    const relative = entry.archive.split('?')[0].replace(/^\//, '');
    const absolute = path.resolve(root, relative);
    assert.ok(absolute.startsWith(root + path.sep), 'public archives cannot escape the asset root');
    const bytes = fs.readFileSync(absolute);
    assert.equal(bytes.subarray(0, 9).toString(), 'ASMDECK2\n');
    assert.ok(relative.includes(await archive.sha256(bytes)),'published URL hash matches its actual bytes');
    const payload = readPackage(bytes);
    assert.equal(await archive.sha256(JSON.stringify(payload.body)), payload.manifest.contentHash, entry.id);
    const decoded = await archive.decode(new Blob([bytes]));
    assert.ok(decoded.deck.groups.length > 0, entry.id);
    const slides = payload.body.deck.groups.flatMap(group => group.slides || []);
    for (const slide of slides.filter(slide => slide.animation)) {
      assert.equal(slide.animation.traceRef,undefined);assert.equal(slide.animation.traceDocument,undefined);assert.equal(slide.animation.prebuilt,undefined);
      assert.ok(slide.animation.code.trim());assert.equal(typeof slide.animation.input,'string');assert.match(slide.animation.executableRef?.id||'',/^[a-f0-9]{64}$/);
      assert.equal(slide.animation.executionPolicy,'executable-only-v1');
    }
  }
});
test('legacy embedded trace descriptors are rejected at export with a clear error', async () => {
  await assert.rejects(() => archive.encode({ assets: {}, deck: { groups: [{ slides: [{
    id: 'broken', kind: 'algorithm-animation', animation: { code: 'int main(){}', input: '', prebuilt: { traceId: 'missing' } }
  }] }] } }), /不允許內嵌完整 Trace/);
});
