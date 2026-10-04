const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { webcrypto } = require('node:crypto');
const { chromium } = require('playwright');

global.crypto = webcrypto;
global.ASMTraceProvenance = require('../public/trace-provenance.js');
global.ASMTraceViewSource = require('../public/trace-view-source.js');
global.ASMTraceModel = { normalizeTraceDocument: value => value };
const ASMDeck = require('../public/asmdeck.js');

test('eight queens deck uses editable structures and a prebuilt teaching animation',
  { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archive = path.join(root, 'public/guest-decks/eight-queens-teaching.asmdeck');
    const decoded = await ASMDeck.decode(new Blob([fs.readFileSync(archive)]));
    assert.deepEqual(decoded.deck.groups.map(group => group.slides.length), [4, 4, 4, 6, 3]);

    const slides = decoded.deck.groups.flatMap(group => group.slides);
    const widgets = slides.flatMap(slide => slide.widgets || []);
    const structures = widgets.filter(widget => widget.type === 'structure');
    const modes = new Set(structures.map(widget => widget.structureMode));
    assert.ok(structures.length >= 14, 'most explanations use editable structure widgets');
    for (const mode of ['matrix', 'normal', 'table', 'binary_tree', 'stack', 'queue']) {
      assert.ok(modes.has(mode), `deck includes ${mode} structure`);
    }
    assert.ok(widgets.filter(widget => widget.type === 'code').length >= 2);
    assert.ok(widgets.filter(widget => widget.type === 'latex').length >= 3);

    const animations = slides.filter(slide => slide.animation);
    assert.equal(animations.length, 1);
    assert.equal(animations[0].animation.code, fs.readFileSync(path.join(root,
      'algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8'));
    assert.equal(typeof animations[0].animation.prebuilt?.traceId, 'string');
    assert.ok(animations[0].animation.traceDocument?.frames?.length > 100);

    const projected = await ASMDeck.project(decoded.deck, null, { includePrebuiltTraces: true });
    const reopened = await ASMDeck.decode(await ASMDeck.encode(projected));
    assert.deepEqual(reopened.deck, decoded.deck, 'editable widgets survive save and reopen');

    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/slides.html?sample=eight-queens-teaching`,
        { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready',
        null, { timeout: 60000 });
      assert.equal(await page.locator('.slides > section').count(), 5);
      assert.ok(await page.locator('.structure-widget').count() >= 14);
      assert.equal(await page.locator('.algorithm-slide-frame:not([hidden])').count(), 1);
      assert.equal(await page.locator('[data-layout="tree"]').count() >= 2, true);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
