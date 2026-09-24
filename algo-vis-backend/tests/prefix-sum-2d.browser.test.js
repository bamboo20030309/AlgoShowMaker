const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const code = fs.readFileSync(path.join(
  __dirname, '../algorithm_sample/Basic/prefix_sum_2D.cpp'
), 'utf8');
const input = fs.readFileSync(path.join(
  __dirname, '../algorithm_sample/Basic/prefix_sum_2D-sample_input.txt'
), 'utf8');

test('two-dimensional prefix sum renders four colored build steps', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ASMTraceRenderers?.renderFrame
      && window.ASMTraceCamera?.ruleForFrame);
    const result = await page.evaluate(async ({ code, input }) => {
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(item => item.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, input, trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const trace = window.ASMTraceModel.normalizeTraceDocument(
        compiled.traceDocument || compiled.trace
      );
      const byName = Object.fromEntries(Object.entries(trace.variables)
        .map(([id, variable]) => [variable.name, id]));
      const scalar = (frame, name) => Number(frame.state[byName[name]].data.value);
      const step = (row, column, textId) => trace.frames.find(frame => (
        scalar(frame, 'r') === row
        && scalar(frame, 'c') === column
        && frame.texts.some(text => text.id === textId)
      ));
      const firstHalf = step(2, 2, 'build_value_num');
      const secondHalf = step(3, 2, 'build_value_pre');
      const initialFrames = ['build_up_num', 'build_left_num', 'build_overlap_num', 'build_value_num']
        .map(id => step(1, 1, id));
      await window.ASMTraceRenderers.renderFrame(trace, firstHalf, null, {
        animatePositions: false, animateEvents: false
      });
      const numId = byName.num;
      const fill = key => document.querySelector(
        `[data-trace-object-key="${numId}#${key}"] > rect`
      )?.getAttribute('fill');
      const textBackgrounds = [...document.querySelectorAll(
        '[data-trace-text-id="build_value_num"] .asm-trace-text-segment-background'
      )].map(node => node.getAttribute('fill'))
        .filter(value => value && value !== 'rgba(0,0,0,0)');
      const formulaText = document.querySelector(
        '[data-trace-text-id="build_value_num"]'
      )?.textContent?.replace(/\s+/g, ' ').trim();
      const coloredPrefixCells = Array.from({ length: 3 }, (_, row) => (
        Array.from({ length: 3 }, (_, column) => fill(`${row},${column}`))
      )).flat().filter(Boolean);
      const fills = {
        blue: fill('1,2'), yellow: fill('2,1'),
        red: fill('1,1'), green: fill('2,2')
      };
      const firstCamera = window.ASMTraceCamera.ruleForFrame(trace, firstHalf);

      await window.ASMTraceRenderers.renderFrame(trace, secondHalf, firstHalf, {
        animatePositions: false, animateEvents: false
      });
      return {
        fills,
        coloredPrefixCellCount: coloredPrefixCells.length,
        textBackgrounds: [...new Set(textBackgrounds)],
        textBackgroundRunCount: textBackgrounds.length,
        formulaText,
        firstTextVisible: Boolean(document.querySelector('[data-trace-text-id="build_value_pre"]')),
        firstTextHidden: Boolean(document.querySelector('[data-trace-text-id="build_value_num"]')),
        firstCameraZoom: firstCamera?.zoom,
        firstCameraTarget: trace.variables[firstCamera?.target?.variableId]?.name,
        initialFramesUseFullRange: initialFrames.every(frame => (
          frame && !window.ASMTraceCamera.ruleForFrame(trace, frame)?.target
        )),
        innerLabels: document.querySelectorAll('[data-trace-label-role="inner"]').length,
        markers: [...document.querySelectorAll('.trace-variable-marker-label-text')]
          .map(node => node.textContent).sort()
      };
    }, { code, input });
    assert.deepEqual(result, {
      fills: {
        blue: 'rgba(144, 202, 249, 0.6)',
        yellow: 'rgba(255, 183, 77, 0.65)',
        red: 'rgba(239, 154, 154, 0.6)',
        green: 'rgba(165, 214, 167, 0.6)'
      },
      coloredPrefixCellCount: 9,
      textBackgrounds: [
        'rgba(144, 202, 249, 0.6)',
        'rgba(255, 183, 77, 0.65)',
        'rgba(239, 154, 154, 0.6)',
        'rgba(165, 214, 167, 0.6)'
      ],
      textBackgroundRunCount: 4,
      formulaText: 'pre[2][2] = pre[1][2] + pre[2][1] - pre[1][1] + num[2][2] = 16',
      firstTextVisible: true,
      firstTextHidden: false,
      firstCameraZoom: 1.7,
      firstCameraTarget: 'num',
      initialFramesUseFullRange: true,
      innerLabels: 0,
      markers: []
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
