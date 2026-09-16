const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('value-dependent background uses presented swap values instead of the destination frame', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
void quick_sort(vector<int>& arr, int low, int high) {
  if (low >= high) return;
  int pivot = arr[high];
  int i = low;
  // @frame arr[i],pivot
  for (int j=low; j<high; j++) {
    if (arr[j] < pivot) {
      if (i != j) swap(arr[i], arr[j]);
      i++;
    }
    // @frame arr[i,j],pivot
    // @style arr[low:j] background AV_green when value < pivot
    // @style arr[low:j] background AV_red when value > pivot
  }
  if (i != high) swap(arr[i], arr[high]);
  // @frame arr[i,high],pivot
}
int main() {
  int n; cin >> n;
  vector<int> arr(n);
  for (int& value : arr) cin >> value;
  // @frame arr
  quick_sort(arr, 0, n-1);
}`, '6\n5 7 2 1 9 4\n');
  const frame = trace.frames.find(item => item.styles?.some(style => (
    String(style.when?.expression || style.when).includes('value')
  )) && item.events?.some(event => event.type === 'swap'));
  assert.ok(frame, 'expected a styled frame containing a swap');
  const arrId = frame.styles.find(style => (
    String(style.when?.expression || style.when).includes('value')
  )).targetVariableId;
  const swap = frame.events.find(event => event.type === 'swap');
  const left = Number(swap.targets[0].resolvedIndex);
  const right = Number(swap.targets[1].resolvedIndex);
  const presentedValues = new Map([[arrId, new Map([
    [left, swap.payload.leftBefore], [right, swap.payload.rightBefore]
  ])]]);
  const before = window.ASMTraceRules.evaluate(trace, frame, { presentedValues })[arrId];
  const after = window.ASMTraceRules.evaluate(trace, frame)[arrId];
  const beforeLeft = window.ASMTraceModel.scalarValue(swap.payload.leftBefore);
  const afterLeft = window.ASMTraceModel.scalarValue(swap.payload.leftAfter);
  assert.notEqual(beforeLeft, afterLeft);
  assert.notEqual(before[String(left)]?.styleTypes?.background,
    after[String(left)]?.styleTypes?.background);

  const attributes = new Map();
  const rect = {
    setAttribute(name, value) { attributes.set(name, value); }
  };
  const text = { dataset: {}, textContent: '' };
  const cell = {
    dataset: { traceIndex: String(left) },
    matches() { return false; },
    closest(selector) {
      if (selector === '[data-trace-index]') return this;
      if (selector === '[data-trace-variable]') {
        return { dataset: { traceVariable: arrId } };
      }
      return null;
    },
    querySelector(selector) {
      if (selector === 'text') return text;
      if (selector === ':scope > rect') return rect;
      return null;
    }
  };
  const replay = window.ASMTraceFrameTween.prepareForwardValues({
    document: trace, currentElements: new Map([['visual-cell', cell]])
  }, {
    visualValueTracks: [{
      kind: 'value', key: 'visual-cell', initial: swap.payload.leftBefore,
      steps: [{ mode: 'animated', commitMs: 300, after: swap.payload.leftAfter }]
    }]
  }, frame);
  replay.applyStyles();
  assert.equal(attributes.get('fill'), before[String(left)].styleTypes.background);
  replay.update(299);
  replay.applyStyles();
  assert.equal(attributes.get('fill'), before[String(left)].styleTypes.background);
  replay.update(300);
  replay.applyStyles();
  assert.equal(attributes.get('fill'), after[String(left)].styleTypes.background);
});

test('swap keeps index-label backgrounds on logical values until the swap commits', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {5, 2, 4};
  int pivot = 4;
  // @frame arr,pivot
  swap(arr[0], arr[1]);
  // @frame arr,pivot
  // @style arr[0:1] background AV_green when value < pivot
  // @style arr[0:1] background AV_red when value > pivot
}`);
  const frame = trace.frames[1];
  const swap = frame.events.find(event => event.type === 'swap');
  assert.ok(swap);
  const plan = window.ASMTraceFrameTween.createForwardReplayPlan(trace, frame, [
    { event: swap, animation: 'swap', start: 0, end: 500 }
  ]);
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const paints = new Map();
  const elements = new Map();
  const previousObjects = new Map();
  for (const index of [0, 1]) {
    const cellRect = { setAttribute(name, value) { paints.set(`cell:${index}:${name}`, value); } };
    const indexRect = { setAttribute(name, value) { paints.set(`index:${index}:${name}`, value); } };
    const label = {
      dataset: { traceIndexLabel: String(index) },
      getAttribute(name) { return name === 'data-trace-index-label' ? String(index) : null; },
      closest(selector) {
        return selector === '[data-trace-variable]'
          ? { dataset: { traceVariable: arrId } } : null;
      },
      querySelector(selector) { return selector === ':scope > rect' ? indexRect : null; }
    };
    const text = { dataset: {}, textContent: '' };
    const cell = {
      dataset: { traceIndex: String(index) },
      matches() { return false; },
      closest(selector) {
        if (selector === '[data-trace-index]') return this;
        return selector === '[data-trace-variable]'
          ? { dataset: { traceVariable: arrId } } : null;
      },
      querySelector(selector) {
        if (selector === 'text') return text;
        return selector === ':scope > rect' ? cellRect : null;
      }
    };
    elements.set(`${arrId}#${index}`, cell);
    elements.set(`${arrId}#${index}:index`, label);
    const previousFill = index === 0
      ? 'rgba(239, 154, 154, 0.6)' : 'rgba(165, 214, 167, 0.6)';
    const previous = {
      querySelector(selector) {
        return selector === ':scope > rect' ? {
          getAttribute(name) { return name === 'fill' ? previousFill : null; }
        } : null;
      }
    };
    previousObjects.set(`${arrId}#${index}`, previous);
    previousObjects.set(`${arrId}#${index}:index`, previous);
  }
  const replay = window.ASMTraceFrameTween.prepareForwardValues({
    document: trace, currentElements: elements, previousObjects
  }, plan, frame);
  const before = window.ASMTraceRules.evaluate(trace, frame, {
    presentedValues: new Map([[arrId, new Map([
      [0, swap.payload.leftBefore], [1, swap.payload.rightBefore]
    ])]])
  })[arrId];
  const after = window.ASMTraceRules.evaluate(trace, frame)[arrId];

  replay.applyStyles();
  assert.equal(paints.get('index:0:fill'), before['0'].styleTypes.background);
  assert.equal(paints.get('index:1:fill'), before['1'].styleTypes.background);
  assert.equal(paints.get('cell:0:fill'), before['1'].styleTypes.background);
  assert.equal(paints.get('cell:1:fill'), before['0'].styleTypes.background);
  assert.equal(paints.get('cell:0:fill'), paints.get('index:1:fill'),
    'the value cell must share the background of the index box at its presented position');
  assert.equal(paints.get('cell:1:fill'), paints.get('index:0:fill'),
    'both halves of a presented array slot must repaint in the same checkpoint');
  assert.notEqual(paints.get('cell:0:fill'), paints.get('index:0:fill'),
    'the incoming value cell must not recolor the stationary index prematurely');
  replay.update(499);
  replay.applyStyles();
  assert.equal(paints.get('index:0:fill'), before['0'].styleTypes.background);
  assert.equal(paints.get('index:1:fill'), before['1'].styleTypes.background);
  replay.update(500);
  replay.applyStyles();
  assert.equal(paints.get('index:0:fill'), after['0'].styleTypes.background);
  assert.equal(paints.get('index:1:fill'), after['1'].styleTypes.background);
  assert.equal(paints.get('index:0:fill'), paints.get('cell:0:fill'));
  assert.equal(paints.get('index:1:fill'), paints.get('cell:1:fill'));
});

