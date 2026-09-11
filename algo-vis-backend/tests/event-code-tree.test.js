const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { instrumentSource } = require('../trace-instrumenter');

const publicDir = path.join(__dirname, '../public');
function load(context, name) {
  vm.runInContext(fs.readFileSync(path.join(publicDir, name), 'utf8'), context);
}

test('Trace Studio event code keeps source structure and resolves overlapping buttons by smallest range', () => {
  const source = `#include <bits/stdc++.h>
using namespace std;

int main() {
  int n = 3;
  for (int i = 0; i < n; i++) {
    if (i > 0) {
      i--;
    }
  }
}`;
  const instrumented = instrumentSource(source);
  const sourceEntry = (type, text) => {
    const compact = value => String(value || '').replace(/\s+/g, '');
    const entry = Object.entries(instrumented.eventSources).find(([key, value]) => (
      key.startsWith(`${type}:main:`) && compact(value.text) === compact(text)
    ));
    assert.ok(entry, `missing ${type} ${text}`);
    return entry;
  };
  const makeEvent = (type, text, id, order) => {
    const [signature, eventSource] = sourceEntry(type, text);
    return { id, order, type, signature, source: eventSource, enabled: true };
  };
  const events = [
    makeEvent('function-enter', 'int main() {', 'event-0', 0),
    makeEvent('declare', 'int i', 'event-1', 1),
    makeEvent('assign', 'i = 0', 'event-2', 2),
    makeEvent('compare', 'i < n', 'event-3', 3),
    makeEvent('write', 'i--', 'event-4', 4)
  ];
  const trace = {
    sourceCode: source,
    sourceStructure: instrumented.sourceStructure,
    frames: [{ id: 'frame-0', events }],
    studio: { eventInstructionStates: {}, eventSettings: { defaultEnabled: {}, timelineTypes: {} } }
  };
  const context = vm.createContext({ console, WeakSet, Map, Set });
  context.window = context;
  load(context, 'trace-events.js');
  load(context, 'trace-code-model.js');
  load(context, 'trace-event-code-tree.js');
  const plan = context.ASMTraceEventCodeTree.build(trace, trace.frames[0]);

  const visible = plan.items.filter(item => item.kind === 'line');
  assert.equal(new Set(visible.map(line => line.number)).size, visible.length,
    'runtime repetitions must not duplicate source lines');
  assert.ok(visible.some(line => line.text.includes('for (int i = 0; i < n; i++)')));
  assert.ok(visible.some(line => line.text.includes('if (i > 0)')));
  assert.ok(visible.some(line => line.text.trim() === '}'), 'control closing braces stay visible');
  assert.ok(!visible.some(line => /#include|using namespace/.test(line.text)));

  const overlapOffset = source.indexOf('int i = 0') + 'int '.length;
  const overlap = visible.flatMap(line => line.segments)
    .find(segment => segment.from === overlapOffset && segment.to === overlapOffset + 1);
  assert.ok(overlap, 'the shared i range should be an independent atomic segment');
  assert.equal(overlap.groups.length, 2, 'declaration and initializer overlap on i');
  assert.equal(overlap.primary.type, 'assign', 'the smaller i = 0 assignment wins overlapping clicks');

  const outline = context.ASMTraceEventCodeTree.buildOutline(trace, trace.frames[0]);
  const flatten = (items, result = []) => {
    items.forEach(item => {
      result.push(item);
      if (item.kind === 'context') flatten(item.children, result);
    });
    return result;
  };
  const outlined = flatten(outline.items);
  const functionContext = outlined.find(item => item.kind === 'context'
    && item.type === 'FunctionDefinition');
  const forContext = outlined.find(item => item.kind === 'context'
    && item.type === 'ForStatement');
  const ifContext = outlined.find(item => item.kind === 'context'
    && item.type === 'IfStatement');
  assert.ok(functionContext?.label.includes('main()'), 'the outline starts from the source function');
  assert.equal(functionContext?.headerGroup?.type, 'function-enter',
    'the function declaration itself owns the function-entry event button');
  assert.equal(functionContext.children.some(item => item.group?.type === 'function-enter'), false,
    'function entry is not duplicated as a second event row below the header');
  assert.ok(forContext?.label.includes('for (int i = 0; i < n; i++)'), 'for header remains one structural label');
  assert.ok(ifContext?.label.includes('if (i > 0)'), 'nested conditions remain structural labels');
  assert.ok(functionContext.children.includes(forContext), 'the for loop is nested under its function');
  assert.ok(forContext.children.includes(ifContext), 'the if statement is nested under its for loop');

  const forEvents = forContext.children.filter(item => item.kind === 'event');
  assert.deepEqual(
    Array.from(forEvents.slice(0, 3), item => item.group.type),
    ['declare', 'assign', 'compare'],
    'a declaration initializer becomes separate, ordered event rows'
  );
  assert.deepEqual(
    Array.from(forEvents.slice(0, 3), item => item.group.event.source.text),
    ['int i', 'i = 0', 'i < n']
  );

  const repeated = events[4];
  const missingOccurrence = {
    ...repeated,
    id: 'event-5',
    autoAnimationDisabled: true,
    autoAnimationUnavailableReason: 'missing-target'
  };
  const availableOccurrence = {
    ...repeated,
    id: 'event-6',
    autoAnimationDisabled: false
  };
  const repeatedFrame = { id: 'frame-repeated', events: [availableOccurrence, missingOccurrence] };
  const repeatedTrace = { ...trace, frames: [repeatedFrame] };
  let repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.availability, 'missing-target',
    'one available occurrence must not hide another occurrence with a missing object');
  assert.equal(repeatedGroup.enabled, false,
    'a current yellow group defaults off even when another occurrence is available');

  repeatedTrace.studio.eventInstructionStates[repeated.signature] = true;
  context.ASMTraceEvents.applyEnabledStates(repeatedTrace);
  repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.enabled, true,
    'an explicitly saved on state remains controllable for a yellow group');

  missingOccurrence.autoAnimationUnavailableReason = 'unrenderable';
  delete repeatedTrace.studio.eventInstructionStates[repeated.signature];
  context.ASMTraceEvents.applyEnabledStates(repeatedTrace);
  repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.availability, 'unrenderable');
  assert.equal(repeatedGroup.enabled, false,
    'a current red group also defaults off');
});

test('missing-target and unrenderable event buttons show diagnostic colors only while on', () => {
  const css = fs.readFileSync(path.join(publicDir, 'trace-studio.css'), 'utf8');
  assert.match(css, /\.trace-studio-event-code-button\.is-enabled\.is-missing-target\s*\{/);
  assert.match(css, /\.trace-studio-event-code-button\.is-enabled\.is-unrenderable\s*\{/);
  assert.doesNotMatch(css, /\.trace-studio-event-code-button\.is-missing-target\s*\{/);
  assert.doesNotMatch(css, /\.trace-studio-event-code-button\.is-unrenderable\s*\{/);
});
