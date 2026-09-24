const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('return brackets recursive evaluation and exits after its activation scope', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int F(int n) {
  // @frame n
  if (n <= 0) return 1;
  return F(n - 1);
}
int main() {
  int value = F(1);
  // @frame value
  cout << value << '\\n';
  return 0;
}`);
  const events = trace.frames.flatMap(frame => frame.events);
  const started = events.find(event => event.type === 'return' && event.expression === 'F(n - 1)');
  assert.ok(started);
  const call = events.find(event => event.type === 'call'
    && event.recursionActivationId === started.recursionActivationId
    && event.expression === 'F(n - 1)');
  const callReturned = events.find(event => event.type === 'call-return' && event.callEventId === call?.id);
  const completed = events.find(event => event.type === 'return-complete'
    && event.returnEventId === started.id);
  const scopeExit = events.find(event => event.type === 'scope-exit'
    && event.recursionActivationId === started.recursionActivationId
    && event.order > completed?.order);
  const functionExit = events.find(event => event.type === 'function-exit'
    && event.returnEventId === started.id);
  assert.ok(call && callReturned && completed && scopeExit && functionExit);
  assert.ok(started.order < call.order);
  assert.ok(callReturned.order < completed.order);
  assert.ok(completed.order < scopeExit.order);
  assert.ok(scopeExit.order < functionExit.order);
  assert.equal(completed.payload.value.value, 1);
  assert.equal(completed.recursionActivationId, started.recursionActivationId);
  assert.equal(functionExit.recursionActivationId, started.recursionActivationId);
  assert.equal(window.ASMTraceEvents.defaultEnabled(started, trace), true);
  assert.equal(window.ASMTraceEvents.showInspector(started, trace), true);
  assert.equal(window.ASMTraceEvents.defaultEnabled(completed, trace), false);
  assert.equal(window.ASMTraceEvents.showInspector(completed, trace), false);

  const frame = trace.frames.find(candidate => candidate.events.includes(started));
  frame.events.forEach(event => { event.enabled = event === started; });
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, new Map(), new Map());
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 600, new Map(), new Map(), new Map(), 0, new Map()
  );
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].animation, 'code');
  assert.equal(timeline[0].duration, 260);
  trace.studio.eventSettings ||= {};
  trace.studio.eventSettings.defaultEnabled = { return: false };
  window.ASMTraceEvents.applyEnabledStates(trace);
  assert.equal(started.enabled, false, 'an explicitly disabled saved return setting remains off');
});

test('return instrumentation preserves one evaluation, references, and void returns', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int counter = 0;
int& choose(int& value) {
  counter++;
  return value;
}
void stop() {
  counter++;
  return;
}
int main() {
  int value = 1;
  choose(value) = 9;
  stop();
  // @frame value, counter
  cout << value << ' ' << counter << '\\n';
  return 0;
}`);
  const frame = trace.frames.at(-1);
  const states = Object.values(frame.state);
  assert.equal(states.find(state => state.name === 'value').data.value, 9,
    'a reference returned through the wrapper remains assignable');
  assert.equal(states.find(state => state.name === 'counter').data.value, 2,
    'each return expression and function body executes exactly once');
  const events = trace.frames.flatMap(item => item.events);
  const referenceReturn = events.find(event => event.type === 'return-complete'
    && event.function === 'choose');
  const voidReturn = events.find(event => event.type === 'return-complete'
    && event.function === 'stop');
  assert.equal(referenceReturn.payload.value.value, 1);
  assert.equal(voidReturn.payload.kind, 'void');
});

test('return instrumentation preserves implicit moves and braced initializers', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
unique_ptr<int> make_pointer() {
  auto pointer = make_unique<int>(7);
  return pointer;
}
unique_ptr<int> move_pointer(unique_ptr<int> pointer) {
  return std::move(pointer);
}
vector<int> make_values() {
  return {1, 2};
}
int main() {
  auto pointer = move_pointer(make_pointer());
  auto values = make_values();
  int marker = *pointer + values[1];
  // @frame marker
  return 0;
}`);
  const marker = Object.values(trace.frames.at(-1).state)
    .find(state => state.name === 'marker');
  assert.equal(marker.data.value, 9);
});