test('forward style checkpoint keeps the actually presented paint until assignment commits', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {5, 2};
  int pivot = 4;
  // @frame arr,pivot
  arr[0] = 1;
  // @frame arr,pivot
  // @style arr[0:1] background AV_green when value < pivot
}`);
  const frame = trace.frames[1];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const paint = new Map();
  const currentRect = {
    getAttribute() { return null; },
    setAttribute(name, value) { paint.set(name, value); }
  };
  const previousRect = {
    getAttribute(name) {
      return name === 'fill' ? '#ef9a9a'
        : name === 'fill-opacity' ? '0.58' : null;
    }
  };
  const text = { dataset: {}, textContent: '' };
  const otherPaint = new Map();
  const otherRect = {
    getAttribute() { return null; },
    setAttribute(name, value) { otherPaint.set(name, value); }
  };
  const cell = {
    dataset: { traceIndex: '0' },
    matches() { return false; },
    closest(selector) {
      return selector === '[data-trace-index]' ? this
        : selector === '[data-trace-variable]'
          ? { dataset: { traceVariable: arrId } } : null;
    },
    querySelector(selector) {
      return selector === 'text' ? text
        : selector === ':scope > rect' ? currentRect : null;
    }
  };
  const replay = window.ASMTraceFrameTween.prepareForwardValues({
    document: trace,
    currentElements: new Map([
      [`${arrId}#0`, cell],
      [`${arrId}#1`, {
        dataset: { traceIndex: '1' },
        closest(selector) {
          return selector === '[data-trace-variable]'
            ? { dataset: { traceVariable: arrId } } : null;
        },
        querySelector(selector) {
          return selector === ':scope > rect' ? otherRect : null;
        }
      }]
    ]),
    previousObjects: new Map([[`${arrId}#0`, {
      querySelector(selector) {
        return selector === ':scope > rect' ? previousRect : null;
      }
    }], [`${arrId}#1`, {
      querySelector(selector) {
        return selector === ':scope > rect' ? previousRect : null;
      }
    }]])
  }, {
    visualValueTracks: [{
      kind: 'value', key: `${arrId}#0`, initial: 5,
      steps: [
        { mode: 'animated', commitMs: 300, before: 5, after: 1 },
        { mode: 'instant', commitMs: 500, before: 1, after: 6 }
      ]
    }]
  }, frame);
  replay.applyStyles();
  assert.equal(paint.get('fill'), '#ef9a9a');
  assert.equal(paint.get('fill-opacity'), '0.58');
  assert.equal(otherPaint.get('fill'), '#ef9a9a');
  replay.update(299);
  replay.applyStyles();
  assert.equal(paint.get('fill'), '#ef9a9a');
  assert.equal(otherPaint.get('fill'), '#ef9a9a');
  replay.update(300);
  replay.applyStyles();
  assert.equal(text.textContent, '1');
  assert.equal(paint.get('fill'), 'rgba(165, 214, 167, 0.6)');
  assert.equal(otherPaint.get('fill'), 'rgba(165, 214, 167, 0.6)');
  replay.update(499);
  replay.applyStyles();
  assert.equal(paint.get('fill'), 'rgba(165, 214, 167, 0.6)');
  replay.update(500);
  replay.applyStyles();
  assert.equal(text.textContent, '6');
  assert.equal(paint.get('fill'), '#ffffff');
});

