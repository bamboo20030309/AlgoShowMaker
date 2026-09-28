const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('presentation canvas gestures save one slide-wide camera without changing edit mode', { timeout: 90000 }, async () => {
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
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/bubble.cpp'), 'utf8');
    await compilePage.evaluate(source => ace.edit('editor').setValue(source, -1), code);
    await compilePage.evaluate(() => { document.getElementById('inputArea').value = '4\n4 3 2 1\n'; });
    await compilePage.click('#runBtn');
    await compilePage.waitForFunction(() => window.ASMTracePlayer.getDocument()?.frames?.length > 1,
      null, { timeout: 30000 });
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
    await page.waitForFunction(revision => Number(document.body.dataset.localDeckRevision || 0) > revision,
      beforeRevision);
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');

    const dragRevision = Number(await page.locator('body').getAttribute('data-local-deck-revision'));
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.mouse.wheel(0, -120);
    await page.waitForFunction(revision => Number(document.body.dataset.localDeckRevision || 0) > revision,
      dragRevision);
    await page.waitForFunction(() => document.body.dataset.localDeckSave === 'saved');

    const saved = await runtime.evaluate(() => window.getPresentationCameraTransform());
    assert.ok(Math.abs(saved.panXRatio) > 0.01);
    assert.ok(Math.abs(saved.panYRatio) > 0.01);
    assert.ok(saved.zoomFactor > 1, 'wheel zoom should be saved without opening another interface');

    const acrossFrames = await runtime.evaluate(async expected => {
      await window.ASMTracePlayer.render(1, { animatePositions: false, animateEvents: false });
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
    await runtime.waitForFunction(expected => {
      const camera = window.getPresentationCameraTransform?.();
      return camera && Math.abs(camera.panXRatio - expected.panXRatio) < 1e-6
        && Math.abs(camera.panYRatio - expected.panYRatio) < 1e-6;
    }, saved);

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
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
