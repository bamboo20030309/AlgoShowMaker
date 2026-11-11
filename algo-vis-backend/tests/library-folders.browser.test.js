/**
 * 測試模組：library-folders.browser.test
 *
 * 驗證重點：投影片工作區的資料夾、排序、改名、刪除與拖曳。
 * 執行環境：隔離服務＋無頭瀏覽器；所有 API 以 route 模擬，不寫入資料庫。
 * 規格（2026-11-11）：每份投影片只屬於一個分類（拖進資料夾即移動）；卡片底列為
 * 「刪除｜往前、往後（左右箭頭）」；雙擊標題直接在卡片上改名，離開輸入框自動儲存、Esc 放棄；
 * 整張卡片可拖曳，原位置留殘影、完整卡片複本跟著指標；沒有分類對話框、拖曳把手與設定按鈕。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('playwright');

test('workspace folders keep one category per deck, persist drag ordering and recover failed saves', { timeout: 150000 }, async () => {
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
    decks[2].cover_thumbnail = null;
    let layout = { folders: [], unfiled: ['a', 'b', 'c'] }, failSave = false;
    const renames = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1600 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    page.on('dialog', async dialog => { errors.push('Unexpected native dialog: ' + dialog.type()); await dialog.dismiss(); });
    await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
    await page.route('**/api/auth/me', route => route.fulfill({ json: { user: { id: 'fixture', username: 'fixture' } } }));
    await page.route('**/api/slides', route => route.fulfill({ json: { slides: decks } }));
    await page.route('**/deck-thumbnail.js?*', route => route.fulfill({ contentType: 'application/javascript', body: `window.AlgoDeckThumbnail = { create: async () => { await new Promise(resolve => setTimeout(resolve, 200)); return ${JSON.stringify(pixel)}; } };` }));
    await page.route('**/api/slides/*', route => {
      const id = route.request().url().split('/').pop();
      const deck = decks.find(item => item.deck_uid === id);
      if (route.request().method() === 'PUT') { deck.title = route.request().postDataJSON().title; renames.push(deck.title); }
      return route.fulfill({ json: { slide: deck } });
    });
    await page.route('**/api/slide-library', route => {
      if (route.request().method() === 'PUT') {
        if (failSave) return route.fulfill({ status: 500, json: { error: 'fixture save failure' } });
        layout = Layout.validate(route.request().postDataJSON().layout);
      }
      return route.fulfill({ json: { layout } });
    });
    const cards = folder => page.locator(`.library-folder[data-folder-id="${folder}"] .deck-card[data-deck-id]`);
    const order = folder => cards(folder).evaluateAll(items => items.map(item => item.dataset.deckId));
    const saved = () => page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent === '資料夾與排序已儲存' && !document.querySelector('#createFolderBtn').disabled);
    // Drag a whole card (from any area) and drop it on a selector.
    async function pointerDrop(id, targetSelector, area = '.deck-preview', { expectSave = true, during } = {}) {
      const source = await page.locator(`[data-deck-id="${id}"] ${area}`.trim()).boundingBox();
      const target = await page.locator(targetSelector).first().boundingBox();
      await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2); await page.mouse.down();
      await page.mouse.move(target.x + target.width / 2, target.y + Math.min(target.height / 2, 14), { steps: 12 });
      if (during) await during();
      await page.mouse.up();
      if (expectSave) await saved();
    }
    await page.goto(base); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    await page.waitForSelector('[data-deck-id="a"] .deck-cover-image');
    assert.equal(await page.locator('[data-deck-id="a"] .deck-cover-image').evaluate(el => el.draggable), false);
    assert.equal(await page.locator('[data-deck-id="c"] .deck-cover-image').count(), 0, 'missing covers stay placeholders without loading deck bodies');

    // Card chrome: trash at the far left, left/right arrows; no handle, category button or settings.
    assert.deepEqual(await page.locator('[data-deck-id="a"] .library-card-controls > *').evaluateAll(items => items.map(item => item.getAttribute('aria-label') || item.className)),
      ['刪除 Alpha', 'library-card-spacer', 'Alpha 往前', 'Alpha 往後']);
    assert.equal(await page.locator('.library-drag-handle, .library-categories-button, .deck-settings, #categoryDialog, #deckDialog').count(), 0);
    // New deck and new folder are borderless icon buttons side by side in the toolbar.
    assert.deepEqual(await page.locator('#workspaceMinePanel .library-toolbar > button').evaluateAll(items => items.map(item => [item.id, item.getAttribute('aria-label'), getComputedStyle(item).borderTopWidth])),
      [['createFolderBtn', '新增資料夾', '0px'], ['createDeckBtn', '新增投影片', '0px']]);

    const borders = () => page.locator('.gallery-folder:visible').first().evaluate(el => { const style = getComputedStyle(el); return [style.borderTopWidth, style.borderRightWidth, style.borderBottomWidth, style.borderLeftWidth, style.borderRadius]; });
    assert.deepEqual(await borders(), ['1px', '0px', '0px', '0px', '0px']);

    // New folder (2026-11-12): no dialog. A focused name row appears at the bottom of the list;
    // Enter or leaving the field creates it, Escape or an empty name cancels, a failed save keeps the text.
    const newFolderInput = page.locator('.library-folder-new .library-folder-name-input');
    assert.equal(await page.locator('#folderDialog').count(), 0);
    await page.locator('#createFolderBtn').click();
    assert.equal(await newFolderInput.evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#deckGrid .library-folder').last().evaluate(el => el.classList.contains('library-folder-new')), true);
    await page.keyboard.press('Escape'); assert.equal(await newFolderInput.count(), 0); assert.equal(layout.folders.length, 0);
    await page.locator('#createFolderBtn').click(); await newFolderInput.fill('   '); await page.keyboard.press('Enter');
    assert.equal(await newFolderInput.count(), 0); assert.equal(layout.folders.length, 0);
    await page.locator('#createFolderBtn').click(); await newFolderInput.fill('數學'); failSave = true; await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent.includes('儲存失敗'));
    assert.equal(layout.folders.length, 0); assert.equal(await newFolderInput.inputValue(), '數學', 'the typed name survives a failed save');
    failSave = false;
    await newFolderInput.focus(); await page.keyboard.press('Enter'); await saved();
    assert.equal(await newFolderInput.count(), 0);
    const folder = layout.folders[0].id;
    // Folder header: name, "共 N 份" beside it, and only a trash button.
    assert.deepEqual(await page.locator(`.library-folder[data-folder-id="${folder}"] summary`).evaluate(el => ({
      name: el.querySelector('.library-folder-name').textContent, count: el.querySelector('.library-folder-count').textContent,
      buttons: [...el.querySelectorAll('button')].map(button => button.getAttribute('aria-label')) })),
      { name: '數學', count: '共 0 份', buttons: ['移除資料夾'] });

    // Whole-card drag reorders from any part of the card; the origin stays as a ghost and a full copy follows.
    let dragState;
    await pointerDrop('c', '[data-deck-id="a"] .deck-preview', '.deck-preview', { during: async () => {
      dragState = await page.evaluate(() => {
        const clone = document.querySelector('.library-drag-clone');
        return { clone: Boolean(clone), full: Boolean(clone?.querySelector('.deck-preview') && clone?.querySelector('.library-card-controls')),
          ghost: Number(getComputedStyle(document.querySelector('[data-deck-id="c"]')).opacity) < 1 };
      });
    } });
    assert.deepEqual(dragState, { clone: true, full: true, ghost: true });
    assert.equal(await page.locator('.library-drag-clone').count(), 0, 'the floating copy is removed after dropping');
    assert.deepEqual(await order(''), ['c', 'a', 'b']);
    for (const [id, area, expected] of [
      ['a', '.deck-meta', ['a', 'c', 'b']],
      ['c', '.deck-title', ['c', 'a', 'b']],
      ['a', '.library-card-spacer', ['a', 'c', 'b']],
      ['c', '.deck-preview', ['c', 'a', 'b']]
    ]) {
      await pointerDrop(id, `[data-deck-id="${id === 'a' ? 'c' : 'a'}"] .deck-preview`, area);
      assert.deepEqual(await order(''), expected);
      assert.equal(page.url(), base + '/', 'dragging never opens the deck');
    }

    // Dragging into a folder moves the deck there (single category).
    await pointerDrop('a', `.library-folder[data-folder-id="${folder}"] summary`);
    assert.deepEqual(layout.folders[0].deckIds, ['a']); assert.deepEqual(await order(''), ['c', 'b']);
    await page.locator('#libraryFolderNav button', { hasText: '數學' }).click();
    assert.equal(await page.locator(`.library-folder[data-folder-id="${folder}"]`).evaluate(el => el.open), true);
    await pointerDrop('b', '[data-deck-id="a"] .deck-preview');
    assert.deepEqual(await order(folder), ['b', 'a']); assert.deepEqual(await order(''), ['c']);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    assert.deepEqual(await order(folder), ['b', 'a']);
    // Search is a magnifier icon; the field opens to its left and filters as you type.
    assert.equal(await page.locator('#searchInput').evaluate(el => el.getBoundingClientRect().width), 0);
    const searchIcon = await page.locator('#searchToggleBtn').boundingBox();
    await page.locator('#searchToggleBtn').click();
    await page.waitForFunction(() => document.getElementById('searchInput').getBoundingClientRect().width >= 179);
    const field = await page.locator('#searchInput').boundingBox();
    assert.ok(field.x + field.width <= searchIcon.x + 1, 'the field opens to the left of the icon');
    assert.equal(Math.round((await page.locator('#searchToggleBtn').boundingBox()).x), Math.round(searchIcon.x), 'the icon stays put');
    await page.keyboard.type('Alpha'); assert.equal(await page.locator('#deckGrid .deck-card[data-deck-id]').count(), 1);
    assert.equal(await page.locator('#deckGrid .deck-card[data-deck-id]').getAttribute('data-deck-id'), 'a');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#searchInput').inputValue(), ''); assert.equal(await page.locator('.library-search').getAttribute('data-open'), 'false');

    // Left/right arrows reorder; a failed save restores the previous order.
    await page.locator('button[aria-label="Alpha 往前"]').click(); await saved(); assert.deepEqual(await order(folder), ['a', 'b']);
    assert.equal(await page.locator('button[aria-label="Alpha 往前"]').isDisabled(), true);
    failSave = true;
    await page.locator('button[aria-label="Alpha 往後"]').click();
    await page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent.includes('已恢復原排序'));
    assert.deepEqual(await order(folder), ['a', 'b']); failSave = false;

    // A deck dragged into a second folder leaves the first one.
    async function createCategory(title) {
      await page.locator('#createFolderBtn').click(); await newFolderInput.fill(title); await page.keyboard.press('Enter'); await saved();
      return layout.folders.find(item => item.title === title).id;
    }
    const second = await createCategory('圖論');
    await pointerDrop('b', `.library-folder[data-folder-id="${second}"] summary`);
    assert.deepEqual(await order(folder), ['a']); assert.deepEqual(await order(second), ['b']);
    assert.equal(await page.locator('#deckGrid [data-deck-id="b"]').count(), 1);

    // Old data with a deck in two folders shows it once (first folder) and saves it that way next time.
    layout = { folders: [{ id: folder, title: '數學', deckIds: ['a', 'b'] }, { id: second, title: '圖論', deckIds: ['b'] }], unfiled: ['c'] };
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    assert.equal(await page.locator('#deckGrid [data-deck-id="b"]').count(), 1);
    assert.deepEqual(await order(folder), ['a', 'b']); assert.deepEqual(await order(second), []);
    await page.locator('button[aria-label="Beta 往前"]').click(); await saved();
    assert.deepEqual(layout.folders.map(item => item.deckIds), [['b', 'a'], []]);

    // Folder rename: click the name to edit in place (no rename button, no dialog). Clicking the
    // name does not collapse the folder; Escape keeps the old name; a failed save keeps the old name.
    assert.equal(await page.locator('.library-folder').getByRole('button', { name: '重新命名', exact: true }).count(), 0);
    const folderName = () => page.locator(`.library-folder[data-folder-id="${folder}"] .library-folder-name`);
    const folderNameInput = page.locator(`.library-folder[data-folder-id="${folder}"] .library-folder-name-input`);
    await folderName().click();
    assert.equal(await folderNameInput.inputValue(), '數學');
    assert.equal(await page.locator(`.library-folder[data-folder-id="${folder}"]`).evaluate(el => el.open), true);
    await folderNameInput.fill('不要'); await page.keyboard.press('Escape');
    assert.equal(await folderName().textContent(), '數學'); assert.equal(layout.folders[0].title, '數學');
    await folderName().click(); await folderNameInput.fill('演算法'); failSave = true; await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('#libraryLayoutMessage').textContent.includes('儲存失敗'));
    assert.equal(layout.folders[0].title, '數學'); assert.equal(await folderName().textContent(), '數學'); failSave = false;
    await folderName().click(); await folderNameInput.fill('演算法'); await page.keyboard.press('Enter'); await saved();
    assert.equal(layout.folders[0].title, '演算法');
    // The folder trash turns red on hover, like the card trash.
    const folderTrash = page.locator(`.library-folder[data-folder-id="${folder}"] .library-folder-delete`);
    await folderTrash.hover(); const folderTrashColor = await folderTrash.evaluate(el => getComputedStyle(el).color);
    const cardTrash = page.locator('[data-deck-id="c"] .library-delete-button');
    await cardTrash.hover(); assert.equal(folderTrashColor, await cardTrash.evaluate(el => getComputedStyle(el).color));
    // Removal; removed folders send their decks to 未分類.
    const removeFolder = id => page.locator(`.library-folder[data-folder-id="${id}"]`).getByRole('button', { name: '移除資料夾', exact: true }).click();
    await removeFolder(second); assert.ok((await page.locator('#deleteFolderName').textContent()).includes('圖論'));
    assert.equal(await page.locator('#cancelDeleteFolderBtn').evaluate(el => el === document.activeElement), true);
    await page.locator('#cancelDeleteFolderBtn').click(); assert.equal(layout.folders.length, 2);
    await removeFolder(folder); failSave = true; await page.locator('#deleteFolderSubmit').click();
    await page.waitForFunction(() => document.querySelector('#deleteFolderMessage').textContent.includes('儲存失敗'));
    assert.equal(layout.folders.length, 2); failSave = false; await page.locator('#deleteFolderSubmit').click(); await saved();
    assert.deepEqual(await order(''), ['c', 'b', 'a']);
    await removeFolder(second); await page.locator('#deleteFolderSubmit').click(); await saved();
    assert.equal(layout.folders.length, 0);

    // New decks from the server appear in 未分類.
    decks = [...decks, { ...decks[0], deck_uid: 'd', title: 'New deck' }];
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);
    assert.deepEqual(await order(''), ['c', 'b', 'a', 'd']);
    decks = decks.filter(deck => deck.deck_uid !== 'd');
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#createFolderBtn').disabled);

    // Rename in place: single click does nothing, double-click edits, leaving the field saves, Escape cancels.
    await page.locator('[data-deck-id="a"] .deck-title').click();
    assert.equal(page.url(), base + '/');
    await page.locator('[data-deck-id="a"] .deck-title').dblclick();
    const input = page.locator('[data-deck-id="a"] .deck-title-input');
    assert.equal(await input.evaluate(el => el === document.activeElement), true);
    await input.fill('Renamed'); await page.locator('#workspaceMinePanel .library-toolbar').click({ position: { x: 5, y: 5 } });
    await page.waitForFunction(() => document.querySelector('[data-deck-id="a"] .deck-title')?.textContent === 'Renamed');
    assert.deepEqual(renames, ['Renamed']);
    await page.locator('[data-deck-id="b"] .deck-title').dblclick();
    await page.locator('[data-deck-id="b"] .deck-title-input').fill('Discarded'); await page.keyboard.press('Escape');
    assert.equal(await page.locator('[data-deck-id="b"] .deck-title').textContent(), 'Beta');
    await page.locator('[data-deck-id="c"] .deck-title').dblclick();
    await page.locator('[data-deck-id="c"] .deck-title-input').fill('Gamma 2'); await page.keyboard.press('Enter');
    await page.waitForFunction(() => document.querySelector('[data-deck-id="c"] .deck-title')?.textContent === 'Gamma 2');
    assert.deepEqual(renames, ['Renamed', 'Gamma 2']);

    // Mobile: no horizontal overflow; the inline new-folder row fits.
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.locator('#createFolderBtn').click();
    const rowBounds = await newFolderInput.boundingBox();
    assert.ok(rowBounds.x >= 0 && rowBounds.x + rowBounds.width <= 390);
    await page.keyboard.press('Escape');
    const imageDir = path.join(root, 'test-results'); fs.mkdirSync(imageDir, { recursive: true });
    await page.screenshot({ path: path.join(imageDir, 'library-folders-mobile.png'), fullPage: true });

    // Opening a deck still works from its preview.
    await page.route('**/slides.html?deck=a', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Fixture editor</body></html>' }));
    await page.locator('[data-deck-id="a"] .deck-open').click(); await page.waitForURL(base + '/slides.html?deck=a');

    // Public gallery categories (unchanged): a sample can list several algorithm categories.
    await page.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [
      { id: 'multi', title: 'Multi category', categories: ['Tree', 'Graph', 'Tree'], archive: '/fixture-multi.asmdeck' },
      { id: 'legacy', title: 'Legacy category', category: 'Basic', archive: '/fixture-legacy.asmdeck' }
    ] } }));
    await page.goto(base + '/?examples=1'); await page.waitForSelector('.gallery-folder');
    assert.deepEqual(await borders(), ['1px', '0px', '0px', '0px', '0px']);
    assert.equal(await page.locator('#sample-category-Tree .deck-card').count(), 1);
    assert.equal(await page.locator('#sample-category-Graph .deck-card').count(), 1);
    assert.equal(await page.locator('#sample-category-Basic .deck-card').count(), 1);
    assert.equal(await page.locator('#galleryCount').textContent(), '共 2 份');
    assert.deepEqual(errors, []);
  } finally { if (browser) await browser.close(); server.kill(); }
});