test('index and value boxes keep one previous checkpoint until a dependent scalar commits', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {2};
  int key = 3;
  // @frame arr,key
  key = 1;
  // @frame arr,key
  // @style arr[0] background AV_green when value < key
  // @style arr[0] background AV_red when value >= key
}`);
  const frame = trace.frames[1];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const keyId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'key');
  const paints = new Map();
  const makeRect = prefix => ({
    getAttribute(name) {
      if (name === 'fill') return '#ef9a9a';
      if (name === 'fill-opacity') return '0.58';
      return null;
    },
    setAttribute(name, value) { paints.set(`${prefix}:${name}`, value); }
  });
  const valueRect = makeRect('value');
  const indexRect = makeRect('index');
  const keyRect = makeRect('key');
  const variableHost = id => ({ dataset: { traceVariable: id } });
  const arrCell = {
    dataset: { traceIndex: '0' },
    matches() { return false; },
    closest(selector) {
      if (selector === '[data-trace-index]') return this;
      return selector === '[data-trace-variable]' ? variableHost(arrId) : null;
    },
    querySelector(selector) {
      if (selector === 'text') return { dataset: {}, textContent: '2' };
      return selector === ':scope > rect' ? valueRect : null;
    },
    hasAttribute() { return false; }
  };
  const indexLabel = {
    dataset: { traceIndexLabel: '0' },
    hasAttribute(name) { return name === 'data-trace-index-label'; },
    getAttribute(name) { return name === 'data-trace-index-label' ? '0' : null; },
    closest(selector) {
      return selector === '[data-trace-variable]' ? variableHost(arrId) : null;
    },
    querySelector(selector) { return selector === ':scope > rect' ? indexRect : null; }
  };
  const keyText = { dataset: {}, textContent: '1' };
  const keyCell = {
    dataset: { traceIndex: '0' },
    matches() { return false; },
    closest(selector) {
      if (selector === '[data-trace-index]') return this;
      return selector === '[data-trace-variable]' ? variableHost(keyId) : null;
    },
    querySelector(selector) {
      if (selector === 'text') return keyText;
      return selector === ':scope > rect' ? keyRect : null;
    },
    hasAttribute() { return false; }
  };
  const previousVisual = rect => ({
    querySelector(selector) { return selector === ':scope > rect' ? rect : null; }
  });
  const replay = window.ASMTraceFrameTween.prepareForwardValues({
    document: trace,
    currentElements: new Map([
      [`${arrId}#0`, arrCell],
      [`${arrId}#0:index`, indexLabel],
      [keyId, keyCell]
    ]),
    previousObjects: new Map([
      [`${arrId}#0`, previousVisual(valueRect)],
      [`${arrId}#0:index`, previousVisual(indexRect)],
      [keyId, previousVisual(keyRect)]
    ])
  }, {
    visualValueTracks: [{
      kind: 'value', key: keyId, initial: 3,
      steps: [{ mode: 'animated', commitMs: 300, before: 3, after: 1 }]
    }],
    valueTracks: []
  }, frame);

  replay.applyStyles();
  assert.equal(paints.get('value:fill'), '#ef9a9a');
  assert.equal(paints.get('index:fill'), '#ef9a9a');
  replay.update(299);
  replay.applyStyles();
  assert.equal(paints.get('value:fill'), '#ef9a9a');
  assert.equal(paints.get('index:fill'), '#ef9a9a');
  replay.update(300);
  replay.applyStyles();
  assert.equal(paints.get('value:fill'), paints.get('index:fill'));
  assert.notEqual(paints.get('value:fill'), '#ef9a9a');
});
