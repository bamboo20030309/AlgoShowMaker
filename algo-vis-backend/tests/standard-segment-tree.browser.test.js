const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('standard n=10 segment tree uses proportional intervals at natural recursion depths', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base + '/algorithm.html');
    await page.waitForFunction(() => window.ace && window.ASMTracePlayer);
    const code = fs.readFileSync(path.join(__dirname, '../algorithm_sample/Tree/Segment_Tree_standard.cpp'), 'utf8')
      .replace(/\r\n?/g, '\n');
    const input = fs.readFileSync(path.join(__dirname, '../algorithm_sample/Tree/Segment_Tree_standard-sample_input.txt'), 'utf8');
    await page.evaluate(({ code, input }) => {
      ace.edit('editor').setValue(code, -1);
      document.getElementById('inputArea').value = input;
    }, { code, input });
    await page.evaluate(() => document.getElementById('runBtn').click());
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code, code, { timeout: 30000 });
    const result = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const doc = player.getDocument();
      const treeId = Object.entries(doc.variables).find(([, value]) => value.name === 'tree')[0];
      const frameIndex = doc.frames.findIndex(frame => frame.renderers?.[treeId] === 'original-segment-tree');
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      const tree = [...document.querySelectorAll(`[data-trace-variable="${treeId}"]`)].at(-1);
      const layout = tree.querySelector('[data-layout="segment_tree_interval"]');
      const cell = index => tree.querySelector(`[data-trace-index="${index}"]`);
      const geometry = index => {
        const target = cell(index);
        const rect = target?.querySelector(':scope > rect');
        const label = tree.querySelector(`[data-trace-index-label="${index}"]`);
        const indexRect = label?.querySelector?.('rect');
        const indexText = label?.querySelector?.('[data-segment-label-role="index"]');
        const intervalText = label?.querySelector?.('[data-segment-label-role="interval"]');
        return {
          left: Number(target?.dataset.segmentLeft),
          right: Number(target?.dataset.segmentRight),
          x: Number(rect?.getAttribute('x')),
          y: Number(rect?.getAttribute('y')),
          width: Number(rect?.getAttribute('width')),
          height: Number(rect?.getAttribute('height')),
          valueFontSize: Number(target?.querySelector(':scope > text')?.getAttribute('font-size')),
          indexHeight: Number(indexRect?.getAttribute('height')),
          label: label?.textContent,
          indexLabel: indexText ? {
            text: indexText.textContent,
            anchor: indexText.getAttribute('text-anchor'),
            x: Number(indexText.getAttribute('x'))
          } : null,
          intervalLabel: intervalText ? {
            text: intervalText.textContent,
            anchor: intervalText.getAttribute('text-anchor'),
            x: Number(intervalText.getAttribute('x')),
            fontSize: Number(intervalText.getAttribute('font-size'))
          } : null,
          labelOverlap: indexText && intervalText
            ? indexText.getBBox().x + indexText.getBBox().width > intervalText.getBBox().x
            : false
        };
      };
      const visible = [...tree.querySelectorAll('[data-trace-index]')].map(node => Number(node.dataset.traceIndex));
      const segment = tree.closest('#asm-trace-root').querySelector('.asm-trace-heap-cell-segment');
      const frontiers = [];
      for (let index = 0; index < doc.frames.length; index++) {
        const descriptor = (doc.frames[index].segments || []).find(item => item.split);
        if (!descriptor) continue;
        await player.render(index, { animatePositions: false, animateEvents: false });
        const scene = document.getElementById('asm-trace-root');
        frontiers.push({
          phase: descriptor.split.phase,
          nodes: [...scene.querySelectorAll('.asm-trace-heap-cell-segment')]
            .map(item => Number(item.dataset.traceSegmentNode)).sort((a, b) => a - b)
        });
      }
      return {
        layout: layout?.getAttribute('data-layout'),
        root: geometry(1), left: geometry(2), right: geometry(3),
        three: geometry(4), two: geometry(5), leafThree: geometry(9),
        pairOneTwo: geometry(8), leafOne: geometry(16), leafTen: geometry(15),
        visible: visible.sort((a, b) => a - b),
        segment: segment ? {
          node: Number(segment.dataset.traceSegmentNode),
          width: Number(segment.getAttribute('width'))
        } : null,
        frontiers,
        edgeToLeafThree: Boolean(tree.querySelector('[data-segment-parent="4"][data-segment-child="9"]')),
        edgeToLeafOne: Boolean(tree.querySelector('[data-segment-parent="8"][data-segment-child="16"]'))
      };
    });
    assert.equal(result.layout, 'segment_tree_interval');
    assert.deepEqual(result.visible, [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,24,25]);
    assert.deepEqual([result.root.left, result.root.right, result.root.width], [1,10,400]);
    assert.deepEqual([result.left.left, result.left.right, result.left.width], [1,5,200]);
    assert.deepEqual([result.right.left, result.right.right, result.right.width], [6,10,200]);
    assert.deepEqual([result.three.width, result.two.width, result.leafThree.width], [120,80,40]);
    assert.deepEqual([result.leafThree.height, result.leafThree.indexHeight], [40,12]);
    assert.deepEqual([result.root.valueFontSize, result.leafOne.valueFontSize,
      result.leafTen.valueFontSize], [16,16,16]);
    assert.equal(result.left.y, result.right.y);
    assert.ok(result.three.y > result.left.y);
    assert.equal(result.pairOneTwo.y, result.leafThree.y);
    assert.ok(result.leafOne.y > result.leafThree.y, 'early leaf stays at its natural recursion depth');
    assert.match(result.root.label, /\[1,10\]/);
    assert.deepEqual(result.root.indexLabel, { text: '1', anchor: 'middle', x: 208 });
    assert.deepEqual(result.root.intervalLabel,
      { text: '[1,10]', anchor: 'end', x: 405, fontSize: 9 });
    assert.deepEqual(result.leafOne.indexLabel, { text: '16', anchor: 'middle', x: 28 });
    assert.deepEqual(result.leafOne.intervalLabel,
      { text: '[1]', anchor: 'end', x: 45, fontSize: 8 });
    assert.deepEqual(result.leafTen.intervalLabel,
      { text: '[10]', anchor: 'end', x: 405, fontSize: 8 });
    assert.equal(result.leafOne.labelOverlap, false);
    assert.equal(result.leafTen.labelOverlap, false);
    assert.deepEqual(result.segment, { node: 1, width: 240 });
    assert.ok(result.frontiers.some(item => item.phase === 'before'
      && JSON.stringify(item.nodes) === JSON.stringify([2,3])));
    assert.ok(result.frontiers.some(item => item.phase === 'before'
      && JSON.stringify(item.nodes) === JSON.stringify([3,5,9])));
    assert.ok(result.frontiers.some(item => item.phase === 'after'
      && JSON.stringify(item.nodes) === JSON.stringify([3,5])));
    assert.equal(result.edgeToLeafThree, false);
    assert.equal(result.edgeToLeafOne, false);
    assert.deepEqual(errors, []);

    const zeroBasedCode = `#include <bits/stdc++.h>
using namespace std;
vector<int> tree;
int n;
int main() {
  cin >> n;
  tree.assign(4 * n + 5, 0);
  // @frame tree render segment_tree with range(0,n-1)
  return 0;
}
`;
    await page.evaluate(({ code }) => {
      ace.edit('editor').setValue(code, -1);
      document.getElementById('inputArea').value = '10\n';
    }, { code: zeroBasedCode });
    await page.evaluate(() => document.getElementById('runBtn').click());
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code,
      zeroBasedCode, { timeout: 30000 });
    const zeroBased = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const doc = player.getDocument();
      const treeId = Object.entries(doc.variables).find(([, value]) => value.name === 'tree')[0];
      const frameIndex = doc.frames.findIndex(frame => frame.renderers?.[treeId] === 'original-segment-tree');
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      const tree = [...document.querySelectorAll(`[data-trace-variable="${treeId}"]`)].at(-1);
      const geometry = index => {
        const cell = tree.querySelector(`[data-trace-index="${index}"]`);
        const rect = cell?.querySelector(':scope > rect');
        return {
          left: Number(cell?.dataset.segmentLeft),
          right: Number(cell?.dataset.segmentRight),
          width: Number(rect?.getAttribute('width'))
        };
      };
      return {
        visible: [...tree.querySelectorAll('[data-trace-index]')]
          .map(node => Number(node.dataset.traceIndex)).sort((a, b) => a - b),
        root: geometry(0), left: geometry(1), right: geometry(2),
        edge: Boolean(tree.querySelector('[data-segment-parent="0"][data-segment-child="1"]'))
      };
    });
    assert.deepEqual(zeroBased.visible, [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,23,24]);
    assert.deepEqual(zeroBased.root, { left: 0, right: 9, width: 400 });
    assert.deepEqual(zeroBased.left, { left: 0, right: 4, width: 200 });
    assert.deepEqual(zeroBased.right, { left: 5, right: 9, width: 200 });
    assert.equal(zeroBased.edge, false);

    const gapCode = code.replaceAll('range(1,n)', 'range(1,n), gap(10,24)');
    await page.evaluate(({ code, input }) => {
      ace.edit('editor').setValue(code, -1);
      document.getElementById('inputArea').value = input;
    }, { code: gapCode, input });
    await page.evaluate(() => document.getElementById('runBtn').click());
    await page.waitForFunction(code => window.ASMTracePlayer.getDocument()?.sourceCode === code,
      gapCode, { timeout: 30000 });
    const withGap = await page.evaluate(async () => {
      const player = window.ASMTracePlayer;
      const doc = player.getDocument();
      const treeId = Object.entries(doc.variables).find(([, value]) => value.name === 'tree')[0];
      const frameIndex = doc.frames.findIndex(frame => frame.renderers?.[treeId] === 'original-segment-tree');
      await player.render(frameIndex, { animatePositions: false, animateEvents: false });
      const tree = [...document.querySelectorAll(`[data-trace-variable="${treeId}"]`)].at(-1);
      const geometry = index => {
        const cell = tree.querySelector(`[data-trace-index="${index}"]`);
        const rect = cell?.querySelector(':scope > rect');
        return {
          y: Number(rect?.getAttribute('y')),
          width: Number(rect?.getAttribute('width'))
        };
      };
      const segment = tree.closest('#asm-trace-root').querySelector('.asm-trace-heap-cell-segment');
      return {
        root: geometry(1), left: geometry(2), three: geometry(4), two: geometry(5), leaf: geometry(9),
        segmentWidth: Number(segment?.getAttribute('width')),
        horizontalGap: Number(tree.querySelector('[data-horizontal-gap]')?.getAttribute('data-horizontal-gap')),
        verticalGap: Number(tree.querySelector('[data-vertical-gap]')?.getAttribute('data-vertical-gap')),
        edge: Boolean(tree.querySelector('[data-segment-parent="4"][data-segment-child="9"]'))
      };
    });
    assert.deepEqual([withGap.root.width, withGap.left.width, withGap.three.width,
      withGap.two.width, withGap.leaf.width], [490,240,140,90,40]);
    assert.equal(withGap.left.y - withGap.root.y, 76);
    assert.equal(withGap.three.y - withGap.left.y, 76);
    assert.equal(withGap.segmentWidth, 290);
    assert.deepEqual([withGap.horizontalGap, withGap.verticalGap], [10,24]);
    assert.equal(withGap.edge, true);
  } finally {
    await browser.close();
  }
});
