/**
 * 測試模組：tab-camera-syntax-tree.browser.test
 *
 * 驗證重點：tab camera syntax tree.browser.test 相關功能的公開行為、回歸條件與錯誤邊界。
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

function freePort() {
  return new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('subtabs preserve the canvas camera and syntax tree zoom has no UI limits',
  { timeout: 60000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const port = await freePort();
    const server = spawn(process.execPath, ['server.js'], {
      cwd: root,
      env: {
        ...process.env,
        PORT: String(port),
        ASM_REGRESSION: '1',
        JWT_SECRET: randomBytes(32).toString('hex')
      },
      windowsHide: true,
      stdio: 'ignore'
    });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let attempt = 0; attempt < 80; attempt += 1) {
        try {
          if ((await fetch(`${base}/algorithm.html`)).ok) break;
        } catch {}
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      browser = await chromium.launch({
        headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
      });
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/syntax-tree', route => route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          nodeCount: 3,
          root: {
            type: 'TranslationUnit', text: '', line: 1, depth: 0, children: [
              { type: 'FunctionDefinition', text: 'int main()', line: 1, depth: 1, children: [
                { type: 'ReturnStatement', text: 'return 0;', line: 2, depth: 2, children: [] }
              ] }
            ]
          }
        })
      }));
      await page.goto(`${base}/algorithm.html`);
      await page.waitForFunction(() => window.setCamera && window.getCameraViewport && window.ASMSyntaxTree);
      await page.waitForFunction(() => document.body.dataset.defaultAnimationState === 'ready');
      const expected = await page.evaluate(() => {
        window.setCamera(321.25, -147.5, 1.73, false);
        window.setPresentationCameraTransform({ panXRatio: .12, panYRatio: -.08, zoomFactor: 1.3 });
        return window.getCameraViewport();
      });

      for (const tab of ['tab-input', 'tab-output', 'tab-debug', 'tab-syntax-tree']) {
        await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
        await page.locator('.tab-btn[data-tab="tab-canvas"]').click();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const actual = await page.evaluate(() => window.getCameraViewport());
        assert.ok(Math.abs(actual.centerX - expected.centerX) < 0.001, `${tab} keeps camera x: ${JSON.stringify({ expected, actual })}`);
        assert.ok(Math.abs(actual.centerY - expected.centerY) < 0.001, `${tab} keeps camera y`);
        assert.ok(Math.abs(actual.scale - expected.scale) < 0.001, `${tab} keeps camera scale`);
      }

      // A real standalone wheel gesture must persist only in this tab's local camera scope.
      const canvasBox = await page.locator('#arraySvg').boundingBox();
      await page.mouse.move(canvasBox.x + canvasBox.width / 2, canvasBox.y + canvasBox.height / 2);
      await page.mouse.wheel(0, -120);
      await page.waitForFunction(() => sessionStorage.getItem('asm:temporary-camera:v1:algorithm:playback') !== null);
      const localCamera = await page.evaluate(() => getPresentationCameraTransform());
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.defaultAnimationState === 'ready');
      assert.deepEqual(await page.evaluate(() => getPresentationCameraTransform()), localCamera,
        'standalone algorithm.html retains its own post-offset after reload');
      const traceBefore = await page.evaluate(() => JSON.stringify(ASMTracePlayer.getDocument()));
      await page.evaluate(() => resetTemporaryCamera());
      assert.equal(await page.evaluate(() => getPresentationCameraTransform().zoomFactor), 1);
      assert.equal(await page.evaluate(() => JSON.stringify(ASMTracePlayer.getDocument())), traceBefore,
        'resetting the local post-offset must not alter the Trace');

      await page.locator('.tab-btn[data-tab="tab-syntax-tree"]').click();
      await page.waitForFunction(() => document.getElementById('syntaxTreeSvg')?.dataset.nodeCount === '3');
      const viewWidth = () => page.locator('#syntaxTreeSvg').evaluate(svg => (
        Number(svg.getAttribute('viewBox').split(/\s+/)[2])
      ));
      const wheel = deltaY => page.locator('#syntaxTreeSvg').evaluate((svg, delta) => {
        const rect = svg.getBoundingClientRect();
        svg.dispatchEvent(new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + rect.width / 2,
          clientY: rect.top + rect.height / 2,
          deltaY: delta
        }));
      }, deltaY);
      const fittedWidth = await viewWidth();
      await wheel(1200);
      assert.ok(await viewWidth() > fittedWidth, 'zooming out can go beyond the fitted whole-tree view');
      await page.evaluate(() => window.ASMSyntaxTree.fit());
      for (let index = 0; index < 4; index += 1) await wheel(-1000);
      assert.ok(await viewWidth() < fittedWidth * 0.035,
        'zooming in can pass the former 3.5% minimum view width');
      assert.deepEqual(errors, []);
    } finally {
      if (browser) await browser.close();
      server.kill();
    }
  });
