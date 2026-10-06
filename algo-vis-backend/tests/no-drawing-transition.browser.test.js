'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('plain RUN releases old animation, then edited KMP source creates its own trace without reload', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html');
  await page.waitForFunction(() => document.body.dataset.defaultAnimationCache === 'stored');
  const full = fs.readFileSync(path.join(__dirname, 'fixtures/kmp-toggle.cpp'), 'utf8');
  const plain = full.split('\n').filter(line => !/^\s*\/\/\s*@/.test(line)).join('\n');
  const edited = full.replace('int n = s.size();', 'int n = (int)s.size();');

  async function run(code, expectedTrace, input = 'ababaca\n', expectedOutput = '0 0 1 2 3 0 1') {
    await page.evaluate(({ code, input }) => {
      aceEditor.setValue(code, -1);
      document.getElementById('inputArea').value = input;
      window.__transitionFinished = false;
      window.addEventListener('asm:compile-finished', () => window.__transitionFinished = true, { once: true });
    }, { code, input });
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/compile' && response.request().method() === 'POST');
    await page.click('#runBtn');
    const response = await pending;
    assert.equal(response.ok(), true);
    const request = response.request().postDataJSON();
    assert.equal(request.code, code);
    assert.equal(request.trace.enabled, expectedTrace);
    const data = await response.json();
    assert.equal(data.error, '');
    assert.equal(data.output.trim(), expectedOutput);
    await page.waitForFunction(() => window.__transitionFinished);
    return data;
  }
  async function assertCleared() {
    const state = await page.evaluate(() => ({
      trace: ASMTracePlayer.getDocument(), snapshot: ASMTraceEditor.snapshot().traceDocument,
      frames: CodeScript.get_frame_count(), roots: document.querySelectorAll('#asm-trace-root').length,
      codeVisible: document.querySelector('.trace-code-panel')?.hidden === false,
      bars: document.querySelector('#frameBars')?.children.length || 0
    }));
    assert.equal(state.trace, null);
    assert.equal(state.snapshot, null);
    assert.equal(state.frames, 0);
    assert.equal(state.roots, 0);
    assert.equal(state.bars, 0);
    assert.equal(state.codeVisible, false);
    await page.evaluate(() => { CodeScript.next(); CodeScript.prev(); CodeScript.reset(); });
    assert.equal(await page.evaluate(() => ASMTracePlayer.getDocument()), null);
  }
  const first = await run(plain, false);
  assert.equal(first.traceDocument, null);
  await assertCleared();
  const second = await run(full, true);
  assert.equal(second.traceDocument.frames.length, 34);
  assert.equal(await page.evaluate(() => ASMTracePlayer.getDocument().sourceCode), full);
  assert.equal(await page.evaluate(() => CodeScript.get_frame_count()), 34);
  const third = await run(edited, true);
  assert.notEqual(third.cache.executableId, second.cache.executableId, 'edited source must not reuse the old binary');
  assert.equal(await page.evaluate(() => ASMTracePlayer.getDocument().sourceCode), edited);
  await run(plain, false, 'aaaa\n', '0 1 2 3');
  await assertCleared();

  // Reject an injected old-source response instead of relabeling its trace
  // as a new successful compilation. This is a negative contract check.
  await page.route('**/compile', async route => {
    const response = await route.fetch();
    const data = await response.json();
    data.traceDocument.sourceCode = plain;
    await route.fulfill({ response, json: data });
  }, { times: 1 });
  await run(full, true);
  await assertCleared();
  assert.match(await page.locator('#debugArea').textContent(), /回傳動畫與本次程式碼不一致/);
  // An empty editor follows the same RUN path and must show a request error,
  // clear the old scene, and leave the server available for the next RUN.
  await page.evaluate(() => {
    aceEditor.setValue('', -1);
    window.__transitionFinished = false;
    window.addEventListener('asm:compile-finished', () => window.__transitionFinished = true, { once: true });
  });
  const emptyPending = page.waitForResponse(response => new URL(response.url()).pathname === '/compile');
  await page.click('#runBtn');
  assert.equal((await emptyPending).status(), 400);
  await page.waitForFunction(() => window.__transitionFinished);
  assert.match(await page.locator('#outputArea').textContent(), /程式碼不能為空白/);
  await assertCleared();
  await run(full, true);
  assert.equal(await page.evaluate(() => CodeScript.get_frame_count()), 34);
  assert.deepEqual(errors, []);
});
