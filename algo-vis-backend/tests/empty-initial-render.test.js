const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { compile } = require('./helpers/compile');

function renderWindow() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="scene"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.CSS = { escape: value => String(value).replace(/[^\w-]/g, '\\$&') };
  window.fitSvgText = () => 16;
  window.draw_block = (group, x, y, value, width, height, fill, id) => {
    const cell = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
    cell.id = id;
    const box = window.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    box.setAttribute('x', x);
    box.setAttribute('y', y);
    box.setAttribute('width', width);
    box.setAttribute('height', height);
    box.setAttribute('fill', fill);
    const text = window.document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.textContent = String(value);
    cell.append(box, text);
    cell.setAttribute('data-alive', '1');
    group.append(cell);
  };
  for (const name of ['draw_array_outerframe.js', 'draw_array_normal.js']) {
    window.eval(fs.readFileSync(path.join(__dirname, '../public/draw', name), 'utf8'));
  }
  const renderer = fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8')
    .replace('window.ASMTraceRenderers = {', 'window.ASMTraceRenderers = { renderOriginal,');
  window.eval(renderer);
  return window;
}

test('empty vector has a one-cell-width outerframe without a phantom cell; unassigned scalar has one blank cell', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr;
  int number;
  // @frame arr,number
  arr.push_back(7);
  number = 5;
  // @frame arr,number
  return 0;
}`);
  const ids = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const first = trace.frames[0];
  assert.equal(first.state[ids.arr].data.items.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(first.state[ids.number].data)), { kind: 'scalar', value: '' });

  const window = renderWindow();
  const draw = (frame, variableId, rendererName) => {
    const group = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
    window.document.querySelector('#scene').append(group);
    window.ASMTraceRenderers.renderOriginal(group, frame.state[variableId], {
      variableId, variable: trace.variables[variableId], frame,
      rendererName, highlights: {}, idPrefix: 'empty-test'
    });
    return group;
  };
  const array = draw(first, ids.arr, 'original-array');
  assert.equal(array.querySelector('.outerframe-bg').getAttribute('width'), '56');
  assert.equal(array.querySelectorAll('[data-trace-index]').length, 0);
  assert.equal(array.querySelectorAll('[id^="cell-"]').length, 0);

  const number = draw(first, ids.number, 'original-cell');
  assert.equal(number.querySelectorAll('[data-trace-index]').length, 1);
  assert.equal(number.querySelector('[data-trace-index="0"] > text').textContent, '');
  assert.equal(number.querySelector('.outerframe-bg').getAttribute('width'), '56');

  const secondArray = draw(trace.frames[1], ids.arr, 'original-array');
  assert.equal(secondArray.querySelectorAll('[data-trace-index]').length, 1);
  assert.equal(secondArray.querySelector('[data-trace-index="0"] > text').textContent, '7');
});
