const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compile } = require('./helpers/compile');

test('function calls schedule code-only events before callee entry and remain controllable', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
void visit(vector<int>& arr) {
  // @frame arr
}
int main() {
  vector<int> arr = {1, 2};
  // @frame arr
  visit(arr);
  // @frame arr
}`);
  const frame = trace.frames.find(frame => frame.events.some(event => event.type === 'call' && event.callee === 'visit'));
  assert.ok(frame);
  const call = frame.events.find(event => event.type === 'call' && event.callee === 'visit');
  const entry = frame.events.find(event => event.type === 'function-enter' && event.function === 'visit');
  assert.ok(call.order < entry.order);
  assert.match(call.source.text, /visit\(arr\)/);
  assert.equal(window.ASMTraceEvents.defaultEnabled(call, trace), false, 'preserve existing defaults');
  assert.equal(window.ASMTraceEvents.showInspector(call, trace), true);
  frame.events.forEach(event => { event.enabled = event === call; });
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, new Map(), new Map());
  assert.equal(call.autoAnimationDisabled, false, 'no canvas target is required');
  const timeline = () => window.ASMTraceFrameTween.buildEventTimeline(trace, frame, 1, 600, new Map(), new Map(), new Map(), 0, new Map());
  assert.equal(timeline().length, 1);
  assert.equal(timeline()[0].animation, 'code');
  call.enabled = false;
  assert.equal(timeline().length, 0);
});

test('function-call code turns grey without yellow pulse and disabled calls leave no trace', () => {
  const window = { addEventListener() {} };
  window.window = window;
  const context = vm.createContext(window);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'), context);
  const call = { id: 'call', type: 'call', enabled: true };
  const events = new Map([[call.id, call]]);
  const state = (active, completed = new Set()) => window.ASMTraceCodePresenter.visualStateForIds([call.id], events, new Set(), completed, active);
  assert.equal(state('').complete, false);
  assert.equal(state(call.id).active, false);
  assert.equal(state(call.id).complete, true);
  assert.equal(state('', new Set([call.id])).complete, true);
  const comparison = { id: 'compare', type: 'compare', enabled: true, result: true };
  events.set(comparison.id, comparison);
  const shared = window.ASMTraceCodePresenter.visualStateForIds([call.id, comparison.id], events,
    new Set([comparison.id]), new Set([comparison.id]), call.id);
  assert.equal(shared.complete, true, 'active call stays grey even on a shared condition span');
  assert.equal(shared.pending, false);
  assert.equal(shared.conditionResult, undefined);
  call.enabled = false;
  assert.equal(state(call.id, new Set([call.id])).complete, false);
  assert.equal(state(call.id).active, false);
});
