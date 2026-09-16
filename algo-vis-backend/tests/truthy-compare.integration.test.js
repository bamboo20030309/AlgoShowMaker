const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const { compile, load } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> isprime = {1, 0};
  for (int i = 0; i < 2; i++) {
    if (isprime[i]) { int marker = 1; }
    // @frame isprime
  }
  if (isprime[0] > isprime[1]) { int marker = 2; }
  // @frame isprime
  return 0;
}`;

function tweenWindow() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="scene"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const { window } = dom;
  window.ASMTraceEvents = {
    animation: type => type === 'compare' ? 'compare' : 'none',
    ordered: events => [...events].sort((a, b) => a.order - b.order)
  };
  window.ASMTraceRules = { resolveExpression: () => null };
  const tweenSource = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { compareScaleTargets, createTruthyCompareEffect,');
  window.eval(tweenSource);
  return window;
}

test('single-value if produces ordered, controllable one-target compare events without changing binary compare', async () => {
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 3);
  const truthy = trace.frames.slice(0, 2).map(frame => frame.events.find(event => (
    event.type === 'compare' && event.comparisonKind === 'truthy'
  )));
  assert.ok(truthy.every(Boolean));
  assert.deepEqual(Array.from(truthy, event => event.result), [true, false]);
  assert.deepEqual(Array.from(truthy, event => event.targets.length), [1, 1]);
  assert.deepEqual(Array.from(truthy, event => event.targets[0].resolvedIndex), [0, 1]);
  truthy.forEach((event, index) => {
    const condition = trace.frames[index].events.find(item => item.type === 'condition'
      && item.conditionKind === 'IfStatement');
    assert.ok(condition);
    assert.ok(event.order < condition.order);
    assert.equal(event.targets[0].variableId !== '', true);
    assert.equal(event.enabled, true);
  });
  const binary = trace.frames[2].events.find(event => event.type === 'compare'
    && event.operation === '>');
  assert.ok(binary);
  assert.equal(binary.comparisonKind, undefined);
  assert.equal(binary.targets.length, 2);

  const window = tweenWindow();
  const frame = trace.frames[0];
  const event = truthy[0];
  const objectKey = frame.source.objectId || event.targets[0].variableId;
  const cellKey = `${objectKey}#0`;
  const cell = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const rect = window.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('x', '8');
  rect.setAttribute('y', '8');
  rect.setAttribute('width', '40');
  rect.setAttribute('height', '40');
  cell.append(rect);
  window.document.querySelector('#scene').append(cell);
  const placements = new Map([[cellKey, { x: 8, y: 8, width: 40, height: 40 }]]);
  const elements = new Map([[cellKey, cell]]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0,
    new Map(), candidate => candidate === event
  );
  assert.equal(event.autoAnimationDisabled, false);
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].duration, 1560);
  const binaryScales = window.ASMTraceFrameTween.compareScaleTargets([
    { numericValue: 4 }, { numericValue: 1 }
  ]);
  assert.ok(Math.abs(binaryScales[0] - 1.14) < 0.001);
  assert.ok(Math.abs(binaryScales[1] - 0.86) < 0.001);

  const effect = window.ASMTraceFrameTween.createTruthyCompareEffect(
    event, trace, frame, placements, elements, key => key
  );
  effect.update(180);
  const highlight = cell.querySelector('.asm-trace-truthy-highlight');
  assert.ok(highlight);
  assert.equal(highlight.getAttribute('stroke'), 'rgb(165, 214, 167)');
  assert.equal(highlight.getAttribute('opacity'), '1');
  assert.equal(effect.adjustments.get(cellKey)?.scale, 1);
  effect.update(580);
  assert.equal(effect.adjustments.get(cellKey)?.scale, 1);
  effect.update(730);
  assert.ok(effect.adjustments.get(cellKey)?.scale > 1);
  assert.ok(effect.adjustments.get(cellKey)?.scale < 1.14);
  effect.update(880);
  assert.ok(Math.abs(effect.adjustments.get(cellKey)?.scale - 1.14) < 0.001);
  assert.equal(cell.getAttribute('transform'), null);
  assert.equal(window.document.querySelectorAll('.asm-trace-compare-marker-popup, .asm-trace-compare-self-clone').length, 0);
  effect.update(1300);
  assert.ok(Math.abs(effect.adjustments.get(cellKey)?.scale - 1.14) < 0.001);
  effect.update(1430);
  assert.ok(effect.adjustments.get(cellKey)?.scale < 1.14);
  effect.update(1560);
  assert.equal(cell.querySelector('.asm-trace-truthy-highlight'), null);
  assert.equal(effect.adjustments.size, 0);

  const falseEvent = truthy[1];
  const falseFrame = trace.frames[1];
  const falseCellKey = `${falseEvent.targets[0].variableId}#1`;
  const falseCell = cell.cloneNode(true);
  const falsePlacements = new Map([[falseCellKey, { x: 48, y: 8, width: 40, height: 40 }]]);
  const falseEffect = window.ASMTraceFrameTween.createTruthyCompareEffect(
    falseEvent, trace, falseFrame, falsePlacements,
    new Map([[falseCellKey, falseCell]]), key => key
  );
  falseEffect.update(880);
  assert.equal(falseCell.querySelector('.asm-trace-truthy-highlight')?.getAttribute('stroke'),
    'rgb(239, 154, 154)');
  assert.ok(Math.abs(falseEffect.adjustments.get(falseCellKey)?.scale - 1.14) < 0.001);
  falseEffect.update(1560);
  assert.equal(falseEffect.adjustments.size, 0);
});

