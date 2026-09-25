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

test('a recursive call event stays paired with its invocation and activation', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int F(int n) {
  // @frame n
  if (n <= 0) return 0;
  return F(n - 1) + F(n - 2);
}
int main() {
  cout << F(2) << '\\n';
}`);
  const rootFrame = trace.frames.find(frame => (
    frame.source?.function === 'F'
    && frame.source?.recursionDepth === 0
  ));
  assert.ok(rootFrame);
  const rootActivation = rootFrame.source.recursionActivationId;
  const rootCalls = trace.callLifecycles.filter(event => (
    event.source?.functionName === 'F'
    && event.callerActivationId === rootActivation
  ));
  assert.equal(rootCalls.length, 2);
  assert.ok(rootCalls[0].returnOrder < rootCalls[1].order,
    'the sibling call probe cannot run before the first recursive invocation finishes');

  const call = rootCalls[0];
  assert.equal(call.callOccurrenceId, call.id);
  assert.equal(call.callerActivationId, rootActivation);
  assert.ok(call.calleeActivationId);
  const entry = trace.frames.flatMap(frame => frame.events).find(event => (
    event.type === 'function-enter'
    && event.callEventId === call.id
  ));
  assert.ok(entry, 'callee entry links back to the exact call occurrence');
  assert.equal(entry.recursionActivationId, call.calleeActivationId);
  const returned = trace.frames.flatMap(frame => frame.events).find(event => (
    event.type === 'call-return'
    && event.callEventId === call.id
  ));
  assert.ok(returned, 'the call lifecycle closes only after the child returns');
  assert.ok(returned.order > entry.order);
  assert.equal(call.returnEventId, returned.id);
  assert.equal(window.ASMTraceEvents.defaultEnabled(returned, trace), false);
  assert.equal(window.ASMTraceEvents.showInspector(returned, trace), false,
    'call-return remains internal lifecycle metadata');

  const legacy = JSON.parse(JSON.stringify(trace));
  legacy.frames.forEach(frame => {
    frame.events = frame.events.filter(event => event.type !== 'call-return');
    frame.events.forEach(event => {
      delete event.invokedByCallEventId;
      delete event.callEventId;
      delete event.callerActivationId;
      delete event.calleeActivationId;
      delete event.callOccurrenceId;
      delete event.returnEventId;
      delete event.returnOrder;
    });
  });
  const restored = window.ASMTraceModel.normalizeTraceDocument(legacy);
  assert.equal(restored.frames.length, trace.frames.length,
    'saved traces without call lifecycle fields still load unchanged');
  assert.ok(restored.callLifecycles.length > 0);
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

test('call invocation wrapper preserves reference return values', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int& first(vector<int>& values) { return values[0]; }
int main() {
  vector<int> values = {1};
  // @frame values
  first(values) = 9;
  // @frame values
}`);
  assert.equal(trace.frames.at(-1).state[Object.keys(trace.frames.at(-1).state)
    .find(id => trace.frames.at(-1).state[id].name === 'values')].data.items[0].value, 9);
});
