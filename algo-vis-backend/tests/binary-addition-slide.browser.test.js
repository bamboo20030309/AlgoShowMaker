const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('an outdated segment tree slide rebuilds and animates its first parent sum', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = fs.readFileSync(
      path.join(__dirname, '../algorithm_sample/Tree/Segment_Tree_easy_build.cpp'), 'utf8'
    ).replace(/\r\n?/g, '\n').replace(
      '// @camera focus tree offset(0,35) zoom(1.05)',
      '// @style tree[1:Tsize-1] focus\n// @camera focus tree offset(0,35) zoom(1.05)'
    );
    const input = '15\n1 2 3 4 5 6 7 8 9 10 11 12 13 14 15\n';
    await page.evaluate(({ code, input }) => {
      ace.edit('editor').setValue(code, -1);
      document.querySelector('#inputArea').value = input;
    }, { code, input });
    await page.click('#runBtn');
    await page.waitForFunction(
      source => window.ASMTracePlayer.getDocument()?.sourceCode === source,
      code,
      { timeout: 30000 }
    );
    const traceDocument = await page.evaluate(() => JSON.parse(JSON.stringify(
      window.ASMTracePlayer.getDocument()
    )));
    traceDocument.provenance.engineVersion = 4;
    traceDocument.frames.forEach(frame => {
      frame.events = (frame.events || []).filter(event => event.binaryOperation !== '+');
    });
    const slidePage = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    slidePage.on('pageerror', error => errors.push(error.message));
    await slidePage.addInitScript(({ code, input, traceDocument }) => {
      localStorage.setItem('asm_reveal_fabric_deck_v5', JSON.stringify({
        groups: [{
          id: 'binary-addition-group',
          slides: [{
            id: 'binary-addition-slide',
            kind: 'algorithm-animation',
            animation: { mode: 'trace', code, input, traceDocument },
            canvas: { objects: [] }, widgets: []
          }]
        }]
      }));
    }, { code, input, traceDocument });
    await slidePage.goto(`${base}/slides.html`);
    await slidePage.waitForFunction(() => (
      document.querySelector('.algorithm-slide-frame')?.contentWindow
        ?.ASMTracePlayer?.isViewportGeometryReady?.()
    ));
    let runtime = slidePage.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    assert.ok(runtime, 'algorithm slide runtime iframe loaded');
    assert.match(runtime.url(), /v=trace-runtime-40/);
    assert.equal(await runtime.evaluate(() => (
      window.ASMTracePlayer.getDocument().frames.some(frame => (
        (frame.events || []).some(event => event.binaryOperation === '+')
      ))
    )), false, 'the saved v4 trace begins without binary addition metadata');
    await slidePage.evaluate(() => document.getElementById('algorithmEditSlideBtn').click());
    await slidePage.waitForFunction(() => (
      !document.getElementById('algorithmEditorModal').hidden
      && document.getElementById('algorithmEditorFrame')?.contentWindow?.ASMTracePlayer
        ?.getDocument?.()?.provenance?.engineVersion
        === document.getElementById('algorithmEditorFrame')?.contentWindow
          ?.ASMTraceProvenance?.ENGINE_VERSION
      && document.getElementById('algorithmEditorFrame')?.contentWindow
        ?.ASMTracePlayer?.getDocument?.()?.frames?.some(frame => (
          (frame.events || []).some(event => event.binaryOperation === '+')
        ))
    ), null, { timeout: 30000 });
    const editorElement = await slidePage.$('#algorithmEditorFrame');
    const editor = await editorElement?.contentFrame();
    assert.ok(editor, 'algorithm slide editor iframe loaded');
    assert.equal(await editor.evaluate(() => (
      window.ASMTracePlayer.getDocument().frames.some(frame => (
        (frame.events || []).some(event => event.binaryOperation === '+')
      ))
    )), true, 'opening the editor rebuilds the outdated trace');
    await slidePage.click('#saveAlgorithmEditorBtn');
    await slidePage.waitForFunction(() => document.getElementById('algorithmEditorModal').hidden);
    await slidePage.waitForFunction(() => {
      const player = document.querySelector('.algorithm-slide-frame')?.contentWindow?.ASMTracePlayer;
      const documentTrace = player?.getDocument?.();
      return documentTrace?.provenance?.engineVersion
        === document.querySelector('.algorithm-slide-frame')?.contentWindow
          ?.ASMTraceProvenance?.ENGINE_VERSION
        && documentTrace.frames.some(frame => (
          (frame.events || []).some(event => event.binaryOperation === '+')
        ));
    }, null, { timeout: 30000 });
    runtime = slidePage.frames().find(frame => frame.url().includes('asmEmbed=runtime'));
    const result = await runtime.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const doc = player.getDocument();
      const treeId = Object.keys(doc.variables).find(id => doc.variables[id]?.name === 'tree');
      const parentFrames = doc.frames.map((frame, index) => ({ frame, index }))
        .filter(({ frame }) => frame.source?.function === 'build'
          && (frame.arrows || []).length === 2);
      const parent = parentFrames[0];
      const event = parent.frame.events.find(item => item.binaryOperation === '+');
      const target = event?.targets?.find(item => item.role === 'target')?.resolvedIndex;
      await player.render(parent.index - 1, { animatePositions: false, animateEvents: false });
      const samples = [];
      let settled = false;
      const transition = window.CodeScript.next_key_frame().finally(() => { settled = true; });
      // Marker and fixed-event phases can precede the parent-sum assignment.
      // Sample the whole transition instead of cutting off after roughly 3s.
      for (let count = 0; count < 900 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const scene = document.querySelector('#asm-trace-root');
        const targetText = scene.querySelector(
          `[data-trace-object-key="${CSS.escape(`${treeId}#${target}`)}"]`
        )?.querySelector('text:not([data-trace-content-role="index"])');
        const transfers = [...scene.querySelectorAll('.asm-trace-assign-transfer-value')];
        samples.push({
          targetValue: targetText?.textContent,
          transferValues: transfers.map(item => item.querySelector('text')?.textContent).sort(),
          segmentCount: scene.querySelectorAll('.asm-trace-heap-cell-segment').length
        });
      }
      await transition;
      return {
        build: window.ASMTraceFrameTween.build,
        event: event ? {
          binaryOperation: event.binaryOperation,
          disabled: event.autoAnimationDisabled,
          enabled: event.enabled,
          targets: event.targets.map(item => [item.role, item.resolvedIndex])
        } : null,
        samples,
        playbackDurationMs: player.getLastPlaybackPlan()?.totalDurationMs
      };
    });
    assert.equal(result.build, 'trace-230');
    assert.deepEqual(result.event?.targets, [
      ['target', 15], ['source-left', 30], ['source-right', 31]
    ]);
    assert.equal(result.event?.binaryOperation, '+');
    assert.notEqual(result.event?.disabled, true);
    assert.ok(result.playbackDurationMs >= 1000, JSON.stringify(result));
    assert.ok(result.samples.some(sample => (
      JSON.stringify(sample.transferValues) === JSON.stringify(['0', '15'])
        && sample.targetValue === '0'
    )), JSON.stringify(result));
    assert.ok(result.samples.every(sample => sample.segmentCount === 0), JSON.stringify(result));
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
