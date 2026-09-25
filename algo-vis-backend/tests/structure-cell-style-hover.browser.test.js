/**
 * 測試模組：structure-cell-style-hover.browser.test
 *
 * 驗證重點：structure cell style hover.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
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
test('structure cell style buttons toggle and keep the hover color picker open during interaction', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => { const selected = probe.address().port; probe.close(() => resolve(selected)); });
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
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const widget = { id: 'array', type: 'structure', structureMode: 'normal', content: '0, 0, 0', x: 180, y: 140, w: 500, h: 150, structureFrameVersion: 4 };
    const deck = { groups: [{ id: 'g1', slides: [{ id: 's1', canvas: { objects: [] }, widgets: [widget] }] }] };
    await page.addInitScript(value => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(value)), deck);
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.body.dataset.fabricBuild?.startsWith('ready') && Reveal.isReady());
    const object = page.locator('[data-widget-id="array"]');
    await object.click();
    if (!(await page.locator('#structureLengthInput').isVisible())) {
      await page.locator('#modeToggleBtn').click();
      await object.click();
    }
    await object.locator('[data-structure-item-index="0"] > text').click();
    const toolbar = page.locator('#structureContextMenu');
    const highlight = () => toolbar.getByRole('button', { name: 'Highlight', exact: true });
    const popup = page.locator('#iroPopup');

    assert.equal(await highlight().getAttribute('aria-pressed'), 'false');
    await highlight().click();
    assert.equal(await highlight().getAttribute('aria-pressed'), 'true');
    await highlight().click();
    assert.equal(await highlight().getAttribute('aria-pressed'), 'false');
    assert.equal(await popup.isVisible(), false);

    await highlight().click();
    await page.mouse.move(10, 10);
    await page.waitForTimeout(240);
    assert.equal(await popup.isVisible(), false);
    await highlight().hover();
    assert.equal(await popup.isVisible(), true);
    await popup.hover();
    await page.waitForTimeout(240);
    assert.equal(await popup.isVisible(), true);

    await page.locator('#avColorSwatches [data-av-color="AV_blue"]').click();
    assert.equal(await popup.isVisible(), true);
    await page.locator('#iroPicker .IroBox').first().click({ position: { x: 90, y: 35 } });
    assert.equal(await popup.isVisible(), true);

    await page.mouse.move(10, 10);
    await page.waitForTimeout(260);
    assert.equal(await popup.isVisible(), false);
  } finally {
    await browser?.close();
    server.kill();
  }
});
