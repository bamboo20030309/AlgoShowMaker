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

test('eight queens draft has three vertical method chapters and prebuilt animations',
  { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archive = path.join(root, 'drafts/eight-queens-teaching.asmdeck');
    const decoded = await ASMDeck.decode(new Blob([fs.readFileSync(archive)]));
    const rawArchive = JSON.parse(require('node:zlib').gunzipSync(fs.readFileSync(archive).subarray(9)));
    assert.deepEqual(decoded.deck.groups.map(group => group.slides.length), [4, 5, 6, 6, 5]);

    const slides = decoded.deck.groups.flatMap(group => group.slides);
    for (const slide of slides.filter(item => !item.animation)) {
      const objects = slide.canvas.objects;
      assert.ok(objects.some(item => item.type === 'rect' && item.left === 64 &&
        item.top === 49 && item.width === 32 && item.fill === '#1d8f83'));
      assert.ok(objects.some(item => item.type === 'rect' && item.top === 655));
      assert.ok(objects.some(item => item.type === 'textbox' && item.top === 91 &&
        item.fontSize === 38));
      assert.ok(objects.some(item => item.type === 'textbox' && item.top === 671 &&
        /^\d{2}$/.test(item.text)));
    }
    const widgets = slides.flatMap(slide => slide.widgets || []);
    const structures = widgets.filter(widget => widget.type === 'structure');
    assert.ok(structures.length >= 18);
    const modes = new Set(structures.map(widget => widget.structureMode));
    for (const mode of ['matrix', 'normal', 'table', 'binary_tree']) {
      assert.ok(modes.has(mode), `deck includes ${mode} structure`);
    }
    assert.ok(widgets.filter(widget => widget.type === 'code').length >= 3);
    assert.ok(widgets.filter(widget => widget.type === 'latex').length >= 3);

    const animations = slides.filter(slide => slide.animation);
    assert.equal(animations.length, 3);
    assert.equal(animations.length, 3);
    // This archived draft predates later sample edits. Verify each stored
    // Trace belongs to its own code/input, rather than today's mutable files.
    for (const { animation } of animations) {
      const storedTrace = rawArchive.body.prebuiltTraces[animation.prebuilt.traceId];
      assert.ok(storedTrace?.frames?.length > 10, 'the portable bundle contains the complete animation');
      assert.notEqual(ASMTraceProvenance.status(storedTrace, animation.code, animation.input).kind, 'dirty');
    }
    assert.ok(animations.every(slide => typeof slide.animation.prebuilt?.traceId === 'string'));
    assert.ok(animations.every(slide => slide.animation.rebuild?.view || slide.animation.traceDocument?.frames?.length > 10),
      'older engine bundles are retained as rebuildable source');

    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'public/guest-decks.json'), 'utf8'));
    assert.equal(catalog.decks.find(entry => entry.id === 'eight-queens-teaching')?.title, '八皇后問題 (8queen)',
      'the user subsequently published the separate final deck');
    assert.notDeepEqual(fs.readFileSync(path.join(root, 'public/guest-decks/eight-queens-teaching.asmdeck')),
      fs.readFileSync(archive), 'the private draft is not substituted for the published deck');

    const report = JSON.parse(fs.readFileSync(path.join(root,
      'docs/benchmarks/eight-queens-5s.json'), 'utf8'));
    assert.deepEqual(Object.fromEntries(report.summaries.map(item => [item.method, item.n])), {
      loop: 9, array: 13, bits: 15
    });

    await assert.rejects(ASMDeck.project(decoded.deck, null, { includePrebuiltTraces: true }),
      /缺少可重建|尚未更新/, 'an old-engine deck must rebuild before exporting a current bundle');

    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(`${base}/slides.html`, { waitUntil: 'domcontentloaded' });
      await page.locator('#importDeckInput').setInputFiles(archive);
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready',
        null, { timeout: 60000 });
      assert.equal(await page.locator('.slides > section').count(), 5);
      assert.ok(await page.locator('.structure-widget').count() >= 18);
      assert.equal(await page.locator('.algorithm-slide-frame:not([hidden])').count(), 3);
      assert.deepEqual(errors, []);
      const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exportDeckBtn').click()]);
      const reopened = await ASMDeck.decode(new Blob([fs.readFileSync(await download.path())]));
      const restoredAnimations = reopened.deck.groups.flatMap(g => g.slides).filter(s => s.animation).map(s => s.animation);
      assert.equal(restoredAnimations.length, 3);
      assert.ok(restoredAnimations.every(a => a.traceDocument?.frames?.length > 10));
      assert.deepEqual(restoredAnimations.map(a => ASMTraceProvenance.create(a.code, a.input)),
        animations.map(s => ASMTraceProvenance.create(s.animation.code, s.animation.input)), 'rebuild/export retains each original program and input');
      const previewDir = path.join(root, 'test-results/eight-queens-draft');
      fs.mkdirSync(previewDir, { recursive: true });
      await page.screenshot({ path: path.join(previewDir, 'hanoi-layout-cover.png') });
    } finally {
      await browser.close();
    }
  });
