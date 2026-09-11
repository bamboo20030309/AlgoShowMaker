const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('enabled function entry schedules a code-only header highlight without canvas targets', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;

void visit(vector<int>& arr, int i) {
  // @frame arr[i]
}

int main() {
  vector<int> arr = {1, 2};
  visit(arr, 1);
}`);
  const frame = trace.frames.find(item => (
    item.events || []
  ).some(event => event.type === 'function-enter' && event.function === 'visit'));
  assert.ok(frame, 'visit frame');
  const entry = frame.events.find(event => event.type === 'function-enter' && event.function === 'visit');
  assert.match(entry.source.text, /^void visit\(/);

  const parameters = frame.events.filter(event => (
    event.type === 'declare'
    && event.source?.functionName === 'visit'
  ));
  assert.deepEqual(Array.from(parameters, event => `declare:${event.source.text}`), [
    'declare:vector<int>& arr',
    'declare:int i'
  ]);
  assert.equal(parameters[0].payload.value.kind, 'sequence');
  assert.equal(parameters[1].payload.value.kind, 'scalar');
  assert.equal(parameters[1].payload.value.value, 1);
  assert.ok(parameters.every(event => event.parameterDeclaration === true));
  assert.equal(frame.events.some(event => event.parameterInitializer === true), false,
    'function parameters never invent a second initialized-assignment event');
  assert.ok(parameters.every(event => event.enabled !== false),
    'parameter declaration controls default on');

  frame.events.forEach(event => { event.enabled = event === entry; });
  const placements = new Map();
  const elements = new Map();
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assert.equal(entry.autoAnimationDisabled, false);

  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 600, new Map(), placements, elements, 0, new Map()
  );
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].event, entry);
  assert.equal(timeline[0].animation, 'code');
  assert.equal(timeline[0].duration, 400);
});
