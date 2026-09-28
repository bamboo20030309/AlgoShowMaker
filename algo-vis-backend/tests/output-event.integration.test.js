const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile, load } = require('./helpers/compile');

test('cout and printf emit ordered code-only output events', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;

int twice(int value) {
  return value * 2;
}

int main() {
  int n = 2;
  // @frame n
  cout << "cout=" << twice(n) << '\\n';
  printf("printf=%d\\n", n);
  // @code hide
  cout << "hidden";
  printf("hidden=%d\\n", n);
  // @endcode
  // @frame n
  return 0;
}`;
  const { trace, window, context } = await compile(source);
  const outputFrame = trace.frames.find(frame => (
    frame.events.filter(event => event.type === 'output').length === 2
  ));
  assert.ok(outputFrame);
  const outputs = outputFrame.events.filter(event => event.type === 'output');
  assert.deepEqual(Array.from(outputs, event => event.outputKind), ['cout', 'printf']);
  assert.match(outputs[0].source.text, /cout\s*<</);
  assert.match(outputs[1].source.text, /printf\s*\(/);
  assert.ok(outputs.every(event => event.enabled !== false));
  assert.ok(outputs.every(event => window.ASMTraceEvents.animation(event.type) === 'code'));
  assert.ok(outputs.every(event => window.ASMTraceEvents.showTag(event.type, trace) === false));
  assert.ok(outputs.every(event => window.ASMTraceEvents.showInspector(event, trace) === true));

  const nestedCall = outputFrame.events.find(event => (
    event.type === 'call' && event.callee === 'twice'
  ));
  assert.ok(nestedCall);
  assert.ok(nestedCall.order < outputs[0].order,
    'the output event commits after nested call evaluation finishes');
  assert.equal(outputFrame.events.some(event => (
    event.type === 'call' && /printf/.test(event.callee || '')
  )), false, 'printf is classified as output rather than a normal function call');
  assert.equal(trace.frames.flatMap(frame => frame.events).filter(event => (
    event.type === 'output' && /hidden/.test(event.expression || '')
  )).length, 0, '@code hide suppresses output events while leaving C++ execution intact');

  outputFrame.events.forEach(event => { event.enabled = event.type === 'output'; });
  window.ASMTraceFrameTween.updateEventAvailability(trace, outputFrame, new Map(), new Map());
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, outputFrame, 1, 600, new Map(), new Map(), new Map(), 0, new Map()
  );
  assert.deepEqual(Array.from(timeline, slot => slot.animation), ['code', 'code']);
  assert.ok(timeline[0].end <= timeline[1].start);

  load(context, 'trace-code-model.js');
  const plan = context.ASMTraceCodeModel.planFrame(trace, outputFrame);
  for (const output of outputs) {
    const highlighted = plan.fragments.flatMap(fragment => fragment.items || [])
      .flatMap(item => item.segments || [])
      .filter(segment => segment.eventIds.includes(output.id))
      .map(segment => segment.text).join('');
    assert.equal(highlighted, output.source.text);
  }
});
