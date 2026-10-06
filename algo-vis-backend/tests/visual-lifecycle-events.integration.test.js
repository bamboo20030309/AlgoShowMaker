/**
 * 驗證 manual frame 的顯示集合變化會產生畫面生命週期事件。新 trace 直接
 * 保留第一幀前的宣告；舊 trace 缺少宣告時，仍能在物件第一次顯示時補回。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile, load } = require('./helpers/compile');

test('bottom-up merge declares a fresh visible temp for every merge pass', async () => {
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up.cpp'
  ), 'utf8');
  const input = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up-sample_input.txt'
  ), 'utf8');
  const { trace } = await compile(code, input);
  const temp = Object.values(trace.variables).find(variable => variable.name === 'temp');
  assert.ok(temp);
  const lifecycle = trace.frames.flatMap((frame, frameIndex) => (
    frame.events.filter(event => event.targets?.some(target => (
      target.variableId === temp.id
    ))).map(event => ({ event, frame, frameIndex }))
  ));
  const declarations = lifecycle.filter(item => item.event.type === 'declare');
  const exits = lifecycle.filter(item => item.event.type === 'scope-exit');
  const visualEnters = lifecycle.filter(item => item.event.type === 'visual-enter');

  assert.equal(declarations.length, 3, 'width 1, 2 and 4 each declare their own temp');
  assert.equal(exits.length, 3, 'each merge-pass temp exits with its loop iteration');
  assert.equal(visualEnters.length, 0,
    'the first visible frame is owned by the real declaration, not a synthetic entrance');
  assert.equal(new Set(declarations.map(item => (
    item.event.targets[0].lifetimeIdentity
  ))).size, 3, 'each pass has a distinct C++ lifetime');
  declarations.forEach(({ event, frame }) => {
    assert.ok(frame.state[temp.id], 'temp exists in its declaration frame');
    assert.ok(!(frame.captureOnlyVariableIds || []).includes(temp.id),
      'temp is visible when its declaration animation runs');
    assert.match(event.source?.text || '', /vector\s*<\s*int\s*>\s*temp/);
  });
  assert.ok(trace.frames.every(frame => frame.events.every((event, index, events) => (
    Number.isFinite(event.order)
    && (index === 0 || events[index - 1].order <= event.order)
  ))));
});

test('capture-only visibility changes emit visual enter and exit events', async () => {
  const code = String.raw`
#include <bits/stdc++.h>
using namespace std;

int main() {
  vector<int> num = {4, 1};
  vector<int> temp;
  int step = 0;

  // @frame num
  step++;
  // @frame num, temp
  step++;
  // @frame num
  step++;
  // @frame num, temp
  return 0;
}
`;
  const { trace, window } = await compile(code);
  const temp = Object.values(trace.variables).find(variable => variable.name === 'temp');
  assert.ok(temp);
  assert.equal(trace.frames.length, 4);

  const eventsForTemp = frame => frame.events.filter(event => (
    event.targets?.some(target => target.variableId === temp.id)
  ));
  const declaration = eventsForTemp(trace.frames[0]).find(event => event.type === 'declare');
  const enter = eventsForTemp(trace.frames[1]).find(event => event.type === 'visual-enter');
  const exit = eventsForTemp(trace.frames[2]).find(event => event.type === 'visual-exit');
  const reenter = eventsForTemp(trace.frames[3]).find(event => event.type === 'visual-enter');
  assert.ok(declaration, 'the declaration before the first frame remains attached to frame one');
  assert.ok(enter, 'the first visible entrance emits visual-enter after the real declaration');
  assert.ok(exit, 'hiding the existing temp object emits visual-exit');
  assert.ok(reenter, 'showing the same lifetime again emits visual-enter');
  assert.equal(declaration.automaticVisibility, undefined);
  assert.equal(enter.automaticVisibility, true);
  assert.equal(exit.automaticVisibility, true);
  assert.match(declaration.source?.text || '', /vector\s*<\s*int\s*>\s*temp/,
    'Trace Studio places the real declaration on its original source');
  assert.match(exit.source?.text || '', /@frame\s+num/,
    'Trace Studio can place the exit on its @frame line');
  assert.equal(enter.targets[0].lifetimeIdentity, exit.targets[0].lifetimeIdentity,
    'both events retain the same C++ object lifetime');
  assert.equal(eventsForTemp(trace.frames[2]).some(event => event.type === 'scope-exit'), false,
    'a display exit is not a C++ scope exit');
  const tempKey = trace.frames[1].source.objectIds?.[temp.id] || temp.id;
  const tempElement = {
    dataset: {
      traceVariable: temp.id,
      traceRuntimeLifetime: enter.targets[0].lifetimeIdentity,
      traceSceneGeneration: String(trace.frames[1].sceneGeneration || 0)
    },
    closest() { return null; },
    querySelectorAll() { return []; }
  };
  const placements = new Map([[tempKey, { x: 0, y: 0, width: 80, height: 40 }]]);
  const elements = new Map([[tempKey, tempElement]]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, trace.frames[1], 1, 520, new Map(), placements, elements
  );
  const schedule = window.ASMTraceFrameTween.declarationVisualSchedule(
    trace, trace.frames[1], timeline, placements, elements
  );
  assert.equal(schedule.slotsByKey.get(tempKey)?.event?.type, 'visual-enter',
    'visual-enter owns a later display entrance after the real declaration');
  load(window, 'trace-code-model.js');
  load(window, 'trace-event-code-tree.js');
  const outline = window.ASMTraceEventCodeTree.buildOutline(trace, trace.frames[0]);
  assert.ok(outline.groups.some(group => group.type === 'declare'
    && /vector\s*<\s*int\s*>\s*temp/.test(group.event?.source?.text || '')),
  'Trace Studio exposes the real temp declaration button on the first frame');
  assert.ok(trace.frames.every(frame => frame.events.every(event => Number.isFinite(event.order))));
  assert.ok(trace.frames.every(frame => frame.events.every((event, index, events) => (
    index === 0 || events[index - 1].order <= event.order
  ))));
});

test('visual lifecycle rebuilding is idempotent and preserves an explicit disabled state', async () => {
  const code = String.raw`
#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> shown = {1};
  vector<int> hidden = {2};
  int step = 0;
  // @frame shown
  step++;
  // @frame shown, hidden
  return 0;
}
`;
  const { trace, window } = await compile(code);
  const enter = trace.frames[1].events.find(event => event.type === 'visual-enter'
    && event.automaticVisibility === true);
  assert.ok(enter);
  const oldSavedTrace = JSON.parse(JSON.stringify(trace));
  delete oldSavedTrace.sourceDeclarations;
  oldSavedTrace.frames.forEach(frame => {
    frame.events = frame.events.filter(event => event.automaticVisibility !== true
      && !(event.type === 'declare' && event.name === 'hidden'));
  });
  const normalizedOldTrace = window.ASMTraceModel.normalizeTraceDocument(oldSavedTrace);
  const oldDeclaration = normalizedOldTrace.frames[1].events.find(event => (
    event.type === 'declare' && event.automaticVisibility === true
  ));
  assert.match(oldDeclaration?.source?.text || '', /vector\s*<\s*int\s*>\s*hidden/,
    'an old trace without sourceDeclarations recovers the declaration from its source line');
  trace.studio.eventInstructionStates ||= {};
  trace.studio.eventInstructionStates[window.ASMTraceEvents.instructionKey(enter)] = false;
  trace.frames.forEach(frame => {
    frame.events = frame.events.filter(event => event.automaticVisibility !== true);
  });
  const savedOldTrace = JSON.parse(JSON.stringify(trace));
  const rebuilt = window.ASMTraceModel.normalizeTraceDocument(savedOldTrace);
  const rebuiltEnters = rebuilt.frames[1].events.filter(event => event.type === 'visual-enter'
    && event.automaticVisibility === true);
  assert.equal(rebuiltEnters.length, 1, 'normalization does not duplicate the derived event');
  assert.equal(rebuiltEnters[0].enabled, false, 'an explicit saved switch remains disabled');
  const reopened = window.ASMTraceModel.normalizeTraceDocument(
    JSON.parse(JSON.stringify(rebuilt))
  );
  assert.equal(reopened.frames[1].events.filter(event => event.type === 'visual-enter'
    && event.automaticVisibility === true).length, 1,
    'saving and reopening does not duplicate the derived event');
  assert.equal(reopened.frames[1].events.find(event => event.type === 'visual-enter'
    && event.automaticVisibility === true).enabled, false,
    'saving and reopening preserves the explicit disabled setting');
});
