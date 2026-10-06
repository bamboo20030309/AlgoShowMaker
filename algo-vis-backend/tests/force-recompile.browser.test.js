'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');

test('force button and editor shortcut launch the compiler despite warm caches, normal RUN still reuses them', { timeout: 90000 }, async t => {
  const preload = path.join(__dirname, 'fixtures/count-compiler-spawns.cjs');
  const { base, logs } = await startIsolatedServer(t, { NODE_OPTIONS: `--require ${JSON.stringify(preload)}` });
  const launches = () => (logs.join('').match(/ASM_TEST_COMPILER_SPAWN/g) || []).length;
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html');
  await page.waitForFunction(() => document.body.dataset.defaultAnimationCache === 'stored');
  const code = '#include <iostream>\nint main(){int n;std::cin>>n;\n// @frame n\nstd::cout<<n;}';
  await page.evaluate(code => { aceEditor.setValue(code, -1); document.getElementById('inputArea').value = '17\n'; }, code);
  const requests = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/compile') requests.push(request.postDataJSON()); });
  async function run(action, forced) {
    await page.evaluate(() => {
      window.__forceRunFinished = false;
      window.addEventListener('asm:compile-finished', () => window.__forceRunFinished = true, { once: true });
    });
    const pending = page.waitForResponse(response => new URL(response.url()).pathname === '/compile');
    await action();
    const response = await pending;
    const sent = response.request().postDataJSON();
    assert.equal(sent.code, code);
    assert.equal(sent.forceRecompile, forced);
    const result = await response.json();
    assert.equal(response.status(), 200);
    assert.equal(result.error, '');
    assert.equal(result.output.trim(), '17');
    await page.waitForFunction(() => window.__forceRunFinished);
    assert.equal(await page.evaluate(() => ASMTracePlayer.getDocument().sourceCode), code);
    assert.equal(await page.locator('#runBtn').isEnabled(), true);
    assert.equal(await page.locator('#forceRunBtn').isEnabled(), true);
    return { response, result, sent };
  }
  const warm = await run(() => page.click('#runBtn'), false);
  assert.equal(launches(), 1);
  await run(() => page.click('#runBtn'), false);
  assert.equal(launches(), 1, 'normal RUN actually reuses the binary');

  // Seed the exact shared Trace cache as well as the executable cache.
  const seeded = await page.request.post(base + '/compile', { data: { ...warm.sent, cachePolicy: 'shared' } });
  assert.equal(seeded.status(), 200);
  const hit = await page.request.post(base + '/compile', { data: { ...warm.sent, cachePolicy: 'shared' } });
  assert.equal(hit.headers()['x-compile-trace-cache'], 'HIT');
  const forcedShared = await page.request.post(base + '/compile', { data: { ...warm.sent, cachePolicy: 'shared', forceRecompile: true } });
  assert.equal(forcedShared.headers()['x-compile-trace-cache'], 'BYPASS');
  assert.equal(forcedShared.headers()['x-compile-executable-cache'], 'BYPASS');
  assert.equal((await forcedShared.json()).output.trim(), '17');
  assert.equal(launches(), 2, 'forced shared request must launch a real compiler');

  const button = await run(() => page.click('#forceRunBtn'), true);
  assert.equal(button.result.cache.executable, 'BYPASS');
  assert.equal(launches(), 3);
  await page.evaluate(() => aceEditor.focus());
  await run(() => page.keyboard.press('Control+Shift+Enter'), true);
  assert.equal(launches(), 4);
  assert.equal(await page.evaluate(() => aceEditor.getValue()), code, 'shortcut must not insert a line in Ace');
  await run(() => page.keyboard.press('Control+Enter'), false);
  assert.equal(launches(), 4);
  await run(() => page.keyboard.press('Meta+Shift+Enter'), true);
  assert.equal(launches(), 5);

  // While one request is pending, both controls and both shortcuts must stay
  // locked; forced execution still uses the same request lifecycle.
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let entered;
  const routed = new Promise(resolve => { entered = resolve; });
  await page.route('**/compile', async route => { entered(); await gate; await route.continue(); }, { times: 1 });
  const pendingRun = run(() => page.click('#forceRunBtn'), true);
  await routed;
  assert.equal(await page.locator('#runBtn').isDisabled(), true);
  assert.equal(await page.locator('#forceRunBtn').isDisabled(), true);
  const before = requests.length;
  await page.keyboard.press('Control+Enter');
  await page.keyboard.press('Control+Shift+Enter');
  release();
  await pendingRun;
  assert.equal(requests.length, before, 'busy shortcuts cannot submit duplicate work');
  assert.equal(launches(), 6);
  const positions = await page.evaluate(() => ({
    normal: document.getElementById('runBtn').getBoundingClientRect().right,
    force: document.getElementById('forceRunBtn').getBoundingClientRect().left
  }));
  assert.ok(positions.force >= positions.normal, 'force button belongs to the right of RUN');
  assert.deepEqual(errors, []);
});
