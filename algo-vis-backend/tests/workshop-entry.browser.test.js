const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('temporary workshop entry opens the supplied deck and returns to homepage without gallery or cloud writes', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  let writes = 0, compilation = 0, archives = 0;
  page.on('request', req => {
    if (req.url().includes('/temporary-decks/')) archives++;
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
  await page.reload(); await ready();
  assert.equal(archives, 1, 'reload uses the isolated local copy');
  assert.equal((await stored()).groups.flatMap(g => g.slides).length, 48);
  assert.equal(writes, 0); assert.equal(compilation, 0);
  const catalog = await (await fetch(base + '/guest-decks.json')).json();
  assert.ok(!catalog.decks.some(d => d.archive.includes('workshop')), 'temporary deck is not in gallery');
  await page.locator('#chromeHomeLink').click();
  await page.waitForURL(base + '/');
  await page.waitForFunction(() => !document.querySelector('#guestView').hidden);
  assert.equal(await page.locator('#authForm').isVisible(), true);
});
