'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('presentation editor stores code, input and animation locally, survives reopening and never saves the original deck', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const code = '#include <iostream>\nint main(){int n;std::cin>>n;\n// @frame n\nstd::cout<<n;}\n'
    + '/* @asm-view\n{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false},"codePanelFontSize":19}}\n@asm-view */';
  const response = await fetch(base + '/compile', { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, input: '7', trace: { enabled: true } }) });
  const compiled = await response.json();
  assert.equal(compiled.error, '');
  const animation = { mode: 'trace', code, input: '7', traceDocument: compiled.traceDocument };
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [], writes = [], messages = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    // These POST endpoints analyze/run source but do not save the deck or
    // account settings; every actual storage mutation remains forbidden.
    if (!['GET', 'HEAD'].includes(request.method()) && !['/compile', '/trace/analyze', '/syntax-tree'].includes(new URL(request.url()).pathname)) writes.push(request.url());
  });
  await page.route('**/api/user/preferences/event-settings', route => route.fulfill({ json: { eventSettings: {} } }));
  await page.addInitScript(animation => {
    if (!localStorage.getItem('runtime-local-fixture-seeded')) {
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'local-group', slides: [
        { id: 'local-slide', kind: 'algorithm-animation', animation, canvas: { objects: [] }, widgets: [] },
        { id: 'other-slide', kind: 'algorithm-animation', animation, canvas: { objects: [] }, widgets: [] }
      ] }] }));
      localStorage.setItem('runtime-local-fixture-seeded', '1');
    }
    if (new URLSearchParams(location.search).get('asmEmbed') === 'runtime') {
      localStorage.setItem('algo_jwt_token', 'local-preference-test-token');
    }
    window.__localParentMessages = [];
    window.addEventListener('message', event => { if (event.data?.type) window.__localParentMessages.push(event.data.type); });
  }, animation);
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => document.body.dataset.slideCount === '2');
  async function runtime(slideId = 'local-slide') {
    const handle = await page.waitForSelector(`.algorithm-slide-frame[data-slide-id="${slideId}"]`);
    const frame = await handle.contentFrame();
    await frame.waitForFunction(() => Boolean(window.ASMTracePlayer?.getDocument()?.frames?.length));
    return frame;
  }
  let frame = await runtime();
  assert.equal(await frame.locator('#codePanel').isVisible(), false);
  await frame.click('#runtimeLocalEditBtn');
  assert.equal(await frame.locator('#runBtn').isVisible(), true);
  assert.equal(await frame.locator('#forceRunBtn').isVisible(), true);
  const changed = code.replace('std::cout<<n;', 'std::cout<<n+1;');
  await frame.evaluate(code => { aceEditor.setValue(code, -1); document.getElementById('inputArea').value = '23'; }, changed);
  await frame.click('#runBtn');
  await frame.waitForFunction(code => ASMTracePlayer.getDocument()?.sourceCode === code && !document.getElementById('runBtn').disabled, changed);
  assert.equal((await frame.locator('#outputArea').textContent()).trim(), '24');
  await page.screenshot({ path: 'test-results/runtime-local-edit.png' });
  await frame.click('#editAnimationBtn');
  await frame.waitForFunction(() => document.body.classList.contains('asm-trace-studio-open'));
  assert.equal(await frame.locator('#traceStudioRail').isVisible(), true);
  await page.screenshot({ path: 'test-results/runtime-local-studio.png' });
  await frame.evaluate(() => {
    const trace = ASMTracePlayer.getDocument();
    trace.studio.codePanelFontSize = 21;
    trace.studio.eventSettings.autoFixedEnabled = false;
    window.dispatchEvent(new CustomEvent('asm:trace-event-settings-changed', { detail: { document: trace } }));
  });
  await frame.getByRole('button', { name: '返回程式碼', exact: true }).click();
  await frame.click('#runtimeLocalEditBtn');
  await frame.waitForFunction(() => document.getElementById('runtimeLocalStatus').textContent === '已保存在本機');
  assert.equal(await frame.locator('#codePanel').isVisible(), false);
  const originalBeforeReload = await page.evaluate(async () => {
    const storage = ASMSlideStorage.create(indexedDB, localStorage);
    return (await storage.loadDeck('asm_reveal_fabric_deck_v5')).groups[0].slides[0].animation;
  });
  assert.equal(originalBeforeReload.code, code);
  assert.equal(originalBeforeReload.input, '7');
  messages.push(...await page.evaluate(() => window.__localParentMessages));

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.slideCount === '2');
  frame = await runtime();
  assert.equal(await frame.evaluate(() => aceEditor.getValue().includes('std::cout<<n+1;')), true);
  assert.equal(await frame.locator('#inputArea').inputValue(), '23');
  assert.equal(await frame.evaluate(() => ASMTracePlayer.getDocument().studio.codePanelFontSize), 21);
  assert.equal(await frame.evaluate(() => ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled), false);
  assert.equal(await frame.locator('#codePanel').isVisible(), false);
  // A different slide with the exact same initial source must not inherit
  // this slide's local code, input or styles.
  await frame.evaluate(animation => window.postMessage({ type: 'asm-load-animation', editorSessionKey: 'other-slide', animation }, location.origin), animation);
  await frame.waitForFunction(code => aceEditor.getValue() === code, code);
  assert.equal(await frame.locator('#inputArea').inputValue(), '7');
  assert.equal(await frame.evaluate(() => ASMTracePlayer.getDocument().studio.codePanelFontSize), 19);
  await frame.evaluate(animation => window.postMessage({ type: 'asm-load-animation', editorSessionKey: 'local-slide', animation }, location.origin), animation);
  await frame.waitForFunction(() => aceEditor.getValue().includes('std::cout<<n+1;'));
  assert.equal(await frame.locator('#inputArea').inputValue(), '23');
  await frame.click('#runtimeLocalEditBtn');
  await frame.click('#runtimeLocalResetBtn');
  await frame.waitForFunction(code => aceEditor.getValue() === code, code);
  assert.equal(await frame.locator('#inputArea').inputValue(), '7');
  assert.equal(await frame.evaluate(() => ASMTracePlayer.getDocument().studio.codePanelFontSize), 19);
  await page.reload();
  frame = await runtime();
  assert.equal(await frame.evaluate(() => aceEditor.getValue()), code);
  messages.push(...await page.evaluate(() => window.__localParentMessages));
  assert.ok(!messages.includes('asm-save-animation'));
  assert.ok(!messages.includes('asm-animation-compiled'));
  assert.deepEqual(writes, [], 'no deck, trace-upload or account-preference writes');
  assert.deepEqual(errors, []);
});
