const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('reference aliases preserve focus paint and automatic fixed marks across a function return',
  { timeout: 30000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'ASM_TEST_BASE_URL must point to the isolated beta service');
    const code = fs.readFileSync(
      path.join(__dirname, 'fixtures/reference-alias-focus.cpp'),
      'utf8'
    );
    const { trace } = await compile(code);
    assert.equal(trace.frames.length, 2);
    assert.equal(trace.frames[0].source.function, 'inspect');
    assert.equal(trace.frames[1].source.function, 'main');

    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(base + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.asmApplyTraceDocument);
      await page.evaluate(source => window.asmApplyTraceDocument(source), trace);
      await page.evaluate(() => window.ASMTracePlayer.renderStable(0));
      await page.evaluate(() => {
        window.__aliasFocusTransition = window.ASMTracePlayer.render(1, { fromIndex: 0 });
      });

      const readPresentation = () => page.evaluate(() => {
        const object = [...document.querySelectorAll('.asm-trace-object[data-trace-variable]')]
          .find(node => node.getAttribute('data-trace-variable')?.startsWith('main:arr'));
        const fills = Object.fromEntries(
          [...(object?.querySelectorAll('[data-trace-index]') || [])]
            .filter(node => !node.dataset.traceContentRole)
            .map(node => [
              node.dataset.traceIndex,
              getComputedStyle(node.querySelector(':scope > rect')).fill
            ])
        );
        const marks = [...document.querySelectorAll('[data-trace-attachment-kind="mark"]')]
          .filter(node => node.dataset.traceAttachedTo?.startsWith('main:arr'))
          .map(node => ({
            target: node.dataset.traceAttachedTo,
            opacity: getComputedStyle(node).opacity,
            display: getComputedStyle(node).display,
            bounds: (() => {
              const rect = node.getBoundingClientRect();
              return { width: rect.width, height: rect.height };
            })()
          }));
        return { fills, marks };
      });

      for (const delay of [0, 40, 120]) {
        if (delay) await page.waitForTimeout(delay === 40 ? 40 : 80);
        const presentation = await readPresentation();
        assert.equal(presentation.fills['3'], 'rgb(204, 204, 204)',
          'unchanged focus paint must stay gray at ' + delay + 'ms');
        assert.equal(presentation.fills['4'], 'rgb(204, 204, 204)',
          'unchanged focus paint must stay gray at ' + delay + 'ms');
        assert.ok(presentation.marks.some(mark => (
          mark.target.endsWith('#3')
          && mark.opacity === '1'
          && mark.display !== 'none'
          && mark.bounds.width > 0
          && mark.bounds.height > 0
        )), 'automatic fixed mark must remain visible at ' + delay + 'ms');
      }
      await page.evaluate(() => window.__aliasFocusTransition);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });

test('a fixed mark created by a heap swap stays hidden until the swapped cells settle',
  { timeout: 30000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'ASM_TEST_BASE_URL must point to the isolated beta service');
    const code = fs.readFileSync(path.join(__dirname, 'fixtures/heap.cpp'), 'utf8');
    const { trace } = await compile(code, '10\n5 7 2 1 9 4 11 15 8 6\n');
    const frameIndex = trace.frames.findIndex(frame => {
      const events = frame.events || [];
      return events.some(event => event.type === 'swap'
        && event.targets?.some(target => target.resolvedIndex === 7))
        && events.some(event => event.type === 'fixed'
          && event.targets?.some(target => target.resolvedIndex === 7));
    });
    assert.ok(frameIndex > 0, 'fixture must contain a swap that fixes heap index 7');

    const browser = await chromium.launch({
      headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
    });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.stack || error.message));
      await page.goto(base + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.asmApplyTraceDocument);
      await page.evaluate(source => window.asmApplyTraceDocument(source), trace);
      await page.evaluate(index => window.ASMTracePlayer.renderStable(index), frameIndex - 1);
      await page.evaluate(index => {
        window.__heapFixedTransition = window.ASMTracePlayer.render(index, { fromIndex: index - 1 });
      }, frameIndex);

      await page.waitForFunction(() => [...document.querySelectorAll('[data-trace-attachment-kind="mark"]')]
        .some(node => node.dataset.traceAttachedTo?.endsWith('#7')
          && node.parentElement?._asmStyleCell?._asmStylePresentationCell), null, { timeout: 5000 });
      const duringSwap = await page.evaluate(() => [...document.querySelectorAll('[data-trace-attachment-kind="mark"]')]
        .filter(node => node.dataset.traceAttachedTo?.endsWith('#7'))
        .map(node => ({
          display: getComputedStyle(node).display,
          opacity: Number(getComputedStyle(node).opacity),
          presentationCell: node.parentElement?._asmStyleCell?._asmStylePresentationCell
            ?.dataset?.traceObjectKey || ''
        })));
      assert.ok(duringSwap.length > 0, 'index 7 fixed mark must exist during the swap');
      assert.ok(duringSwap.every(mark => mark.display === 'none' || mark.opacity === 0),
        'the new fixed mark must not follow a temporary swap presentation cell');

      await page.evaluate(() => window.__heapFixedTransition);
      const settled = await page.evaluate(() => {
        const mark = [...document.querySelectorAll('[data-trace-attachment-kind="mark"]')]
          .find(node => node.dataset.traceAttachedTo?.endsWith('#7')
            && getComputedStyle(node).display !== 'none'
            && Number(getComputedStyle(node).opacity) > 0);
        const cell = mark && document.querySelector(
          `[data-trace-object-key="${CSS.escape(mark.dataset.traceAttachedTo)}"]`
        );
        const bounds = node => {
          const rect = node?.getBoundingClientRect?.();
          return rect && { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
        };
        return { mark: bounds(mark), cell: bounds(cell) };
      });
      assert.ok(settled.mark && settled.cell, 'index 7 fixed mark must be visible after the swap');
      const centerX = (settled.mark.left + settled.mark.right) / 2;
      const centerY = (settled.mark.top + settled.mark.bottom) / 2;
      assert.ok(centerX >= settled.cell.left && centerX <= settled.cell.right
        && centerY >= settled.cell.top && centerY <= settled.cell.bottom,
      'the settled fixed mark must be inside its actual heap cell');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
