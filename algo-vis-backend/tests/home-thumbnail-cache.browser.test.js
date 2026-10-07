const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('workspace thumbnails reuse only current account/revision and survive reload without deck downloads', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
  let owner = 'a', downloads = 0, fullDecks = 0;
  let decks = ['one', 'two'].map(id => ({ deck_uid: id, title: id, updated_at: '2026-10-07T01:00:00Z', has_thumbnail: true, slide_count: 1 }));
  const pixels = await page.evaluate(() => ['red', 'blue'].map(color => {
    const c = document.createElement('canvas'); c.width = c.height = 10; const ctx = c.getContext('2d'); ctx.fillStyle = color; ctx.fillRect(0,0,10,10); return c.toDataURL();
  }));
  await page.route('**/api/auth/me', r => r.fulfill({ json: { user: { id: owner, username: owner } } }));
  await page.route('**/api/slides', r => {
    assert.equal(r.request().headers()['x-asm-thumbnail-mode'], 'lazy');
    return r.fulfill({ json: { slides: decks } });
  });
  await page.route('**/api/slide-library', r => r.fulfill({ json: { layout: { folders: [], unfiled: decks.map(d => d.deck_uid) } } }));
  await page.route('**/api/slides/*/thumbnail', r => {
    downloads++; const id = r.request().url().split('/').at(-2), deck = decks.find(d => d.deck_uid === id);
    return r.fulfill({ json: { thumbnail: pixels[deck.updated_at.includes('02:') ? 1 : 0], updated_at: deck.updated_at } });
  });
  await page.route(/\/api\/slides\/[^/]+$/, r => { fullDecks++; return r.fulfill({ status: 500, json: {} }); });
  const ready = async () => {
    await page.waitForFunction(count => document.querySelectorAll('#deckGrid .deck-cover-image').length === count
      && [...document.querySelectorAll('#deckGrid .deck-cover-image')].every(img => img.complete && img.naturalWidth > 0), decks.length);
  };
  await page.goto(base); await ready(); assert.equal(downloads, 2);
  await page.reload(); await ready(); assert.equal(downloads, 2, 'reload uses persisted thumbnails');
  decks[0].updated_at = '2026-10-07T02:00:00Z';
  await page.reload(); await ready(); assert.equal(downloads, 3, 'only updated deck downloads');
  assert.equal(await page.locator('#deckGrid .deck-cover-image').first().getAttribute('src'), pixels[1]);
  decks = decks.slice(0,1); await page.reload(); await ready(); assert.equal(downloads, 3);
  assert.equal(await page.locator('#deckGrid .deck-card').count(), 1, 'deleted deck is not restored from cache');
  owner = 'b'; await page.reload(); await ready(); assert.equal(downloads, 4, 'account cannot reuse another account cache');
  const retained = await page.evaluate(async pixel => {
    for (let i = 0; i < 66; i++) await ASMHomeThumbnailCache.put('capacity', String(i), 'revision', pixel);
    const cache = await ASMHomeThumbnailCache.load('capacity', Array.from({ length: 66 }, (_, i) => ({ deck_uid: String(i), updated_at: 'revision' })));
    return cache.size;
  }, pixels[0]);
  assert.equal(retained, 64, 'disposable thumbnail storage remains bounded');
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { value: null }));
  await page.reload(); await ready(); assert.equal(downloads, 5, 'unavailable cache falls back to download');
  assert.equal(fullDecks, 0, 'thumbnail cache never downloads full decks');
});
