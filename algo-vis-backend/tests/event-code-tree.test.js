/**
 * 測試模組：event-code-tree.test
 *
 * 驗證重點：event code tree.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
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

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
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
    return { id, order, type, signature, source: eventSource, enabled: true,
      declarationInitializer: eventSource.declarationInitializer === true };
  };
  const events = [
    makeEvent('function-enter', 'int main() {', 'event-0', 0),
    makeEvent('declare', 'int i = 0', 'event-1', 1),
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
    .find(segment => segment.from === overlapOffset && segment.text === 'i = 0');
  assert.ok(overlap, 'the initialized declarator should be an independent atomic segment');
  assert.equal(overlap.groups.length, 1, 'the initializer is folded into its declaration row');
  assert.equal(overlap.primary.type, 'declare', 'the declaration owns the combined source range');

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
    Array.from(forEvents.slice(0, 2), item => item.group.type),
    ['declare', 'compare'],
    'a declaration initializer is presented as one declaration row'
  );
  assert.deepEqual(
    Array.from(forEvents.slice(0, 2), item => item.group.event.source.text),
    ['int i = 0', 'i < n']
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
  assert.equal(repeatedGroup.availability, 'available',
    'one frame containing the affected object makes a normal instruction green');
  assert.equal(repeatedGroup.enabled, true,
    'instruction enablement stays separate from per-frame availability');

  repeatedTrace.studio.eventInstructionStates[repeated.signature] = true;
  context.ASMTraceEvents.applyEnabledStates(repeatedTrace);
  repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.enabled, true,
    'an explicitly saved on state remains controllable for a yellow group');

  missingOccurrence.autoAnimationUnavailableReason = 'unrenderable';
  delete repeatedTrace.studio.eventInstructionStates[repeated.signature];
  context.ASMTraceEvents.applyEnabledStates(repeatedTrace);
  repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.availability, 'available',
    'another frame with the same visible object keeps the instruction green');
  assert.equal(repeatedGroup.enabled, true,
    'availability does not overwrite the instruction-wide switch');

  availableOccurrence.autoAnimationDisabled = true;
  availableOccurrence.autoAnimationUnavailableReason = 'unrenderable';
  repeatedGroup = context.ASMTraceEventCodeTree.collectGroups(repeatedTrace, repeatedFrame)[0];
  assert.equal(repeatedGroup.availability, 'unrenderable',
    'an instruction remains red when no occurrence has a supported animation');
});

test('only enabled event buttons show availability colors in every frame', () => {
  const css = fs.readFileSync(path.join(publicDir, 'trace-studio.css'), 'utf8');
  assert.match(css, /\.trace-studio-event-code-button\.is-enabled\.is-available\s*\{/);
  assert.match(css, /\.trace-studio-event-code-button\.is-enabled\.is-missing-target\s*\{/);
  assert.match(css, /\.trace-studio-event-code-button\.is-enabled\.is-unrenderable\s*\{/);
  assert.match(css, /\.trace-studio-event-code-button:not\(\.is-enabled\)\s*\{[^}]*background:\s*#171c21/s);
  assert.doesNotMatch(css, /\.trace-studio-event-code-button\.is-current\.is-available\s*\{/);
});

test('comma-separated declarators keep separate declaration rows with shared type highlighting', () => {
  const source = `int main(){
  int n=5, m=6, t;
}`;
  const instrumented = instrumentSource(source);
  const declarations = Object.entries(instrumented.eventSources)
    .filter(([signature]) => signature.startsWith('declare:main:'))
    .sort(([, left], [, right]) => left.declaratorIndex - right.declaratorIndex);
  assert.deepEqual(declarations.map(([, item]) => item.text), [
    'int n=5', 'int … m=6', 'int … t'
  ]);
  assert.equal(new Set(declarations.map(([, item]) => item.declaratorId)).size, 3);
  declarations.forEach(([, item], index) => {
    assert.equal(item.declaratorIndex, index);
    assert.equal(item.declaratorCount, 3);
    assert.deepEqual(item.ranges.map(range => range.role), ['type', 'declarator']);
  });

  const events = declarations.map(([signature, eventSource], index) => ({
    id: `declare-${index}`, order: index, type: 'declare', signature,
    source: eventSource, enabled: true
  }));
  const trace = {
    sourceCode: source,
    sourceStructure: instrumented.sourceStructure,
    frames: [{ id: 'frame', events }],
    studio: { eventInstructionStates: {}, eventSettings: { defaultEnabled: {}, timelineTypes: {} } }
  };
  const context = vm.createContext({ console, WeakSet, Map, Set });
  context.window = context;
  load(context, 'trace-events.js');
  load(context, 'trace-code-model.js');
  load(context, 'trace-event-code-tree.js');
  const line = context.ASMTraceEventCodeTree.build(trace, trace.frames[0]).items
    .find(item => item.kind === 'line' && item.text.includes('int n=5'));
  const idsFor = text => line.segments.find(segment => segment.text.trim() === text)
    ?.groups.map(group => group.event.id) || [];
  assert.deepEqual(Array.from(idsFor('int')), ['declare-0', 'declare-1', 'declare-2']);
  assert.deepEqual(Array.from(idsFor('n=5')), ['declare-0']);
  assert.deepEqual(Array.from(idsFor('m=6')), ['declare-1']);
  assert.deepEqual(Array.from(idsFor('t')), ['declare-2']);
});

test('comparison stays yellow when any compared variable is absent from a frame', () => {
  const source = 'int main(){ int a=1,b=2; if(a<b){} }';
  const instrumented = instrumentSource(source);
  const eventSource = Object.values(instrumented.eventSources)
    .find(entry => entry.text.replace(/\s+/g, '') === 'a<b');
  assert.ok(eventSource);
  const compare = {
    id: 'compare-0', order: 0, type: 'compare', signature: 'compare:main:1:a<b',
    source: eventSource, enabled: true,
    targets: [{ variableId: 'a' }, { variableId: 'b' }]
  };
  const frame = { id: 'frame-0', events: [compare], state: { a: { data: 1 } } };
  const trace = {
    sourceCode: source,
    sourceStructure: instrumented.sourceStructure,
    frames: [frame],
    studio: { eventInstructionStates: {}, eventSettings: { defaultEnabled: {}, timelineTypes: {} } }
  };
  const context = vm.createContext({ console, WeakSet, Map, Set });
  context.window = context;
  load(context, 'trace-events.js');
  load(context, 'trace-code-model.js');
  load(context, 'trace-event-code-tree.js');
  const group = context.ASMTraceEventCodeTree.collectGroups(trace, frame)[0];
  assert.equal(group.availability, 'missing-target');
  assert.equal(group.enabled, false,
    'an unavailable event is visually closed until the user explicitly enables it');
  trace.studio.eventInstructionStates[context.ASMTraceEvents.instructionKey(compare)] = true;
  const explicitlyEnabled = context.ASMTraceEventCodeTree.collectGroups(trace, frame)[0];
  assert.equal(explicitlyEnabled.enabled, true,
    'an explicitly enabled unavailable instruction can show its yellow status');
});

test('a declaration is available when its object appears in a later frame', () => {
  const context = vm.createContext({ console, WeakSet, Map, Set });
  context.window = context;
  load(context, 'trace-events.js');
  load(context, 'trace-code-model.js');
  load(context, 'trace-event-code-tree.js');
  const declaration = {
    id: 'declare-temp', order: 0, type: 'declare', signature: 'declare:mergesort:temp',
    source: { from: 0, to: 9, text: 'int temp' }, enabled: true,
    targets: [{ role: 'target', variableId: 'temp', expression: 'temp' }]
  };
  const first = {
    id: 'first', events: [declaration], state: { temp: { data: { kind: 'sequence', items: [] } } },
    captureOnlyVariableIds: ['temp'], bindings: []
  };
  const later = {
    id: 'later', events: [], state: { temp: { data: { kind: 'sequence', items: [] } } },
    captureOnlyVariableIds: [], bindings: []
  };
  const trace = {
    sourceCode: 'int temp;', frames: [first, later],
    studio: { eventInstructionStates: {}, eventSettings: { defaultEnabled: {}, timelineTypes: {} } }
  };
  const group = context.ASMTraceEventCodeTree.collectGroups(trace, first)[0];
  assert.equal(group.availability, 'available');
  assert.equal(group.enabled, true);

  later.captureOnlyVariableIds = ['temp'];
  const hidden = context.ASMTraceEventCodeTree.collectGroups(trace, first)[0];
  assert.equal(hidden.availability, 'missing-target');
  assert.equal(hidden.enabled, false);
});

test('Studio preflights the selected frame before building its event inspector', () => {
  const studio = fs.readFileSync(path.join(publicDir, 'trace-studio.js'), 'utf8');
  const openBody = studio.match(/function open\(source\) \{[\s\S]*?function installDragHook/)?.[0] || '';
  const currentIndexAt = openBody.indexOf('currentIndex = Math.max');
  const preflightAt = openBody.indexOf('preflightEventAvailability');
  const buildUiAt = openBody.indexOf('buildUi()');
  assert.ok(currentIndexAt >= 0 && currentIndexAt < preflightAt && preflightAt < buildUiAt,
    'the first inspector render must use the same preflight state as later frame changes');
  assert.doesNotMatch(studio, /trace-studio-event-toggle-state/,
    'instruction state is communicated by button color without an extra text badge');
});
