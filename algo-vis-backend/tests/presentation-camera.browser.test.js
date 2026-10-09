const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');
global.ASMTraceProvenance = require('../public/trace-provenance');
const archive = require('../public/asmdeck');

test('temporary camera gestures stay local, survive reload, and isolate each interface', { timeout: 90000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const probe = net.createServer();
    probe.listen(0, '127.0.0.1', () => {
      const selected = probe.address().port;
      probe.close(() => resolve(selected));
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
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    const compilePage = await browser.newPage();
    await compilePage.goto(`${base}/algorithm.html`);
    await compilePage.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = '#include <vector>\nusing namespace std;\nint main() {\nvector<int> arr(4, 0);\n// @frame arr\narr[0] = 1;\n// @frame arr\n}';
    await compilePage.evaluate(source => ace.edit('editor').setValue(source, -1), code);
    await compilePage.evaluate(() => { document.getElementById('inputArea').value = '4\n4 3 2 1\n'; });
    await compilePage.click('#runBtn');
    await compilePage.waitForFunction(source => window.ASMTracePlayer.getDocument()?.sourceCode === source
      && window.ASMTracePlayer.getDocument()?.frames?.length > 1,
      code, { timeout: 30000 }).catch(async error => { console.error(await compilePage.locator('body').innerText()); throw error; });
    await compilePage.evaluate(() => window.ASMTraceStudio?.close?.());
    await compilePage.waitForFunction(() => !document.body.classList.contains('asm-trace-studio-open'));

    const editorObject = compilePage.locator('#viewport .draggable-object').first();
    const editorObjectBox = await editorObject.boundingBox();
    assert.ok(editorObjectBox, 'fixture should render an object that previously opened the property menu');
    const beforeRightDrag = await compilePage.locator('#viewport').getAttribute('transform');
    await compilePage.mouse.move(editorObjectBox.x + editorObjectBox.width / 2,
      editorObjectBox.y + editorObjectBox.height / 2);
    await compilePage.mouse.down({ button: 'right' });
    await compilePage.mouse.move(editorObjectBox.x + editorObjectBox.width / 2 + 64,
      editorObjectBox.y + editorObjectBox.height / 2 + 32);
    await compilePage.mouse.up({ button: 'right' });
    const afterRightDrag = await compilePage.locator('#viewport').getAttribute('transform');
    assert.notEqual(afterRightDrag, beforeRightDrag,
      'holding the right mouse button over an object should pan the animation canvas');
    assert.equal(await compilePage.locator('.gui-ctx-menu').count(), 0,
      'right-clicking an animation object must not create the removed property menu');
    assert.equal(await compilePage.getByText('顯示完整屬性', { exact: true }).count(), 0);

    const traceDocument = await compilePage.evaluate(() => JSON.parse(JSON.stringify(
      window.ASMTracePlayer.getDocument()
    )));
    const standaloneCamera = await compilePage.evaluate(() => getPresentationCameraTransform());
    assert.ok(Math.abs(standaloneCamera.panXRatio) > .01);
    await compilePage.evaluate(() => ASMTraceStudio.open());
    assert.deepEqual(await compilePage.evaluate(() => getPresentationCameraTransform()),
      { panXRatio: 0, panYRatio: 0, zoomFactor: 1 }, 'studio has its own temporary camera');
    const studioBox = await compilePage.locator('#arraySvg').boundingBox();
    await compilePage.mouse.move(studioBox.x + studioBox.width / 2, studioBox.y + studioBox.height / 2);
    await compilePage.mouse.wheel(0, -120);
    await compilePage.waitForFunction(() => getPresentationCameraTransform().zoomFactor > 1);
    await compilePage.waitForTimeout(220);
    const studioCamera = await compilePage.evaluate(() => getPresentationCameraTransform());
    await compilePage.evaluate(() => ASMTraceStudio.close());
    assert.deepEqual(await compilePage.evaluate(() => getPresentationCameraTransform()), standaloneCamera);
    await compilePage.evaluate(() => ASMTraceStudio.open());
    assert.deepEqual(await compilePage.evaluate(() => getPresentationCameraTransform()), studioCamera);
    await compilePage.evaluate(() => ASMTraceStudio.close());
    await compilePage.close();

    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(deck => localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify(deck)), {
      groups: [{
        id: 'presentation-camera-group',
        slides: [{
          id: 'presentation-camera-slide',
          kind: 'algorithm-animation',
          animation: { mode: 'trace', code, traceDocument },
          canvas: { objects: [] },
          widgets: []
        }]
      }]
    });
    await page.goto(`${base}/slides.html`);
    await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')
      ?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length > 1);
    const runtime = page.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime);
    await runtime.waitForFunction(() => window.getPresentationCameraTransform
      && document.body.classList.contains('asm-embed-runtime'));

    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('asm-edit-mode')), true,
      'the outer slide editor may remain open while its embedded runtime saves the presentation camera');

    const beforeRevision = Number(await page.locator('body').getAttribute('data-local-deck-revision') || 0);
    const canvas = runtime.locator('#arraySvg');
    const box = await canvas.boundingBox();
    const drawnObjectBox = await runtime.locator('#viewport .draggable-object').first().boundingBox();
    assert.ok(drawnObjectBox, 'fixture should render an interactive drawing object');
    // Runtime objects are read-only presentation content, so dragging directly
    // over a structure/code object must pan the camera as well as empty grid.
    await page.mouse.move(drawnObjectBox.x + drawnObjectBox.width / 2,
      drawnObjectBox.y + drawnObjectBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(drawnObjectBox.x + drawnObjectBox.width / 2 + 72,
      drawnObjectBox.y + drawnObjectBox.height / 2 + 36);
    await page.mouse.up();
    await runtime.waitForFunction(() => Math.abs(window.getPresentationCameraTransform().panXRatio) > .01);
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');

    const dragRevision = Number(await page.locator('body').getAttribute('data-local-deck-revision'));
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -120);
    await runtime.waitForFunction(() => window.getPresentationCameraTransform().zoomFactor > 1);
    await page.waitForTimeout(240);
    assert.equal(Number(await page.locator('body').getAttribute('data-local-deck-revision')), beforeRevision, 'camera gestures must not dirty or save the deck');
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');

    const saved = await runtime.evaluate(() => window.getPresentationCameraTransform());
    assert.ok(Math.abs(saved.panXRatio) > 0.01);
    assert.ok(Math.abs(saved.panYRatio) > 0.01);
    assert.ok(saved.zoomFactor > 1, 'wheel zoom should be saved without opening another interface');

    const acrossFrames = await runtime.evaluate(async expected => {
      await window.ASMTracePlayer.renderStable(1);
      const afterFrame = window.getPresentationCameraTransform();
      const withPresentation = document.querySelector('#viewport').getAttribute('transform');
      window.setPresentationCameraTransform(null, true, false);
      const editBase = document.querySelector('#viewport').getAttribute('transform');
      window.setPresentationCameraTransform(expected, true, true);
      const restored = document.querySelector('#viewport').getAttribute('transform');
      const values = text => Array.from(text.matchAll(/-?\d+(?:\.\d+)?/g), match => Number(match[0]));
      const before = values(withPresentation);
      const after = values(restored);
      const restoredMatches = before.length === after.length
        && before.every((value, index) => Math.abs(value - after[index]) < 1e-9);
      return { afterFrame, withPresentation, editBase, restoredMatches };
    }, saved);
    assert.deepEqual(acrossFrames.afterFrame, saved);
    assert.equal(acrossFrames.restoredMatches, true);
    assert.notEqual(acrossFrames.editBase, acrossFrames.withPresentation);

    await page.click('#modeToggleBtn');
    await runtime.waitForFunction(() => getPresentationCameraTransform().zoomFactor === 1);
    assert.deepEqual(await runtime.evaluate(() => getPresentationCameraTransform()),
      { panXRatio: 0, panYRatio: 0, zoomFactor: 1 }, 'presentation and slide-edit canvases are independent');

    await page.click('#modeToggleBtn');
    await runtime.waitForFunction(expected => {
      const camera = window.getPresentationCameraTransform?.();
      return camera && Math.abs(camera.panXRatio - expected.panXRatio) < 1e-6
        && Math.abs(camera.panYRatio - expected.panYRatio) < 1e-6;
    }, saved);

    await page.click('#algorithmEditSlideBtn');
    await page.waitForFunction(() => document.querySelector('#algorithmEditorFrame')
      ?.contentWindow?.document?.body?.classList.contains('asm-embed-editor'));
    const editor = page.frames().find(frame => frame.url().includes('asmEmbed=editor'));
    assert.ok(editor);
    const editorCamera = await editor.evaluate(() => window.getPresentationCameraTransform?.());
    assert.deepEqual(editorCamera, { panXRatio: 0, panYRatio: 0, zoomFactor: 1 },
      'the algorithm-animation editor must not inherit the slide presentation camera');
    const editorBox = await editor.locator('#arraySvg').boundingBox();
    await page.mouse.move(editorBox.x + editorBox.width / 2, editorBox.y + editorBox.height / 2);
    await page.mouse.wheel(0, -120);
    await editor.waitForFunction(() => getPresentationCameraTransform().zoomFactor > 1);
    await page.waitForTimeout(220);
    const changedEditorCamera = await editor.evaluate(() => getPresentationCameraTransform());
    assert.deepEqual(await runtime.evaluate(() => getPresentationCameraTransform()), saved);
    await page.keyboard.press('Escape');
    await page.click('#algorithmEditSlideBtn');
    await page.waitForFunction(() => !document.getElementById('algorithmEditorModal').classList.contains('is-loading'));
    assert.deepEqual(await editor.evaluate(() => getPresentationCameraTransform()), changedEditorCamera);
    await page.keyboard.press('Escape');

    await page.reload();
    await page.waitForFunction(() => document.querySelector('.algorithm-slide-frame')
      ?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length > 1);
    const reloadedRuntime = page.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    await reloadedRuntime.waitForFunction(expected => {
      const camera = window.getPresentationCameraTransform?.();
      return camera && Math.abs(camera.panXRatio - expected.panXRatio) < 1e-6
        && Math.abs(camera.panYRatio - expected.panYRatio) < 1e-6
        && Math.abs(camera.zoomFactor - expected.zoomFactor) < 1e-6;
    }, saved);
    const downloadEvent = page.waitForEvent('download');
    await page.click('#exportDeckBtn');
    const exported = await archive.decode(new Blob([fs.readFileSync(await (await downloadEvent).path())]));
    assert.equal(exported.deck.groups[0].slides[0].animation.presentationCamera, undefined);

    // Old decks with an explicit modifier migrate once, then save/reopen without it.
    const legacyContext = await browser.newContext();
    const legacyPage = await legacyContext.newPage();
    const legacyCamera = { panXRatio: .12, panYRatio: -.08, zoomFactor: 1.2 };
    await legacyPage.addInitScript(({ code, traceDocument, legacyCamera }) => {
      traceDocument.studio ||= {};
      traceDocument.studio.eventSettings = { autoFixedEnabled: false, autoLoopBoundaryEnabled: false };
      traceDocument.studio.codePanelFontSize = 19;
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({ groups: [{ id: 'legacy', slides: [{
        id: 'old', kind: 'algorithm-animation', canvas: { objects: [] }, widgets: [],
        animation: { code, mode: 'trace', traceDocument, presentationCamera: legacyCamera }
      }] }] }));
    }, { code, traceDocument, legacyCamera });
    await legacyPage.goto(base + '/slides.html');
    await legacyPage.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length > 1);
    await legacyPage.click('#modeToggleBtn');
    let legacyRuntime = legacyPage.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    await legacyRuntime.waitForFunction(() => getPresentationCameraTransform().zoomFactor === 1.2);
    const legacyTrace = await legacyRuntime.evaluate(() => ASMTracePlayer.getDocument());
    assert.equal(legacyTrace.studio.eventSettings.autoFixedEnabled, false);
    assert.equal(legacyTrace.studio.codePanelFontSize, 19);
    const legacyDownload = legacyPage.waitForEvent('download');
    await legacyPage.evaluate(() => document.getElementById('exportDeckBtn').click());
    const migrated = await archive.decode(new Blob([fs.readFileSync(await (await legacyDownload).path())]));
    assert.equal(migrated.deck.groups[0].slides[0].animation.presentationCamera, undefined);
    await legacyPage.reload();
    await legacyPage.waitForFunction(() => document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer?.getDocument()?.frames?.length > 1);
    if (await legacyPage.locator('body').evaluate(body => body.classList.contains('asm-edit-mode'))) await legacyPage.click('#modeToggleBtn');
    legacyRuntime = legacyPage.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    await legacyRuntime.waitForFunction(() => getPresentationCameraTransform().zoomFactor === 1.2);
    await legacyRuntime.evaluate(() => resetTemporaryCamera());
    assert.equal(await legacyRuntime.evaluate(() => getPresentationCameraTransform().zoomFactor), 1);
    await legacyContext.close();
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
