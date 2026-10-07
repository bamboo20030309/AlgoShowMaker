const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createHash } = require('node:crypto');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const Storage = require('../public/slides-storage');
global.ASMTraceProvenance = require('../public/trace-provenance');
const archive = require('../public/asmdeck');

test('cloud save repairs an unseen animation and manual RUN updates cloud/export IDs together', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const code = '#include <iostream>\nint main(){int n;std::cin>>n;\n// @frame n\nstd::cout<<n;}';
  const original = { groups: [{ id: 'g', slides: [1,2].map(n => ({ id: 's'+n, kind: 'algorithm-animation',
    canvas: { objects: [] }, widgets: [], animation: { mode: 'trace', code, input: String(n),
      traceRef: String(n).repeat(64), traceView: { studio: { eventSettings: { autoFixedEnabled: false }, codePanelFontSize: 19 } } } })) }] };
  const rows = new Map(); let committed = null, commits = 0, compiles = 0;
  const read = key => {
    const entry = rows.get(key);
    if (!entry || entry.parts.size !== entry.total) throw Error('missing resource '+key);
    const text = Array.from({ length: entry.total }, (_, i) => entry.parts.get(i)).join('');
    assert.equal(createHash('sha256').update(text).digest('hex'), key);
    return text;
  };
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ acceptDownloads: true });
  await context.addInitScript(() => localStorage.setItem('algo_jwt_token', 'test-owner'));
  await context.route('**/api/user/preferences/event-settings', route => route.fulfill({ json: { eventSettings: {} } }));
  await context.route('**/api/slides/repair-deck**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const resource = path.match(/\/resources\/([a-f0-9]+)(?:\/(\d+))?$/);
    const trace = path.match(/\/traces\/([a-f0-9]+)$/);
    if (resource) {
      const key = resource[1];
      if (request.method() === 'GET') {
        const entry = rows.get(key);
        return route.fulfill({ json: { parts: entry ? [...entry.parts.keys()] : [], total: entry?.total } });
      }
      const { total, data } = request.postDataJSON();
      if (!rows.has(key)) rows.set(key, { total, parts: new Map() });
      rows.get(key).parts.set(Number(resource[2]), data);
      return route.fulfill({ json: { success: true } });
    }
    if (trace) {
      if (!rows.has(trace[1])) return route.fulfill({ status: 400, json: { error: '動畫或素材尚未完整上傳，請重試', code: 'RESOURCE_INCOMPLETE', resourceKey: trace[1] } });
      return route.fulfill({ json: { trace: JSON.parse(read(trace[1])) } });
    }
    if (path.endsWith('/content')) {
      const record = JSON.parse(read(request.postDataJSON().snapshot));
      for (const key of [...record.references.map(ref => ref.key), ...record.asset_keys]) read(key);
      committed = record; commits++;
      return route.fulfill({ json: { success: true } });
    }
    const deck = committed ? JSON.parse(JSON.stringify(committed.deck)) : original;
    if (committed) for (const ref of committed.references) {
      deck.groups[ref.groupIndex].slides[ref.slideIndex].animation.traceView = ref.view;
    }
    return route.fulfill({ json: { slide: { title: 'Repair fixture', deck } } });
  });
  context.on('request', request => { if (new URL(request.url()).pathname === '/compile') compiles++; });
  const page = await context.newPage();
  await page.goto(base + '/slides.html?deck=repair-deck');
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  const player = await (await page.waitForSelector('.algorithm-slide-frame')).contentFrame();
  await player.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 0);
  await page.waitForFunction(() => document.getElementById('cloudSaveStatus').dataset.state === 'saved')
    .catch(async error => { console.error(await page.locator('#cloudSaveStatus').textContent()); throw error; });
  // Wait for the real cloud commit, not only an intermediate local status.
  for (let attempt=0; !committed && attempt<100; attempt++) await new Promise(resolve => setTimeout(resolve,100));
  assert.ok(committed);
  assert.equal(compiles, 2, 'only current and unseen missing results are rebuilt');
  assert.equal(committed.references.length, 2);
  const oldKey = committed.references.find(ref => ref.slideIndex === 0).key;
  assert.notEqual(oldKey, '1'.repeat(64));
  if (!await page.evaluate(() => document.body.classList.contains('asm-edit-mode'))) await page.click('#modeToggleBtn');
  await page.click('#algorithmEditSlideBtn');
  const editor = await (await page.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await editor.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 0);
  if (await editor.getByRole('button', { name: '返回程式碼', exact: true }).isVisible()) await editor.getByRole('button', { name: '返回程式碼', exact: true }).click();
  const changed = code.replace('std::cout<<n;', 'std::cout<<n+1;');
  await editor.evaluate(code => { aceEditor.setValue(code,-1); document.getElementById('inputArea').value='23'; }, changed);
  await editor.click('#runBtn');
  await editor.waitForFunction(code => ASMTracePlayer.getDocument()?.sourceCode === code && !document.getElementById('runBtn').disabled, changed);
  assert.equal((await editor.locator('#outputArea').textContent()).trim(), '24');
  const beforeCommit = commits;
  await page.click('#saveAlgorithmEditorBtn');
  await page.waitForFunction(() => document.getElementById('algorithmEditorModal').hidden && document.body.dataset.localDeckSave === 'saved');
  for (let attempt=0; commits===beforeCommit && attempt<100; attempt++) await new Promise(resolve => setTimeout(resolve,100));
  assert.ok(commits>beforeCommit);
  const newKey = committed.references.find(ref => ref.slideIndex === 0).key;
  assert.notEqual(newKey, oldKey);
  const downloadEvent = page.waitForEvent('download'); await page.click('#exportDeckBtn');
  const exported = await archive.decode(new Blob([fs.readFileSync(await (await downloadEvent).path())]));
  assert.equal(exported.deck.groups[0].slides[0].animation.traceRef, newKey);
  assert.equal(exported.deck.groups[0].slides[1].animation.traceRef, committed.references.find(ref => ref.slideIndex === 1).key);
  assert.equal(exported.deck.groups[0].slides[0].animation.input, '23');
  await page.reload();
  const reopened = await (await page.waitForSelector('.algorithm-slide-frame')).contentFrame();
  await reopened.waitForFunction(code => ASMTracePlayer.getDocument()?.sourceCode === code, changed);
  assert.equal(compiles, 3, 'reload uses the committed results after the single manual RUN');
});
