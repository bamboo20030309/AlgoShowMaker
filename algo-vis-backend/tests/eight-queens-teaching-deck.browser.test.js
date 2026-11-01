const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startStaticUiServer } = require('./helpers/static-ui-server');
const { readPackage, savedTrace } = require('./helpers/deck-package');
const Provenance = require('../public/trace-provenance');

test('published queens deck retains three methods, lazy Trace IDs and editable structures through import/export', { timeout: 60000 }, async t => {
  const archive = path.join(__dirname, '../public/guest-decks/eight-queens-teaching.asmdeck');
  const payload = readPackage(fs.readFileSync(archive));
  const slides = payload.body.deck.groups.flatMap(group => group.slides);
  const animations = slides.filter(slide => slide.animation).map(slide => slide.animation);
  assert.equal(animations.length, 3, 'loop, recursive-array and bit-mask methods remain published');
  assert.ok(slides.flatMap(slide => slide.widgets || []).some(widget => widget.type === 'structure'));
  for (const animation of animations) {
    const trace = savedTrace(payload.body, animation);
    assert.ok(trace.frames.length > 10);
    assert.equal(trace.provenance.sourceFingerprint, Provenance.create(animation.code, animation.input).sourceFingerprint);
    assert.equal(animation.traceDocument, undefined);
    assert.equal(animation.prebuilt, undefined);
  }
  const { base } = await startStaticUiServer(t);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  const errors = [], compiles = [], traceLoads = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => {
    if (/\/compile(?:\?|$)/.test(request.url())) compiles.push(request.url());
    if (/\/deck-traces\/.+\.json/.test(request.url()) && !request.url().endsWith('/index.json')) traceLoads.push(request.url());
  });
  await page.goto(base + '/slides.html');
  await page.waitForFunction(() => window.Reveal?.isReady());
  await page.locator('#importDeckInput').setInputFiles(archive);
  await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready' && document.body.dataset.localDeckSave === 'saved');
  assert.equal(await page.locator('.slides > section').count(), payload.body.deck.groups.length);
  assert.deepEqual(compiles, [], 'current published metadata needs no compilation');
  assert.deepEqual(traceLoads, [], 'importing the cover does not eagerly load hidden animations');
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#exportDeckBtn').click();
  const downloaded = readPackage(fs.readFileSync(await (await downloadPromise).path()));
  const restored = downloaded.body.deck.groups.flatMap(g => g.slides).filter(s => s.animation).map(s => s.animation);
  assert.deepEqual(restored.map(a => a.traceRef), animations.map(a => a.traceRef));
  assert.ok(restored.every(a => !a.traceDocument && !a.prebuilt));
  assert.equal(downloaded.body.prebuiltTraces, undefined);
  assert.deepEqual(errors, []);
});
