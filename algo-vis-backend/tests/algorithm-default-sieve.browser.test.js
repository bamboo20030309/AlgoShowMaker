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

test('algorithm workspace paints a preview, loads the standalone trace, then reuses IndexedDB', { timeout: 120000 }, async () => {
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
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await context.newPage();
    const errors = [];
    const dynamicRequests = [];
    const assetRequests = [];
    let releaseFull;
    const fullGate = new Promise(resolve => { releaseFull = resolve; });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route(/\/(compile|trace\/analyze)$/, route => {
      dynamicRequests.push(route.request().url());
      return route.abort();
    });
    await page.route(/\/guest-decks\/linear-sieve\.asmdeck/, route => {
      assetRequests.push(route.request().url());
      return route.abort();
    });
    await page.route(/\/default-animation\/linear-sieve-(preview|full)\.asmtrace/, async route => {
      assetRequests.push(route.request().url());
      if (route.request().url().includes('-full.asmtrace')) await fullGate;
      return route.continue();
    });

    await page.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length === 1
      && document.body.dataset.defaultAnimationState === 'loading');
    const preview = await page.evaluate(() => ({
      frames: window.ASMTracePlayer.getDocument().frames.length,
      frameInfo: document.getElementById('frameInfo').textContent.trim(),
      renderedObjects: document.querySelectorAll('#arraySvg [data-trace-variable]').length,
      controlsDisabled: ['playToggleBtn', 'nextBtn', 'finishBtn']
        .every(id => document.getElementById(id).disabled),
      source: document.body.dataset.defaultAnimationSource
    }));
    assert.deepEqual(preview, {
      frames: 1,
      frameInfo: '1 / 116 · 載入中',
      renderedObjects: preview.renderedObjects,
      controlsDisabled: true,
      source: 'preview'
    });
    assert.ok(preview.renderedObjects > 0);

    releaseFull();
    await page.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length === 116);
    await page.waitForFunction(() => document.body.dataset.defaultAnimationCache === 'stored');
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
        renderedObjects: document.querySelectorAll('#arraySvg [data-trace-variable]').length,
        source: document.body.dataset.defaultAnimationSource,
        controlsEnabled: ['playToggleBtn', 'nextBtn', 'finishBtn']
          .every(id => !document.getElementById(id).disabled)
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
    assert.equal(state.source, 'network');
    assert.equal(state.controlsEnabled, true);
    assert.equal(assetRequests.filter(url => url.includes('guest-decks')).length, 0);
    assert.equal(assetRequests.filter(url => url.includes('-preview.asmtrace')).length, 1);
    assert.equal(assetRequests.filter(url => url.includes('-full.asmtrace')).length, 1);
    assert.deepEqual(dynamicRequests, []);
    assert.deepEqual(errors, []);

    const cachedPage = await context.newPage();
    const cachedAssetRequests = [];
    const cachedDynamicRequests = [];
    await cachedPage.route(/\/(compile|trace\/analyze)$/, route => {
      cachedDynamicRequests.push(route.request().url());
      return route.abort();
    });
    await cachedPage.route(/\/default-animation\/linear-sieve-(preview|full)\.asmtrace/, route => {
      cachedAssetRequests.push(route.request().url());
      return route.abort();
    });
    await cachedPage.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });
    await cachedPage.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length === 116
      && document.body.dataset.defaultAnimationSource === 'indexeddb');
    assert.equal(await cachedPage.locator('#frameInfo').textContent(), '1 / 116');
    assert.deepEqual(cachedAssetRequests, []);
    assert.deepEqual(cachedDynamicRequests, []);
    await cachedPage.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase('asm-default-animation-cache');
      request.onsuccess = resolve;
      request.onerror = () => reject(request.error);
    }));
    await cachedPage.close();

    const cancelPage = await context.newPage();
    let releaseCancelledFull;
    const cancelledFullGate = new Promise(resolve => { releaseCancelledFull = resolve; });
    await cancelPage.route(/\/default-animation\/linear-sieve-full\.asmtrace/, async route => {
      await cancelledFullGate;
      return route.continue();
    });
    await cancelPage.goto(`${base}/algorithm.html`, { waitUntil: 'domcontentloaded' });
    await cancelPage.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length === 1
      && document.body.dataset.defaultAnimationState === 'loading');
    await cancelPage.evaluate(() => ace.edit('editor').setValue('int main() { return 0; }', -1));
    releaseCancelledFull();
    await cancelPage.waitForFunction(() => document.body.dataset.defaultAnimationState === 'cancelled');
    await cancelPage.waitForTimeout(200);
    assert.equal(await cancelPage.evaluate(() => ace.edit('editor').getValue()), 'int main() { return 0; }');
    assert.equal(await cancelPage.evaluate(() => window.ASMTracePlayer.getDocument().frames.length), 1);
    await cancelPage.close();
    await context.close();
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
