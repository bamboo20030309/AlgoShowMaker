const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const path = require('node:path');
const { chromium } = require('playwright');

test('Trace Studio edits automatic code snippets one line at a time', { timeout: 90000 }, async () => {
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
    env: {
      ...process.env,
      PORT: String(port),
      ASM_REGRESSION: '1',
      JWT_SECRET: randomBytes(32).toString('hex')
    },
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
    const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer && window.ASMTraceStudio);
    const longLine = `const char* snippetLayoutProbe = "${'horizontal-scrolling-keeps-this-source-line-intact-'.repeat(5)}";`;
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/bubble.cpp'), 'utf8')
      .replace('#include <bits/stdc++.h>', `#include <bits/stdc++.h>\n${longLine}`);
    await page.evaluate(source => ace.edit('editor').setValue(source, -1), code);
    await page.evaluate(() => { document.getElementById('inputArea').value = '6\n5 7 2 1 9 4\n'; });
    await page.click('#runBtn');
    await page.waitForFunction(expected => window.ASMTracePlayer.getDocument()?.sourceCode.includes(expected),
      longLine, { timeout: 30000 });
    const selected = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const document = player.getDocument();
      const index = document.frames.findIndex((frame, frameIndex) => {
        if (!frame.events.some(event => (
          event.type === 'swap' && event.enabled !== false && event.autoAnimationDisabled !== true
        ))) return false;
        const selector = ASMTraceViewSource.sourceSelector(frame);
        return selector && document.frames.filter(candidate => ASMTraceViewSource.sourceMatches(candidate, selector)).length > 1;
      });
      if (index < 0) return false;
      const selector = ASMTraceViewSource.sourceSelector(document.frames[index]);
      window.__snippetTestFrameIndices = document.frames
        .map((frame, frameIndex) => ASMTraceViewSource.sourceMatches(frame, selector) ? frameIndex : -1)
        .filter(frameIndex => frameIndex >= 0);
      await player.render(index, { animatePositions: false, animateEvents: false });
      window.ASMTraceStudio.open();
      return true;
    });
    assert.equal(selected, true, 'fixture must produce an animated swap event frame');
    await page.getByRole('button', { name: '事件', exact: true }).click();
    const eventGapField = page.locator('.trace-studio-events-panel .trace-studio-field')
      .filter({ hasText: '事件間隔時間' });
    assert.equal(await eventGapField.count(), 1,
      'the event gap control should live inside the event panel');
    assert.equal(await eventGapField.evaluate(field => Boolean(
      field.compareDocumentPosition(document.querySelector('.trace-studio-frame-events-section'))
        & Node.DOCUMENT_POSITION_FOLLOWING
    )), true, 'the event gap control should appear above the event code section');
    assert.equal(await eventGapField.isVisible(), true,
      'the event gap control should be visible in the event panel');
    await page.getByRole('button', { name: '程式碼', exact: true }).click();
    assert.equal(await eventGapField.isVisible(), false,
      'the event gap control should not remain visible in the code panel');

    const rows = page.locator('.trace-studio-snippet-line-button');
    await rows.first().waitFor();
    assert.ok(await rows.count() >= 12, 'the editor should keep every code line visible as a line button');
    assert.match(await page.locator('.trace-studio-code-snippet-list').textContent(), /#include/);
    assert.match(await page.locator('.trace-studio-code-snippet-list').textContent(), /return 0/);
    assert.equal(await rows.evaluateAll(nodes => nodes.some(node => {
      const text = node.querySelector('.trace-studio-snippet-code')?.textContent || '';
      return !text.trim() || text.trim().startsWith('//');
    })), false, 'blank and comment-only lines should not appear in the snippet editor');
    assert.ok(await page.locator('.trace-studio-snippet-line-button:not(.is-enabled)').count() > 0,
      'lines outside the current automatic snippet should remain visible and transparent');
    const markedRows = await rows.filter({ has: page.locator('mark.trace-studio-snippet-event-source') }).count();
    assert.ok(markedRows >= 1, 'an animated expression should be marked in fluorescent yellow');
    const firstHighlight = page.locator('mark.trace-studio-snippet-event-source').first();
    assert.ok((await firstHighlight.textContent()).trim().length > 0);
    assert.equal(await firstHighlight.evaluate(node => getComputedStyle(node).backgroundColor), 'rgb(255, 244, 92)');
    assert.equal(await page.locator('.trace-studio-snippet-code mark + mark').count(), 0,
      'adjacent event ranges should render as one continuous fluorescent block');
    assert.equal(await page.locator('.trace-studio-snippet-code').first().evaluate(node => getComputedStyle(node).whiteSpace), 'pre',
      'code rows should keep one source line instead of soft-wrapping');
    const snippetList = page.locator('.trace-studio-code-snippet-list');
    assert.equal(await snippetList.evaluate(node => node.scrollWidth > node.clientWidth), true,
      'long source lines should use horizontal scrolling');
    assert.equal(await page.locator('.trace-studio-snippet-gutter').first().evaluate(node => getComputedStyle(node).position), 'sticky',
      'the selection marker and line number should remain fixed while scrolling');
    const leftAlignedRow = rows.filter({ hasText: '#include' }).first();
    const leftAlignedGutter = leftAlignedRow.locator('.trace-studio-snippet-gutter');
    const leftAlignedCode = leftAlignedRow.locator('.trace-studio-snippet-code');
    const gutterBeforeScroll = await leftAlignedGutter.boundingBox();
    const codeBeforeScroll = await leftAlignedCode.boundingBox();
    assert.ok(codeBeforeScroll.x < gutterBeforeScroll.x + gutterBeforeScroll.width + 2,
      'code should start immediately after the fixed gutter instead of aligning to the right edge');
    await snippetList.evaluate(node => { node.scrollLeft = 120; });
    const gutterAfterScroll = await leftAlignedGutter.boundingBox();
    assert.ok(Math.abs(gutterAfterScroll.x - gutterBeforeScroll.x) < 1,
      `the marker and line number should stay at the same position during horizontal scrolling (${gutterBeforeScroll.x} -> ${gutterAfterScroll.x})`);

    const inspector = page.locator('.trace-studio-inspector');
    const inspectorWidthBefore = (await inspector.boundingBox()).width;
    const resizer = page.locator('#traceStudioInspectorResizer');
    const resizerBox = await resizer.boundingBox();
    await page.mouse.move(resizerBox.x + 2, resizerBox.y + 120);
    await page.mouse.down();
    await page.mouse.move(resizerBox.x - 90, resizerBox.y + 120);
    await page.mouse.up();
    const inspectorWidthAfter = (await inspector.boundingBox()).width;
    assert.ok(inspectorWidthAfter > inspectorWidthBefore + 60, 'dragging the separator should widen the inspector');
    assert.equal(await page.evaluate(() => Number(localStorage.getItem('asm_trace_studio_inspector_width_v1')) > 0), true,
      'the resized inspector width should be saved locally');

    await page.getByRole('button', { name: '專注檢視' }).click();
    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('asm-trace-snippet-focus')), true);
    assert.ok((await inspector.boundingBox()).width > 900, 'focus view should expand the snippet editor');
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('body').evaluate(body => body.classList.contains('asm-trace-snippet-focus')), false);

    const regularRow = page.locator('.trace-studio-snippet-line-button.is-enabled')
      .filter({ hasNot: page.locator('mark.trace-studio-snippet-event-source') }).first();
    assert.equal(await regularRow.getAttribute('aria-pressed'), 'true');
    const regularLine = await regularRow.getAttribute('data-source-line');
    const stableRegularRow = page.locator(
      `.trace-studio-snippet-line-button[data-source-line="${regularLine}"]`
    );
    await regularRow.click();
    assert.equal(await page.locator('.trace-studio-snippet-confirm').count(), 0,
      'a regular line should toggle without a confirmation');
    assert.equal(await stableRegularRow.getAttribute('aria-pressed'), 'false');
    const regularSourceAnchor = await stableRegularRow.getAttribute('data-snippet-source-anchor');
    const relatedIndex = await page.evaluate(() => window.__snippetTestFrameIndices[1]);
    await page.evaluate(async frameIndex => {
      await ASMTracePlayer.render(frameIndex, { animatePositions: false, animateEvents: false });
    }, relatedIndex);
    const relatedRow = page.locator(
      `.trace-studio-snippet-line-button[data-snippet-source-anchor="${regularSourceAnchor}"]`
    );
    assert.equal(await relatedRow.getAttribute('aria-pressed'), 'false',
      'a manual line choice should apply to another frame from the same @frame directive');
    await stableRegularRow.click();
    assert.equal(await relatedRow.getAttribute('aria-pressed'), 'true');

    const eventRow = rows.filter({ has: page.locator('mark.trace-studio-snippet-event-source') }).first();
    assert.equal(await eventRow.evaluate(button => button.classList.contains('is-enabled')), true);
    await eventRow.click();
    await page.waitForFunction(() => {
      const mark = document.querySelector('.trace-studio-snippet-event-source');
      return mark && !mark.closest('button').classList.contains('is-enabled');
    });
    assert.equal(await page.locator('.trace-studio-snippet-confirm').count(), 0,
      'event lines should close immediately without a confirmation warning');
    assert.match(await page.locator('.trace-studio-snippet-meta').textContent(), /事件行未收錄/);
    assert.ok(await page.evaluate(() => {
      const settings = window.ASMTraceViewSource.parse(ace.edit('editor').getValue());
      return Boolean(settings?.studio?.codeSnippetSourceOverrides?.length);
    }), 'the custom line state should be written to @asm-view settings');

    await page.getByRole('button', { name: '恢復自動篩選' }).click();
    await page.waitForFunction(() => document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    await page.locator('.trace-studio-history button').first().click();
    await page.waitForFunction(() => !document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    await page.locator('.trace-studio-history button').nth(1).click();
    await page.waitForFunction(() => document.querySelector('.trace-studio-snippet-event-source')
      ?.closest('button')?.classList.contains('is-enabled'));
    assert.deepEqual(errors, []);
  } finally {
    await browser?.close();
    server.kill();
  }
});
