/**
 * 驗證演算法工作區首次開啟時，直接使用官方線篩投影片的預建 Trace。
 * 這個案例會攔截動態分析與編譯端點，避免預設畫面悄悄退回重新 RUN。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('algorithm workspace opens the completed linear-sieve trace without compiling', { timeout: 120000 }, async () => {
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
      try { if ((await fetch(`${base}/algorithm.html`)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    const dynamicRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(/\/(compile|trace\/analyze)$/, route => {
      dynamicRequests.push(route.request().url());
      return route.abort();
    });

    await page.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length === 116);
    const state = await page.evaluate(() => {
      const trace = window.ASMTracePlayer.getDocument();
      const code = ace.edit('editor').getValue();
      return {
        code,
        input: document.getElementById('inputArea').value,
        frames: trace.frames.length,
        traceSource: trace.sourceCode,
        freshness: window.ASMTraceProvenance.status(trace, code, '100').kind,
        studioOpen: document.body.classList.contains('asm-trace-studio-open'),
        frameInfo: document.getElementById('frameInfo').textContent.trim(),
        renderedObjects: document.querySelectorAll('#arraySvg [data-trace-variable]').length
      };
    });

    assert.match(state.code, /Euler's_Sieve Sample/);
    assert.match(state.code, /@automark isprime/);
    assert.doesNotMatch(state.code, /#include "AV\.hpp"/);
    assert.equal(state.input, '100');
    assert.equal(state.frames, 116);
    assert.equal(state.traceSource, state.code);
    assert.equal(state.freshness, 'current');
    assert.equal(state.studioOpen, false);
    assert.equal(state.frameInfo, '1 / 116');
    assert.ok(state.renderedObjects > 0);
    assert.deepEqual(dynamicRequests, []);
    assert.deepEqual(errors, []);
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
