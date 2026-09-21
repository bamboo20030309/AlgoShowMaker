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
        return {
          left: Number(target?.dataset.segmentLeft),
          right: Number(target?.dataset.segmentRight),
          x: Number(rect?.getAttribute('x')),
          y: Number(rect?.getAttribute('y')),
          width: Number(rect?.getAttribute('width')),
          label: tree.querySelector(`[data-trace-index-label="${index}"]`)?.textContent
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
        pairOneTwo: geometry(8), leafOne: geometry(16),
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
    assert.deepEqual([result.root.left, result.root.right, result.root.width], [1,10,480]);
    assert.deepEqual([result.left.left, result.left.right, result.left.width], [1,5,240]);
    assert.deepEqual([result.right.left, result.right.right, result.right.width], [6,10,240]);
    assert.deepEqual([result.three.width, result.two.width, result.leafThree.width], [144,96,48]);
    assert.equal(result.left.y, result.right.y);
    assert.ok(result.three.y > result.left.y);
    assert.equal(result.pairOneTwo.y, result.leafThree.y);
    assert.ok(result.leafOne.y > result.leafThree.y, 'early leaf stays at its natural recursion depth');
    assert.match(result.root.label, /\[1,10\]/);
    assert.deepEqual(result.segment, { node: 1, width: 288 });
    assert.ok(result.frontiers.some(item => item.phase === 'before'
      && JSON.stringify(item.nodes) === JSON.stringify([2,3])));
    assert.ok(result.frontiers.some(item => item.phase === 'before'
      && JSON.stringify(item.nodes) === JSON.stringify([3,5,9])));
    assert.ok(result.frontiers.some(item => item.phase === 'after'
      && JSON.stringify(item.nodes) === JSON.stringify([3,5])));
    assert.equal(result.edgeToLeafThree, true);
    assert.equal(result.edgeToLeafOne, true);
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
    assert.deepEqual(zeroBased.root, { left: 0, right: 9, width: 480 });
    assert.deepEqual(zeroBased.left, { left: 0, right: 4, width: 240 });
    assert.deepEqual(zeroBased.right, { left: 5, right: 9, width: 240 });
    assert.equal(zeroBased.edge, true);
  } finally {
    await browser.close();
  }
});
