'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

// Real shipped archives, not a mock catalog: guard the public names and saved traces.
test('official gallery thumbnails and saved Merge Sort/Queens decks open without compiler requests', { timeout: 120000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage(), errors = [], dynamic = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/?examples=1`);
  const catalog = await (await fetch(`${base}/guest-decks.json`)).json();
  assert.equal(new Set(catalog.decks.map(deck => deck.id)).size, catalog.decks.length, 'public IDs are unique');
  for (const entry of catalog.decks) {
    const card = page.locator(`.deck-card:has(a[href="/slides.html?sample=${entry.id}"])`);
    await card.waitFor(); assert.equal(await card.locator('.deck-title').textContent(), entry.title);
  }
  for (const [id,title,tags] of [
    ['merge-sort','合併排序',['排序','分治','合併']],
    ['eight-queens-teaching','八皇后問題 (8queen)',['回溯','遞迴','剪枝']],
    ['heap-sort','堆積排序',['排序','堆積']],
    ['fibonacci-teaching','費式數列遞迴',['回溯','遞迴']]
  ]) {
    const card = page.locator(`.deck-card:has(a[href="/slides.html?sample=${id}"])`);
    assert.equal(await card.locator('.deck-title').textContent(), title);
    assert.deepEqual(await card.locator('.deck-hint').allTextContents(), tags);
    if (!['merge-sort','eight-queens-teaching'].includes(id)) continue;
    await card.locator('.deck-cover-image').waitFor({ timeout: 45000 });
    assert.ok(await card.locator('.deck-cover-image').evaluate(image => image.complete && image.naturalWidth > 0));
    const view = await browser.newPage(); view.on('pageerror', error => errors.push(error.message));
    await view.route(/\/(compile|trace\/analyze|api\/compile\/jobs)(\?|$)/, route => {
      if (route.request().method() === 'POST') { dynamic.push(route.request().url()); return route.abort(); }
      return route.continue();
    });
    await view.goto(`${base}/slides.html?sample=${id}`);
    await view.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready', null, { timeout: 60000 });
    assert.ok(await view.locator('.algorithm-slide-frame').count() > 0, 'saved animations are attached');
    await view.close();
  }
  assert.deepEqual(dynamic, [], 'prebuilt public decks must not recompile'); assert.deepEqual(errors, []);
});
