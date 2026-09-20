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
            opacity: getComputedStyle(node).opacity
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
          mark.target.endsWith('#3') && mark.opacity === '1'
        )), 'automatic fixed mark must remain visible at ' + delay + 'ms');
      }
      await page.evaluate(() => window.__aliasFocusTransition);
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
