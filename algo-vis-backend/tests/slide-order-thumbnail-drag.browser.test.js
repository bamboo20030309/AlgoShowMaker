/**
 * 測試模組：slide-order-thumbnail-drag.browser.test
 *
 * 驗證重點：slide order thumbnail drag.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('slide order zoom preserves geometry and static thumbnail drag ordering', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const value = probe.address().port;
      probe.close(() => resolve(value));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root,
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
    windowsHide: true,
    stdio: 'ignore'
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 80; attempt += 1) {
      try {
        if ((await fetch(base)).ok) break;
      } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const deck = {
      groups: ['first', 'second', 'third'].map((name, index) => ({
        id: `group-${name}`,
        slides: [{
          id: `slide-${name}`,
          canvas: { objects: [{ type: 'textbox', text: name, left: 280, top: 220, width: 600, fontSize: 72, fontFamily: 'Arial' }] },
          widgets: index === 0 ? [{ id: 'code-widget', type: 'code', x: 80, y: 420, w: 620, h: 180, code: 'const value = 1;' }] : []
        }]
      }))
    };
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    await page.locator('#slideOrderToggleBtn').click();
    await page.waitForSelector('#customOverview:not([hidden])');
    await page.waitForFunction(() => [...document.querySelectorAll('.custom-overview-thumb')].every(thumb => thumb.dataset.thumbnailReady === 'true'));

    const storageSnapshot = () => page.evaluate(async () => ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5'));
    const before = await storageSnapshot();
    const zoom = () => page.locator('#slideZoomValue').evaluate(el => el.value);
    const width = () => page.locator('.custom-overview-thumb').first().evaluate(el => el.getBoundingClientRect().width);
    assert.equal(await zoom(), '100%');
    assert.equal(await width(), 360);
    await page.locator('#slideZoomInBtn').click();
    assert.equal(await zoom(), '110%');
    assert.ok(Math.abs(await width() - 396) < 0.1);
    await page.keyboard.press('Control+=');
    assert.equal(await zoom(), '120%');
    await page.keyboard.press('Control+-');
    assert.equal(await zoom(), '110%');
    const wheelTarget = await page.locator('.custom-overview-thumb.is-selected').boundingBox();
    await page.mouse.move(wheelTarget.x + wheelTarget.width / 2, wheelTarget.y + wheelTarget.height / 2);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await page.waitForFunction(() => document.body.dataset.overviewZoom === '1.2');
    await page.mouse.wheel(0, 100);
    assert.equal(await zoom(), '120%');
    await page.keyboard.press('Control+0');
    assert.equal(await zoom(), '100%');
    for (let i = 0; i < 12; i++) await page.keyboard.press('Control+-');
    assert.equal(await zoom(), '50%');
    assert.equal(await page.locator('#slideZoomOutBtn').isDisabled(), true);
    for (let i = 0; i < 20; i++) await page.keyboard.press('Control+=');
    assert.equal(await zoom(), '200%');
    assert.equal(await page.locator('#slideZoomInBtn').isDisabled(), true);
    await page.locator('#slideZoomResetBtn').click();
    await page.locator('#slideOrderToggleBtn').click();
    assert.equal(await zoom(), '100%');
    await page.keyboard.press('Control+=');
    assert.equal(await zoom(), '110%');
    assert.equal(await page.evaluate(() => document.body.dataset.slideZoom), '1.1');
    await page.mouse.move(900, 400);
    await page.keyboard.down('Control');
    await page.mouse.wheel(0, -100);
    await page.keyboard.up('Control');
    await page.waitForFunction(() => document.body.dataset.slideZoom === '1.2');
    assert.equal(await zoom(), '120%');
    await page.locator('#slideOrderToggleBtn').click();
    assert.equal(await zoom(), '100%');
    await page.locator('#slideZoomOutBtn').click();
    assert.equal(await zoom(), '90%');
    assert.ok(Math.abs(await width() - 324) < 0.1);
    assert.deepEqual(await storageSnapshot(), before);

    const sourceMarkup = await page.locator('.custom-overview-thumb').first().evaluate(thumb => ({
      images: thumb.querySelectorAll('.custom-overview-snapshot').length,
      interactive: thumb.querySelectorAll('canvas, input, select, textarea, a, .widget-layer, .slide-widget').length
    }));
    assert.deepEqual(sourceMarkup, { images: 1, interactive: 0 });

    await page.locator('.custom-overview-thumb').nth(1).scrollIntoViewIfNeeded();
    const source = await page.locator('.custom-overview-thumb').nth(0).boundingBox();
    const target = await page.locator('.custom-overview-thumb').nth(1).boundingBox();
    assert.ok(source && target);
    await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
    await page.mouse.down();
    await page.mouse.move(target.x + target.width * 0.75, target.y + target.height / 2, { steps: 12 });
    await page.waitForSelector('.overview-drag-ghost[data-preview-mode="thumbnail"]');
    const ghost = await page.locator('.overview-drag-ghost').evaluate(element => {
      const frame = element.querySelector('.custom-overview-drag-thumbnail');
      const rect = frame.getBoundingClientRect();
      return {
        images: element.querySelectorAll('img').length,
        interactive: element.querySelectorAll('button, input, select, textarea, a, canvas, .widget-layer, .slide-widget').length,
        aspect: rect.width / rect.height
      };
    });
    assert.equal(ghost.images, 1);
    assert.equal(ghost.interactive, 0);
    assert.ok(Math.abs(ghost.aspect - 16 / 9) < 0.02);
    await page.mouse.up();
    await page.waitForFunction(() => !document.querySelector('.overview-drag-ghost'));
    await page.waitForFunction(async () => {
      const stored = await ASMSlideStorage.create(indexedDB, localStorage).loadDeck('asm_reveal_fabric_deck_v5');
      return stored.groups.flatMap(group => group.slides).map(slide => slide.id).join(',') === 'slide-second,slide-first,slide-third';
    });
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const reopened = await storageSnapshot();
    for (const oldSlide of before.groups.flatMap(group => group.slides)) {
      const actual = reopened.groups.flatMap(group => group.slides).find(slide => slide.id === oldSlide.id);
      assert.deepEqual(actual.canvas.objects, oldSlide.canvas.objects);
      assert.deepEqual(actual.widgets, oldSlide.widgets);
    }
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
