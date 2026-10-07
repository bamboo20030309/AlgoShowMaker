const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('temporary workshop entry opens the supplied deck and returns to homepage without gallery or cloud writes', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  let writes = 0, compilation = 0, archives = 0, traces = 0;
  page.on('request', req => {
    if (req.url().includes('/temporary-decks/')) archives++;
    if (req.url().includes('/deck-traces/')) traces++;
    if (req.url().endsWith('/compile')) compilation++;
    if (req.url().includes('/api/') && ['PUT', 'DELETE'].includes(req.method())) writes++;
  });
  await page.route('**/compile', r => r.fulfill({ status: 500, json: { error: 'No compilation expected when opening saved workshop' } }));
  await page.goto(base + '/workshop.html');
  const ready = () => page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
  await ready();
  assert.match(page.url(), /slides\.html\?temporary=workshop/);
  assert.equal(await page.title(), 'AlgoShowMaker 工作坊 - AlgoShowMaker');
  assert.equal(await page.locator('#chromeHomeLink').getAttribute('href'), '/');
  assert.equal(await page.locator('#chromeHomeLink').getAttribute('aria-label'), '回到首頁');
  const stored = () => page.evaluate(async () => ASMSlideStorage.create(indexedDB, localStorage)
    .loadDeck('asm_reveal_fabric_deck_v5:share:sample:temporary:workshop', [], { lazyTraces: true }));
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  assert.equal((await stored()).groups.flatMap(g => g.slides).length, 48);
  assert.equal(archives, 1);
  assert.equal(traces, 0, 'opening cover does not download all animation traces');
  const archive = await page.evaluate(async () => ASMDeck.decode(await (await fetch('/temporary-decks/workshop-renumbered.asmdeck?v=20261007-2')).blob()));
  const animations = archive.deck.groups.flatMap(g => g.slides).filter(s => s.animation);
  assert.equal(animations.length, 13);
  assert.ok(animations.every(s => /^[a-f0-9]{64}$/.test(s.animation.traceRef) && !s.animation.traceDocument && !s.animation.prebuilt));
  const current = await stored();
  const location = current.groups.flatMap((g, h) => g.slides.map((s, v) => ({ s, h, v }))).find(x => x.s.kind === 'algorithm-animation');
  await page.evaluate(({h,v}) => Reveal.slide(h,v), location);
  await page.waitForFunction(() => [...document.querySelectorAll('.algorithm-slide-frame')].some(frame => {
    try { return frame.contentWindow.ASMTracePlayer?.getDocument()?.frames?.length > 0; } catch { return false; }
  }));
  assert.equal(traces, 1, 'only visited animation fetches its independent trace');
  await page.evaluate(() => Reveal.slide(0,0));
  const downloadEvent = page.waitForEvent('download');
  await page.locator('#exportDeckBtn').click();
  const exported = require('node:fs').readFileSync(await (await downloadEvent).path());
  const packageData = JSON.parse(require('node:zlib').gunzipSync(exported.subarray(9)));
  assert.equal(packageData.body.prebuiltTraces, undefined, 'UI export contains no complete traces');
  assert.ok(packageData.body.deck.groups.flatMap(g => g.slides).filter(s => s.animation)
    .every(s => s.animation.traceRef && !s.animation.traceDocument));
  assert.equal(traces, 1, 'exporting references does not fetch all traces');
  await page.reload(); await ready();
  assert.equal(archives, 2, 'reload uses local copy (one extra archive request belongs to format inspection)');
  assert.equal((await stored()).groups.flatMap(g => g.slides).length, 48);
  assert.equal(writes, 0); assert.equal(compilation, 0);
  const catalog = await (await fetch(base + '/guest-decks.json')).json();
  assert.ok(!catalog.decks.some(d => d.archive.includes('workshop')), 'temporary deck is not in gallery');
  await page.locator('#chromeHomeLink').click();
  await page.waitForURL(base + '/');
  await page.waitForFunction(() => !document.querySelector('#guestView').hidden);
  assert.equal(await page.locator('#authForm').isVisible(), true);

  // Reference-only imports remain editable when the independent result is absent.
  const missing = structuredClone(archive.deck);
  const target = missing.groups.flatMap(g => g.slides).find(s => s.kind === 'algorithm-animation');
  target.animation.traceRef = 'f'.repeat(64);
  const sourceCode = target.animation.code;
  const editor = await browser.newPage();
  await editor.goto(base + '/slides.html');
  await editor.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready'));
  const bytes = await editor.evaluate(async deck => Array.from(new Uint8Array(await (await ASMDeck.encode({ deck, assets: {} })).arrayBuffer())), missing);
  await editor.locator('#importDeckInput').setInputFiles({ name: 'references.asmdeck', mimeType: 'application/octet-stream', buffer: Buffer.from(bytes) });
  await editor.waitForFunction(() => document.body.dataset.localDeckSave === 'saved'
    && document.querySelectorAll('section.asm-slide').length === 48);
  await editor.evaluate(({h,v}) => Reveal.slide(h,v), location);
  await editor.waitForFunction(() => [...document.querySelectorAll('.algorithm-slide-placeholder span')].some(el => el.textContent.includes('重新 RUN')));
  if (!await editor.evaluate(() => document.body.classList.contains('asm-edit-mode'))) await editor.locator('#modeToggleBtn').click();
  await editor.locator('#algorithmEditSlideBtn').click();
  const editingFrame = await (await editor.waitForSelector('#algorithmEditorFrame')).contentFrame();
  await editingFrame.waitForFunction(code => typeof aceEditor !== 'undefined' && aceEditor.getValue() === code, sourceCode);
  await editor.close();
});
