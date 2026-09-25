/**
 * 測試模組：latex-refresh.browser.test
 *
 * 驗證重點：latex refresh.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('same-ID JSON import and undo/redo refresh LaTeX without reload', { timeout: 90000 }, async () => {
  let server, browser;
  let base = process.env.ASM_TEST_BASE_URL;
  try {
    if (!base) {
      const port = await new Promise((resolve, reject) => {
        const probe = require('node:net').createServer();
        probe.on('error', reject);
        probe.listen(0, '127.0.0.1', () => {
          const value = probe.address().port;
          probe.close(() => resolve(value));
        });
      });
      server = spawn(process.execPath, ['server.js'], {
        cwd: require('node:path').resolve(__dirname, '..'),
        env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') },
        windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
      });
      base = await new Promise((resolve, reject) => {
        let output = '';
        const timer = setTimeout(() => reject(new Error('Server did not start: ' + output)), 15000);
        server.stdout.on('data', data => {
          output += data;
          const match = output.match(/localhost:(\d+)/);
          if (match) { clearTimeout(timer); resolve('http://127.0.0.1:' + match[1]); }
        });
        server.stderr.on('data', data => { output += data; });
        server.on('error', error => { clearTimeout(timer); reject(error); });
      });
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.stack || error.message));
    page.on('requestfailed', request => console.log('Failed resource:', request.url(), request.failure()?.errorText));
    await page.goto(base + '/slides.html');
    await page.waitForFunction(() => document.body.dataset.slideCount);
    const payload = content => ({ format: 'AlgoShowMaker.slides', version: 'AV_V4.3', deck: {
      groups: [{ id: 'latex-group', slides: [{ id: 'latex-slide', canvas: { version: '5.3.0', objects: [] },
        widgets: [{ id: 'latex-widget', type: 'latex', x: 100, y: 200, w: 1080, h: 100, fontSize: 32, content }],
        ttsScript: '', ttsOrder: [] }] }], ttsSettings: { rate: 1, volume: .3 }
    } });
    async function importContent(content) {
      await page.locator('#importDeckInput').setInputFiles({ name: 'latex.json', mimeType: 'application/json',
        buffer: Buffer.from(JSON.stringify(payload(content))) });
      await page.waitForFunction(content => document.querySelector('[data-widget-id="latex-widget"] .latex-content')?.dataset.latexSource === content, content);
      await page.waitForFunction(content => document.querySelector('[data-widget-id="latex-widget"] .latex-content')?.dataset.latexRenderedSource === content, content);
      assert.ok((await page.locator('[data-widget-id="latex-widget"]').innerText()).includes(content));
    }
    await importContent('OLD');
    await page.evaluate(() => { window.originalLatexWidget = document.querySelector('[data-widget-id="latex-widget"]'); });
    await importContent('NEW');
    assert.equal(await page.evaluate(() => originalLatexWidget === document.querySelector('[data-widget-id="latex-widget"]')), true);
    await page.locator('[data-widget-id="latex-widget"]').click();
    await page.locator('#latexEditorInput').fill('EDITED');
    await page.locator('#latexEditorInput').blur();
    await page.keyboard.press('Control+z');
    await page.waitForFunction(() => document.querySelector('.latex-content')?.dataset.latexSource === 'NEW');
    assert.ok((await page.locator('[data-widget-id="latex-widget"]').innerText()).includes('NEW'));
    await page.keyboard.press('Control+Shift+z');
    await page.waitForFunction(() => document.querySelector('.latex-content')?.dataset.latexSource === 'EDITED');
    assert.ok((await page.locator('[data-widget-id="latex-widget"]').innerText()).includes('EDITED'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server?.kill();
  }
});
