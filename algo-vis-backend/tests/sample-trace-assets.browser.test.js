const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');

test('saved legacy Trace IDs load named files, preserve view options and reopen from IndexedDB', { timeout: 60000 }, async t => {
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const requests = [];
  page.on('request', request => { if (request.url().includes('/deck-traces/')) requests.push(request.url()); });
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.ASMSampleTraceAssets && window.ASMSlideStorage);
  const state = await page.evaluate(async () => {
    const index = await (await fetch('/deck-traces/index.json')).json();
    const [id, record] = Object.entries(index.traces).find(([, item]) => item.legacy);
    const source = { traceRef: id, traceView: { showCode: false, cameraRules: [{ id: 'custom', zoom: 1.75 }] } };
    const client = ASMSlideStorage.create(indexedDB, localStorage);
    const store = ASMSlideTraceStore.create(ASMSlideStorage, client, ASMSampleTraceAssets.createLoader());
    const result = await store.materializeAnimation(source);
    localStorage.setItem('legacy-id-fixture', JSON.stringify(source));
    return { id, file: record.file, frames: result.traceDocument.frames.length,
      view: result.traceDocument.showCode, zoom: result.traceDocument.cameraRules[0].zoom };
  });
  assert.ok(state.frames > 0); assert.equal(state.view, false); assert.equal(state.zoom, 1.75);
  assert.ok(requests.some(url => url.endsWith('/deck-traces/' + state.file)));
  assert.ok(!requests.some(url => url.endsWith('/' + state.id + '.json')));
  const before = requests.length;
  await page.reload();
  await page.waitForFunction(() => window.ASMSlideStorage && window.ASMSlideTraceStore);
  const reopened = await page.evaluate(async () => {
    const source = JSON.parse(localStorage.getItem('legacy-id-fixture'));
    const client = ASMSlideStorage.create(indexedDB, localStorage);
    const store = ASMSlideTraceStore.create(ASMSlideStorage, client, () => { throw Error('Unexpected network reload'); });
    const result = await store.materializeAnimation(source);
    return { id: source.traceRef, frames: result.traceDocument.frames.length, view: result.traceDocument.showCode };
  });
  assert.equal(reopened.id, state.id); assert.equal(reopened.frames, state.frames); assert.equal(reopened.view, false);
  assert.equal(requests.length, before);
});
