const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const { gunzipSync } = require('node:zlib');
const { chromium } = require('playwright');
const Storage = require('../public/slides-storage');

test('slides fetch Trace only upon visiting its page, save IDs and play after reopen/export',
  { timeout: 90000 }, async () => {
    const root = path.resolve(__dirname, '..');
    const archive = JSON.parse(gunzipSync(fs.readFileSync(path.join(root,
      'drafts/eight-queens-teaching.asmdeck')).subarray(9)));
    const existing = archive.body.deck.groups[1].slides.at(-1).animation;
    const trace = archive.body.prebuiltTraces[existing.prebuilt.traceId];
    trace.frames = trace.frames.slice(0, 3);
    const animation = { ...existing, traceDocument: trace }; delete animation.prebuilt;
    const source = { groups: [
      { id: 'cover-group', slides: [{ id: 'cover', canvas: { objects: [] }, widgets: [] }] },
      { id: 'animation-group', slides: [{ id: 'animation', kind: 'algorithm-animation',
        canvas: { objects: [] }, widgets: [], animation }] }
    ] };
    const record = await Storage.project(source), key = record.references[0].key;
    record.deck.groups[1].slides[0].animation.traceView = record.references[0].view;
    const port = await new Promise(resolve => {
      const socket = net.createServer(); socket.listen(0, '127.0.0.1', () => {
        const port = socket.address().port; socket.close(() => resolve(port));
      });
    });
    const server = spawn(process.execPath, ['server.js'], { cwd: root,
      env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1' }, windowsHide: true, stdio: 'ignore' });
    let browser;
    try {
      const base = `http://127.0.0.1:${port}`;
      for (let i = 0; i < 80; i++) {
        try { if ((await fetch(base)).ok) break; } catch {}
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      browser = await chromium.launch({ headless: true,
        ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
      const page = await browser.newPage();
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => localStorage.setItem('algo_jwt_token', 'fixture'));
      let traceFetches = 0;
      await page.route('**/api/slides/lazy-fixture**', async route => {
        const url = route.request().url();
        if (url.includes('/traces/')) {
          traceFetches++; assert.ok(url.endsWith(key));
          return route.fulfill({ json: { trace: record.traces[key] } });
        }
        assert.ok(url.endsWith('?traceMode=lazy'));
        return route.fulfill({ json: { slide: { title: 'fixture', deck: record.deck } } });
      });
      await page.goto(`${base}/slides.html?deck=lazy-fixture`);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      assert.equal(traceFetches, 0, 'cover does not request a hidden animation');
      assert.equal(await page.locator('.algorithm-slide-frame').getAttribute('src'), 'about:blank');
      assert.ok(Number(await page.locator('body').getAttribute('data-local-deck-chars')) < 15000);
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript);
      const frame = page.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
      await frame.waitForFunction(() => window.CodeScript?.get_frame_count() === 3, null, { timeout: 30000 });
      assert.equal(traceFetches, 1);
      await frame.evaluate(async () => { await window.CodeScript.goto(2); });
      assert.equal(await frame.evaluate(() => window.CodeScript.get_current_frame_index()), 2);
      await page.getByRole('button', { name: 'previous slide', exact: true }).click();
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      assert.equal(traceFetches, 1);
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript?.get_frame_count() === 3);
      assert.equal(traceFetches, 1, 'reopening uses IndexedDB result cache');
      const downloadPromise = page.waitForEvent('download');
      await page.locator('#exportDeckBtn').click();
      const download = await downloadPromise;
      const exported = JSON.parse(gunzipSync(fs.readFileSync(await download.path()).subarray(9)));
      const exportedAnimation = exported.body.deck.groups[1].slides[0].animation;
      assert.ok(exportedAnimation.prebuilt?.traceId, 'portable export includes an independent Trace bundle');
      assert.equal(exported.body.prebuiltTraces[exportedAnimation.prebuilt.traceId].frames.length, 3);
      await page.goto(`${base}/slides.html`);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.locator('#importDeckInput').setInputFiles({ name: 'fixture.asmdeck',
        mimeType: 'application/octet-stream', buffer: fs.readFileSync(await download.path()) });
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready'
        && document.body.dataset.localDeckSave === 'saved');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.locator('#algorithmEditSlideBtn').click();
      await page.waitForFunction(() => document.querySelector('#algorithmEditorFrame')?.contentWindow?.CodeScript?.get_frame_count() === 3);
      const editor = page.frames().find(frame => frame.url().includes('asmEmbed=editor'));
      await editor.evaluate(animation => parent.postMessage({ type: 'asm-save-animation', animation }, location.origin),
        { ...animation, traceDocument: { ...trace, frames: trace.frames.slice(0, 2) } });
      await page.waitForFunction(() => document.querySelector('#algorithmEditorModal')?.hidden
        && document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript?.get_frame_count() === 2);
      await page.evaluate(() => { document.body.tabIndex = -1; document.body.focus(); });
      await page.keyboard.press('Control+z');
      await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript?.get_frame_count() === 3);
      await page.keyboard.press('Control+y');
      await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript?.get_frame_count() === 2);
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      await page.getByRole('button', { name: 'next slide', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.CodeScript?.get_frame_count() === 2);
      await page.locator('#importDeckInput').setInputFiles(path.join(root, 'drafts/eight-queens-teaching.asmdeck'));
      await page.waitForFunction(() => document.body.dataset.asmdeckRebuild === 'ready'
        && document.body.dataset.localDeckSave === 'saved', null, { timeout: 45000 });
      const compactChars = Number(await page.locator('body').getAttribute('data-local-deck-chars'));
      assert.ok(compactChars < 300000, `the large teaching deck saves only ${compactChars} metadata characters`);
      assert.equal(await page.locator('.algorithm-slide-frame[src="about:blank"]').count(), 3);
      console.log(JSON.stringify({ eightQueensEditableDeckChars: compactChars,
        archiveBytes: fs.statSync(path.join(root, 'drafts/eight-queens-teaching.asmdeck')).size }));
      await page.reload();
      await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');
      assert.equal(await page.locator('.algorithm-slide-frame[src="about:blank"]').count(), 3);
      assert.deepEqual(errors, []);
    } finally { await browser?.close(); server.kill(); }
  });
