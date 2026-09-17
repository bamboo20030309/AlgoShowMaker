const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('workspace folders persist drag ordering, support mobile controls and recover failed saves', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => { const probe = net.createServer(); probe.listen(0, '127.0.0.1', () => { const p = probe.address().port; probe.close(() => resolve(p)); }); });
  const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }, windowsHide: true, stdio: 'ignore' });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base)).ok) break; } catch {} await new Promise(resolve => setTimeout(resolve, 200)); }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const Layout = require('../public/library-layout');
    const pixel = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j5yQAAAAASUVORK5CYII=';
    let decks = ['a', 'b', 'c'].map((id, i) => ({ deck_uid: id, title: ['Alpha', 'Beta', 'Gamma'][i], cover_thumbnail: pixel, updated_at: '2026-09-18', slide_count: 1 }));
    let layout = { folders: [], unfiled: ['a', 'b', 'c'] }, failSave = false;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }));
    await page.route('**/api/slides', route => route.fulfill({ json: { slides: decks } }));
    await page.route('**/api/slides/a', route => {
      if (route.request().method() === 'PUT') decks.find(deck => deck.deck_uid === 'a').title = route.request().postDataJSON().title;
      return route.fulfill({ json: { slide: decks.find(deck => deck.deck_uid === 'a') } });
    });
    await page.route('**/api/slide-library', route => {
      if (route.request().method() === 'PUT') {
        if (failSave) return route.fulfill({ status: 500, json: { error: 'fixture save failure' } });
        layout = Layout.validate(route.request().postDataJSON().layout);
      }
      return route.fulfill({ json: { layout } });
    });
    const cards = folder => page.locator(`.library-folder[data-folder-id="${folder}"] .deck-card`);
    const order = folder => cards(folder).evaluateAll(items => items.map(item => item.dataset.deckId));
    const saved = () => page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent === '資料夾與排序已儲存' && !document.querySelector('#createFolderBtn').disabled);
    await page.goto(base); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    const borders = () => page.locator('.gallery-folder:visible').first().evaluate(el => { const style = getComputedStyle(el); return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth, style.borderRadius]; });
    assert.deepEqual(await borders(), ['1px', '0px', '0px', '0px', '0px']);
    await page.locator('#createFolderBtn').click();
    assert.equal(await page.locator('#folderTitleInput').evaluate(el => el === document.activeElement), true);
    await page.locator('#cancelFolderDialogBtn').click(); assert.equal(layout.folders.length, 0);
    await page.locator('#createFolderBtn').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#folderDialog').evaluate(el => el.open), false);
    await page.locator('#createFolderBtn').click(); await page.locator('#folderTitleInput').fill('   '); await page.locator('#submitFolderBtn').click();
    assert.equal(layout.folders.length, 0); assert.equal(await page.locator('#folderTitleInput').evaluate(el => el.validity.valid), false);
    await page.locator('#folderTitleInput').fill('數學'); failSave = true; await page.locator('#submitFolderBtn').click();
    await page.waitForFunction(() => document.querySelector('#folderDialogMessage').textContent.includes('儲存失敗'));
    assert.equal(await page.locator('#folderDialog').evaluate(el => el.open), true); assert.equal(await page.locator('#folderTitleInput').inputValue(), '數學');
    failSave = false;
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({ path: path.join(root, 'test-results/create-folder-dialog.png') });
    await page.locator('#folderTitleInput').fill('數學'); await page.keyboard.press('Enter'); await saved();
    assert.equal(await page.locator('#folderDialog').evaluate(el => el.open), false);
    const folder = layout.folders[0].id;
    // Actual pointer dragging on the dedicated handle reorders the existing cards.
    const from = await page.locator('[data-deck-id="c"] .library-drag-handle').boundingBox();
    const to = await page.locator('[data-deck-id="a"] .deck-preview').boundingBox();
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await page.mouse.down();
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 12 }); await page.mouse.up(); await saved();
    assert.deepEqual(await order(''), ['c', 'a', 'b']);
    async function nativeDrop(id, selector) {
      await page.evaluate(({ id, selector }) => {
        const transfer = new DataTransfer();
        document.querySelector(`[data-deck-id="${id}"]`).dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        const target = document.querySelector(selector);
        target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: transfer }));
        target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
      }, { id, selector }); await saved();
    }
    await page.locator(`.library-folder[data-folder-id="${folder}"] summary`).click();
    await nativeDrop('a', `.library-folder[data-folder-id="${folder}"] summary`);
    assert.deepEqual(layout.folders[0].deckIds, ['a']);
    await page.locator('#libraryFolderNav button', { hasText: '數學' }).click();
    assert.equal(await page.locator(`.library-folder[data-folder-id="${folder}"]`).evaluate(el => el.open), true);
    await nativeDrop('b', `[data-deck-id="a"] .deck-preview`);
    assert.deepEqual(await order(folder), ['b', 'a']);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    assert.deepEqual(await order(folder), ['b', 'a']);
    await page.locator('#searchInput').fill('Alpha'); assert.equal(await page.locator('#deckGrid .deck-card').count(), 1);
    assert.equal(await page.locator('#deckGrid .deck-card').getAttribute('data-deck-id'), 'a'); await page.locator('#searchInput').fill('');
    await page.locator('[data-deck-id="a"] select').selectOption(''); await saved();
    assert.deepEqual(await order(''), ['c', 'a']);
    await page.locator('button[aria-label="Alpha 往前"]').click(); await saved(); assert.deepEqual(await order(''), ['a', 'c']);
    failSave = true;
    await page.locator('[data-deck-id="a"] select').selectOption(folder);
    await page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent.includes('已恢復原排序'));
    assert.deepEqual(await order(''), ['a', 'c']); failSave = false;
    page.once('dialog', dialog => dialog.accept('演算法'));
    await page.locator(`.library-folder[data-folder-id="${folder}"] button`, { hasText: '重新命名' }).click(); await saved();
    assert.equal(layout.folders[0].title, '演算法');
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#createFolderBtn').click();
    const modalBounds = await page.locator('#folderDialog').boundingBox();
    assert.ok(modalBounds.x >= 0 && modalBounds.x + modalBounds.width <= 390);
    await page.screenshot({ path: path.join(root, 'test-results/create-folder-dialog-mobile.png') });
    await page.locator('#cancelFolderDialogBtn').click();
    await page.locator('[data-deck-id="c"] select').selectOption(folder); await saved();
    assert.deepEqual(await order(folder), ['b', 'c']);
    const imageDir = path.join(root, 'test-results'); fs.mkdirSync(imageDir, { recursive: true });
    await page.screenshot({ path: path.join(imageDir, 'library-folders-mobile.png'), fullPage: true });
    page.once('dialog', dialog => dialog.accept());
    await page.locator(`.library-folder[data-folder-id="${folder}"] button`, { hasText: '移除資料夾' }).click(); await saved();
    assert.deepEqual(await order(''), ['a', 'b', 'c']); assert.equal(layout.folders.length, 0);
    decks = [decks[2], decks[1], decks[0], { ...decks[0], deck_uid: 'd', title: 'New deck' }];
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    assert.deepEqual(await order(''), ['a', 'b', 'c', 'd']);
    decks = decks.filter(deck => deck.deck_uid !== 'd');
    // The rename route below finds the deck by id after changing metadata order.
    await page.locator('[data-deck-id="a"] .deck-title').click(); await page.locator('#deckTitleInput').fill('Renamed');
    await page.locator('#deckDialogForm button[type="submit"]').click(); await page.waitForSelector('#deckDialog:not([open])', { state: 'attached' });
    assert.equal(await page.locator('[data-deck-id="a"] .deck-title').textContent(), 'Renamed');
    assert.equal(await page.locator('#createDeckBtn').isVisible(), true);
    await page.route('**/slides.html?deck=a', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Fixture editor</body></html>' }));
    await page.locator('[data-deck-id="a"] .deck-open').click(); await page.waitForURL(base + '/slides.html?deck=a');
    await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [] } }));
    await page.goto(base + '/?examples=1'); await page.waitForSelector('.gallery-folder');
    assert.deepEqual(await borders(), ['1px', '0px', '0px', '0px', '0px']);
    await page.screenshot({ path: path.join(imageDir, 'sample-folder-dividers-mobile.png'), fullPage: true });
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
