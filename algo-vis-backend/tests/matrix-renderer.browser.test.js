const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

test('matrix renderer works in the real browser SVG surface', { timeout: 60000 }, async () => {
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
    await page.waitForFunction(() => window.ASMTraceRenderers?.renderFrame);
    const result = await page.evaluate(async () => {
      const scalar = value => ({ kind: 'scalar', value });
      const grid = 'grid', i = 'i', j = 'j';
      const traceDocument = {
        variables: {
          [grid]: { id: grid, name: 'grid', kind: 'matrix' },
          [i]: { id: i, name: 'i', kind: 'scalar' },
          [j]: { id: j, name: 'j', kind: 'scalar' }
        },
        skins: { [grid]: { renderer: 'original-matrix', options: {
          rowLabels: { mode: 'custom', values: ['A', 'B'] },
          columnLabels: { mode: 'custom', values: ['X', 'Y'] },
          innerLabels: { mode: 'index', values: [] }, gridlines: 0,
          outerframe: false, markerLayout: 'inner'
        } } },
        snapshots: [], layouts: [], rules: [], studio: {}, frames: []
      };
      const frame = {
        id: 'matrix-browser', source: { primaryVariableId: grid },
        state: {
          [grid]: { name: 'grid', data: { kind: 'matrix', items: [
            { kind: 'sequence', items: [scalar(1), scalar(2)] },
            { kind: 'sequence', items: [scalar(3)] }
          ] } },
          [i]: { name: 'i', data: scalar(1) }, [j]: { name: 'j', data: scalar(0) }
        },
        events: [], bindings: [
          { mode: 'index', targetVariableId: grid, sourceVariableId: i, sourceVariableIds: [i], sourceName: 'i', indexExpression: 'i', indexDimension: 0 },
          { mode: 'index', targetVariableId: grid, sourceVariableId: j, sourceVariableIds: [j], sourceName: 'j', indexExpression: 'j', indexDimension: 1 }
        ],
        objectBindings: [], renderers: {}, rendererOptions: { [grid]: { markerLayout: 'inner' } },
        captureOnlyVariableIds: [i, j], texts: [], segments: [], arrows: [], snapshotIds: [],
        styles: [{ id: 'cell', targetVariableId: grid, selector: {
          type: 'matrix-cell', rowExpression: 'i', columnExpression: 'j'
        }, styleType: 'highlight', color: 'red' }]
      };
      traceDocument.frames.push(frame);
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, null, {
        animatePositions: false, animateEvents: false
      });
      const originalResult = {
        cells: document.querySelectorAll('[data-trace-arrow-target-kind="matrix-cell"]').length,
        rowLabels: document.querySelectorAll('[data-trace-label-role="row"]').length,
        columnLabels: document.querySelectorAll('[data-trace-label-role="column"]').length,
        innerLabels: document.querySelectorAll('[data-trace-label-role="inner"]').length,
        markers: [...document.querySelectorAll('.trace-variable-marker-label-text')].map(node => node.textContent).sort(),
        cellStroke: document.querySelector('[data-trace-object-key="grid#1,0"] > rect')?.getAttribute('stroke'),
        cellStrokeWidth: document.querySelector('[data-trace-object-key="grid#1,0"] > rect')?.getAttribute('stroke-width'),
        innerFill: document.querySelector('[data-trace-object-key="grid#1,0:index"] > rect')?.getAttribute('fill'),
        innerHeight: document.querySelector('[data-trace-object-key="grid#1,0:index"] > rect')?.getAttribute('height'),
        rowStroke: document.querySelector('[data-trace-object-key="grid:row-label:1"] > rect')?.getAttribute('stroke'),
        rowFill: document.querySelector('[data-trace-object-key="grid:row-label:1"] > rect')?.getAttribute('fill'),
        highlightStroke: document.querySelector('[data-trace-attached-to="grid#1,0"]')?.getAttribute('stroke'),
        highlightHeight: document.querySelector('[data-trace-attached-to="grid#1,0"]')?.getAttribute('height'),
        outerframe: Boolean(document.querySelector('.outerframe-bg'))
      };
      const rowArrowHead = document.querySelector(
        '.trace-variable-marker-arrow-head[data-trace-marker-direction="right"]'
      );
      originalResult.rowArrowHead = {
        points: rowArrowHead?.getAttribute('points'),
        fill: rowArrowHead?.getAttribute('fill'),
        direction: rowArrowHead?.getAttribute('data-trace-marker-direction')
      };
      const nextFrame = structuredClone(frame);
      nextFrame.id = 'matrix-browser-next';
      nextFrame.state[grid].data.items[1].items[0].value = 99;
      nextFrame.state[i].data.value = 2;
      nextFrame.state[j].data.value = 1;
      nextFrame.styles = [{ id: 'next-cell', targetVariableId: grid, selector: {
        type: 'matrix-cell', rowExpression: 'i', columnExpression: 'j'
      }, styleType: 'background', color: 'yellow' }];
      nextFrame.rendererOptions[grid] = {
        rowLabels: { mode: 'custom', values: ['A', 'B'] },
        columnLabels: { mode: 'custom', values: ['X', 'Y'] },
        innerLabels: { mode: 'index', values: [] }, gridlines: 0,
        outerframe: false, markerLayout: 'axis'
      };
      traceDocument.frames.push(nextFrame);
      await window.ASMTraceRenderers.renderFrame(traceDocument, nextFrame, frame, {
        direction: 1, animatePositions: true, animateEvents: true
      });
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, nextFrame, {
        direction: -1, animatePositions: true, animateEvents: true
      });
      originalResult.reverseHighlightHeights = [...document.querySelectorAll(
        '[data-trace-attached-to="grid#1,0"][data-trace-attachment-kind="highlight"]'
      )].filter(node => node.getAttribute('display') !== 'none')
        .map(node => node.getAttribute('height'));

      const source = `
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<vector<int>> grid = {{1,2,3,4},{5,6},{7,8,9}};
  vector<char> rowNames = {'A','B','C'};
  vector<int> columnNames = {10,20,30,40};
  vector<vector<int>> innerNames = {{0,1,2,3},{0,1},{0,1,2}};
  int row = 1; int column = 0;
  // @frame grid[row][column]
  // with labels(value,index),
  //      row-labels(rowNames),
  //      column-labels(columnNames),
  //      inner-labels(innerNames),
  //      gridlines(1),
  //      outerframe(true),
  //      marker-layout(inner)
  // @style grid[row][column] highlight
  grid[row][column] = 99;
  row = 2; column = 1;
  // @frame grid[row][column] with labels(value,index), row-labels(rowNames), column-labels(columnNames), inner-labels(index), gridlines(0), outerframe(false), marker-layout(axis)
  // @style grid[row][column] background AV_yellow
}`;
      const analyzed = await fetch('/trace/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: source })
      }).then(response => response.json());
      const watches = [...new Set(analyzed.frameDirectives.flatMap(item => item.variableIds))];
      const compiled = await fetch('/compile', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: source, input: '', trace: { enabled: true, watches, sliceMode: 'manual' } })
      }).then(response => response.json());
      const compiledTrace = window.ASMTraceModel.normalizeTraceDocument(compiled.traceDocument || compiled.trace);
      const compiledGridId = Object.keys(compiledTrace.variables)
        .find(id => compiledTrace.variables[id].name === 'grid');
      await window.ASMTraceRenderers.renderFrame(compiledTrace, compiledTrace.frames[0], null, {
        animatePositions: false, animateEvents: false
      });
      const initialCompiledHighlight = document.querySelector(
        `[data-trace-attached-to="${compiledGridId}#1,0"][data-trace-attachment-kind="highlight"]`
      );
      const initialCompiledHighlightTop = initialCompiledHighlight?.getBoundingClientRect().top;
      await window.ASMTraceRenderers.renderFrame(
        compiledTrace, compiledTrace.frames[1], compiledTrace.frames[0],
        { direction: 1, animatePositions: true, animateEvents: true }
      );
      originalResult.forwardMutationValues = [
        document.querySelector(`[data-trace-object-key="${compiledGridId}#1,0"] [data-trace-content-role="value"]`)?.textContent,
        document.querySelector(`[data-trace-object-key="${compiledGridId}#2,1"] [data-trace-content-role="value"]`)?.textContent
      ];
      const reverseHeights = [];
      const reverseTransition = window.ASMTraceRenderers.renderFrame(
        compiledTrace, compiledTrace.frames[0], compiledTrace.frames[1],
        { direction: -1, animatePositions: true, animateEvents: true }
      );
      const sampler = setInterval(() => {
        document.querySelectorAll(
          `[data-trace-attached-to="${compiledGridId}#1,0"][data-trace-attachment-kind="highlight"]`
        ).forEach(node => {
          if (node.getAttribute('display') !== 'none') reverseHeights.push(node.getAttribute('height'));
        });
      }, 16);
      await reverseTransition;
      clearInterval(sampler);
      originalResult.compiledReverseHighlightHeights = [...document.querySelectorAll(
        `[data-trace-attached-to="${compiledGridId}#1,0"][data-trace-attachment-kind="highlight"]`
      )].filter(node => node.getAttribute('display') !== 'none')
        .map(node => node.getAttribute('height'));
      originalResult.compiledReverseHighlightSamples = [...new Set(reverseHeights)];
      const reversedCompiledHighlight = document.querySelector(
        `[data-trace-attached-to="${compiledGridId}#1,0"][data-trace-attachment-kind="highlight"]`
      );
      originalResult.compiledReverseHighlightTopDelta = Math.round(
        (reversedCompiledHighlight?.getBoundingClientRect().top || 0) - (initialCompiledHighlightTop || 0)
      );
      traceDocument.skins[grid].options = {
        rowLabels: { mode: 'none', values: [] },
        columnLabels: { mode: 'none', values: [] },
        innerLabels: { mode: 'none', values: [] },
        gridlines: 1, outerframe: true, markerLayout: 'axis'
      };
      frame.rendererOptions[grid] = { markerLayout: 'axis' };
      await window.ASMTraceRenderers.renderFrame(traceDocument, frame, null, {
        animatePositions: false, animateEvents: false
      });
      return {
        ...originalResult,
        hiddenAxisTargets: document.querySelectorAll('[data-trace-axis-target="1"]').length,
        hiddenLabelMarkers: [...document.querySelectorAll('.trace-variable-marker-label-text')]
          .map(node => node.textContent).sort(),
        originalOuterframeFill: document.querySelector('.outerframe-bg')?.getAttribute('fill')
      };
    });
    assert.deepEqual(result, {
      cells: 3, rowLabels: 2, columnLabels: 2, innerLabels: 3,
      markers: ['i', 'j'], cellStroke: '#333', cellStrokeWidth: '0',
      innerFill: '#fff', innerHeight: '12',
      rowStroke: '#333', rowFill: 'rgba(111, 161, 255, 0.7)',
      highlightStroke: 'red', highlightHeight: '52', outerframe: false,
      rowArrowHead: { points: '-8,-5 -2,0 -8,5', fill: '#333', direction: 'right' },
      reverseHighlightHeights: ['52'],
      forwardMutationValues: ['99', '8'], compiledReverseHighlightHeights: ['52'],
      compiledReverseHighlightSamples: ['52'],
      compiledReverseHighlightTopDelta: 0,
      hiddenAxisTargets: 4, hiddenLabelMarkers: ['i', 'j'],
      originalOuterframeFill: 'rgba(209,230,172,0.5)'
    });
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
});
