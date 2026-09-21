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
      const expected = await page.evaluate(() => {
        window.setCamera(321.25, -147.5, 1.73, false);
        return window.getCameraViewport();
      });

      for (const tab of ['tab-input', 'tab-output', 'tab-debug', 'tab-syntax-tree']) {
        await page.locator(`.tab-btn[data-tab="${tab}"]`).click();
        await page.locator('.tab-btn[data-tab="tab-canvas"]').click();
        await page.evaluate(() => new Promise(requestAnimationFrame));
        const actual = await page.evaluate(() => window.getCameraViewport());
        assert.ok(Math.abs(actual.centerX - expected.centerX) < 0.001, `${tab} keeps camera x`);
        assert.ok(Math.abs(actual.centerY - expected.centerY) < 0.001, `${tab} keeps camera y`);
        assert.ok(Math.abs(actual.scale - expected.scale) < 0.001, `${tab} keeps camera scale`);
      }

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
