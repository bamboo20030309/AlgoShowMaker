const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const animation = require('./fixtures/missing-prefix-animation.json');
global.ASMTraceProvenance = require('../public/trace-provenance');
const archive = require('../public/asmdeck');

test('workshop prefix animation with a missing ID rebuilds once, renders and survives reload', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const deck = { groups: [{ id: 'g', slides: [{ id: 'missing', kind: 'algorithm-animation',
    animation, canvas: { objects: [] }, widgets: [] }] }] };
  const buffer = Buffer.from(await (await archive.encode({ deck, assets: {} })).arrayBuffer());
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const context = await browser.newContext();
  await context.route('**/guest-decks.json', route => route.fulfill({ json: { decks: [{ id: 'missing-test', title: 'Trace recovery', archive: '/missing-test.asmdeck' }] } }));
  await context.route('**/missing-test.asmdeck', route => route.fulfill({ body: buffer }));
  await context.route('**/api/user/preferences/event-settings', route => route.fulfill({ json: { eventSettings: {} } }));
  let compiles = 0;
  context.on('request', request => { if (new URL(request.url()).pathname === '/compile') compiles++; });
  const page = await context.newPage();
  await page.goto(base + '/slides.html?sample=missing-test');
  const player = await (await page.waitForSelector('.algorithm-slide-frame')).contentFrame();
  await player.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 0);
  await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
  assert.equal(compiles, 1);
  const trace = await player.evaluate(() => ASMTracePlayer.getDocument());
  assert.equal(trace.studio.eventSettings.autoFixedEnabled, false);
  assert.equal(trace.studio.eventSettings.autoLoopBoundaryEnabled, false);
  assert.equal(trace.frames.length, 9);
  assert.ok(await player.locator('svg').count(), 'actual player canvas exists');
  await page.reload();
  const reopened = await (await page.waitForSelector('.algorithm-slide-frame')).contentFrame();
  await reopened.waitForFunction(() => ASMTracePlayer.getDocument()?.frames?.length > 0);
  assert.equal(compiles, 1, 'reopen uses the saved replacement Trace');
  assert.equal((await reopened.evaluate(() => ASMTracePlayer.getDocument())).studio.eventSettings.autoFixedEnabled, false);
});