test('Euler sieve global array if(isprime[i]) keeps its green-frame comparison event', async () => {
  const { trace, context } = await compile(`#include <bits/stdc++.h>
using namespace std;
int n = 4;
vector<int> isprime(n + 5, 1);
vector<int> prime;
void prime_table() {
  for (int i = 2; i <= n; i++) {
    // @frame
    // @object isprime with range(1,n), columns(10), labels(index)
    // @object prime with columns(10), labels(value)
    // @place prime.top-left at isprime.bottom-left offset(0,60)
    // @style isprime[1:n] focus when value == 1
    if (isprime[i]) prime.push_back(i);
    // @frame
    // @object isprime with range(1,n), columns(10), labels(index)
    // @object prime with columns(10), labels(value)
    // @place prime.top-left at isprime.bottom-left offset(0,60)
    // @style isprime[1:n] focus when value == 1
    for (auto& v : prime) {
      // @frame
      // @object isprime with range(1,n), columns(10), labels(index)
      // @object prime with columns(10), labels(value)
      // @place prime.top-left at isprime.bottom-left offset(0,60)
      // @style isprime[i,i*v] highlight
      // @style prime[v] highlight
      // @style isprime[i] point
      if (i*v > n) break;
      isprime[i*v] = 0;
      if (i%v == 0) break;
    }
  }
}
int main() { prime_table(); }
`);
  const events = trace.frames.flatMap(frame => frame.events.map(event => ({ frame, event })));
  const truthy = events.filter(({ event }) => event.type === 'compare'
    && event.comparisonKind === 'truthy');
  assert.ok(truthy.length >= 3, JSON.stringify(events.map(({ frame, event }) => ({
    frame: frame.id, type: event.type, expression: event.expression,
    comparisonKind: event.comparisonKind, targets: event.targets
  }))));
  assert.deepEqual(Array.from(truthy, ({ event }) => event.targets[0].resolvedIndex), [2, 3, 4]);
  assert.ok(truthy.every(({ event }) => Number.isFinite(event.order)));
  assert.ok(truthy.every(({ event }) => Number.isFinite(Number(event.source?.from))
    && Number(event.source?.to) > Number(event.source?.from)),
  JSON.stringify(truthy.map(({ event }) => ({ signature: event.signature, source: event.source }))));
  load(context, 'trace-event-code-tree.js');
  const groups = context.ASMTraceEventCodeTree.collectGroups(trace, truthy[0].frame);
  assert.ok(groups.some(group => group.event.comparisonKind === 'truthy'),
    JSON.stringify(groups.map(group => ({ type: group.type, text: group.event.source?.text }))));
  const window = tweenWindow();
  const { frame, event } = truthy[0];
  const cellKey = `${event.targets[0].variableId}#${event.targets[0].resolvedIndex}`;
  const cell = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  const rect = window.document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  for (const [name, value] of Object.entries({ x: 8, y: 8, width: 40, height: 40 })) {
    rect.setAttribute(name, String(value));
  }
  cell.append(rect);
  window.document.querySelector('#scene').append(cell);
  const placements = new Map([[cellKey, { x: 8, y: 8, width: 40, height: 40 }]]);
  const elements = new Map([[cellKey, cell]]);
  const effect = window.ASMTraceFrameTween.createTruthyCompareEffect(
    event, trace, frame, placements, elements, key => key
  );
  effect.update(880);
  assert.equal(cell.querySelector('.asm-trace-truthy-highlight')?.getAttribute('stroke'),
    'rgb(165, 214, 167)');
  assert.ok(Math.abs(effect.adjustments.get(cellKey)?.scale - 1.14) < 0.001);
  effect.remove();
});
