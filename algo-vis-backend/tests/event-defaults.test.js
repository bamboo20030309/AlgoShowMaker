/**
 * 測試模組：event-defaults.test
 *
 * 驗證重點：event defaults.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function eventApi() {
  const context = vm.createContext({ window: {
    ASMTraceRules: { resolveExpression() { return null; } }
  } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-events.js'), 'utf8'), context);
  return context.window.ASMTraceEvents;
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('initial event animation and timeline defaults match the Event Settings panel', () => {
  const api = eventApi();
  const enabled = new Set([
    'declare', 'object-exit', 'assignment', 'sequence-operation', 'compare', 'swap'
  ]);
  const animationEnabled = new Set([...enabled, 'output', 'control-flow']);
  const document = { studio: { eventSettings: { defaultEnabled: {}, timelineTypes: {} } } };
  api.definitions.forEach(definition => {
    assert.equal(api.defaultEnabled({ type: definition.type }, document),
      definition.type === 'fixed' || animationEnabled.has(definition.type),
      `${definition.type} animation default`);
    assert.equal(api.showTag(definition.type, document), enabled.has(definition.type),
      `${definition.type} timeline default`);
  });
  assert.equal(api.animation('declare'), 'declare',
    'an enabled declaration is the formal object-entrance animation');
  document.studio.eventSettings.defaultEnabled.output = false;
  assert.equal(api.defaultEnabled({ type: 'output' }, document), false,
    'an explicitly disabled saved output setting remains disabled');
});

test('return, break and continue share one control-flow setting', () => {
  const api = eventApi();
  const visibleTypes = api.definitions.filter(definition => definition.internal !== true)
    .map(definition => definition.type);
  assert.equal(visibleTypes.includes('control-flow'), true);
  assert.equal(visibleTypes.includes('return'), false);
  assert.equal(visibleTypes.includes('break'), false);
  assert.equal(visibleTypes.includes('continue'), false);
  for (const type of ['return', 'break', 'continue']) {
    assert.equal(api.definition(type).type, 'control-flow');
    assert.equal(api.definition(type).label, '流程跳轉');
    assert.equal(api.labels[type], '流程跳轉');
    assert.equal(api.animation(type), 'code');
  }

  const document = {
    studio: {
      eventSettings: {
        defaultEnabled: { return: false },
        timelineTypes: { break: true }
      },
      eventStates: {},
      eventInstructionStates: {}
    },
    frames: [{ id: 'frame-1', events: [
      { id: 'return-1', type: 'return', signature: 'return:main:1:0' },
      { id: 'break-1', type: 'break', signature: 'break:main:2:break' },
      { id: 'continue-1', type: 'continue', signature: 'continue:main:3:continue' }
    ] }]
  };
  api.applyEnabledStates(document);
  assert.equal(document.studio.eventSettings.defaultEnabled['control-flow'], false);
  assert.equal(document.studio.eventSettings.timelineTypes['control-flow'], true);
  assert.equal(Object.hasOwn(document.studio.eventSettings.defaultEnabled, 'return'), false);
  assert.ok(document.frames[0].events.every(event => event.enabled === false));
  assert.equal(api.showTag('return', document), true);
  assert.equal(api.showTag('break', document), true);
  assert.equal(api.showTag('continue', document), true);
});

test('assign and write share one setting while retaining distinct event names', () => {
  const api = eventApi();
  const visibleTypes = api.definitions.filter(definition => definition.internal !== true)
    .map(definition => definition.type);
  assert.equal(visibleTypes.includes('assignment'), true);
  assert.equal(visibleTypes.includes('assign'), false);
  assert.equal(visibleTypes.includes('write'), false);
  for (const type of ['assign', 'write']) {
    assert.equal(api.definition(type).type, 'assignment');
    assert.equal(api.definition(type).label, '賦值');
    assert.equal(api.animation(type), 'assign');
  }
  assert.equal(api.labels.assign, '直接／初始化賦值');
  assert.equal(api.labels.write, '數值更新／複合賦值');

  const document = {
    studio: {
      eventSettings: {
        defaultEnabled: { assign: false },
        timelineTypes: { write: true }
      },
      eventStates: {},
      eventInstructionStates: {}
    },
    frames: [{ id: 'frame-1', events: [
      { id: 'assign-1', type: 'assign', signature: 'assign:main:1:value' },
      { id: 'write-1', type: 'write', signature: 'write:main:2:value++' }
    ] }]
  };
  api.applyEnabledStates(document);
  assert.equal(document.studio.eventSettings.defaultEnabled.assignment, false);
  assert.equal(document.studio.eventSettings.timelineTypes.assignment, true);
  assert.equal(Object.hasOwn(document.studio.eventSettings.defaultEnabled, 'assign'), false);
  assert.ok(document.frames[0].events.every(event => event.enabled === false));
  assert.equal(api.showTag('assign', document), true);
  assert.equal(api.showTag('write', document), true);
});

test('scope and manual exits share one setting while retaining distinct event names', () => {
  const api = eventApi();
  const visibleTypes = api.definitions.filter(definition => definition.internal !== true)
    .map(definition => definition.type);
  assert.equal(visibleTypes.includes('object-exit'), true);
  assert.equal(visibleTypes.includes('scope-exit'), false);
  assert.equal(visibleTypes.includes('visual-exit'), false);
  for (const type of ['scope-exit', 'visual-exit']) {
    assert.equal(api.definition(type).type, 'object-exit');
    assert.equal(api.definition(type).label, '物件退場／手動退場');
    assert.equal(api.animation(type), 'exit');
  }
  assert.equal(api.labels['scope-exit'], '作用域結束／物件退場');
  assert.equal(api.labels['visual-exit'], '手動物件退場');

  const document = {
    studio: {
      eventSettings: {
        defaultEnabled: { 'scope-exit': false },
        timelineTypes: { 'visual-exit': true }
      },
      eventStates: {},
      eventInstructionStates: {}
    },
    frames: [{ id: 'frame-1', events: [
      { id: 'scope-exit-1', type: 'scope-exit', signature: 'scope-exit:main:1:value' },
      { id: 'visual-exit-1', type: 'visual-exit', signature: 'visual-exit:main:2:value' }
    ] }]
  };
  api.applyEnabledStates(document);
  assert.equal(document.studio.eventSettings.defaultEnabled['object-exit'], false);
  assert.equal(document.studio.eventSettings.timelineTypes['object-exit'], true);
  assert.equal(Object.hasOwn(document.studio.eventSettings.defaultEnabled, 'scope-exit'), false);
  assert.ok(document.frames[0].events.every(event => event.enabled === false));
  assert.equal(api.showTag('scope-exit', document), true);
  assert.equal(api.showTag('visual-exit', document), true);
});

test('timeline labels exclude events that are disabled or cannot be shown', () => {
  const api = eventApi();
  const document = { studio: { eventSettings: { timelineTypes: { assignment: true } } } };
  assert.equal(api.showTimelineEvent({ type: 'assign', enabled: true }, document), true);
  assert.equal(api.showTimelineEvent({ type: 'assign', enabled: false }, document), false,
    'events hidden by the user do not retain timeline labels');
  assert.equal(api.showTimelineEvent({
    type: 'assign', enabled: true, autoAnimationDisabled: true
  }, document), false, 'events hidden because their animation target is unavailable do not retain labels');
  assert.equal(api.showTimelineEvent({ type: 'read', enabled: true }, document), false,
    'the event-type timeline setting still applies');
});

test('internal conditions never expose saved animation or timeline controls', () => {
  const api = eventApi();
  const document = { studio: { eventSettings: {
    autoFixedEnabled: false,
    defaultEnabled: { condition: true },
    timelineTypes: { condition: true }
  }, eventStates: { 'frame-1': { 'condition:main:1:i < n::0': true } },
  eventInstructionStates: { 'condition:main:1:i < n': true } }, frames: [] };
  assert.equal(api.defaultEnabled({ type: 'condition' }, document), false);
  assert.equal(api.showTag('condition', document), false);
  assert.equal(api.showInspector({ type: 'condition' }, document), false);
  assert.equal(api.animation('condition'), 'none');
  api.applyEnabledStates(document);
  assert.equal(Object.hasOwn(document.studio.eventSettings.defaultEnabled, 'condition'), false);
  assert.equal(Object.hasOwn(document.studio.eventSettings.timelineTypes, 'condition'), false);
  assert.deepEqual(Object.keys(document.studio.eventInstructionStates), []);
  assert.deepEqual(Object.keys(document.studio.eventStates['frame-1']), []);
  assert.equal(api.defaultEnabled({ type: 'fixed' }, document), false);
  assert.equal(api.showTag('fixed', document), false);
});

test('terminal for updates become optional loop-boundary events that default off', () => {
  const api = eventApi();
  const loop = {
    type: 'ForStatement', functionName: 'main', from: 20, to: 80,
    headerFrom: 20, headerTo: 48, conditionFrom: 34, conditionTo: 39
  };
  const source = (from, to, text) => ({ from, to, text, contexts: [loop] });
  const normalIncrement = {
    id: 'event-3', type: 'write', order: 3, update: true,
    signature: 'write:main:3:j++', source: source(41, 44, 'j++')
  };
  const trueCondition = {
    id: 'event-4', type: 'condition', order: 4, conditionKind: 'ForStatement', result: true,
    signature: 'condition:main:2:j < 2', source: source(34, 39, 'j < 2')
  };
  const terminalIncrement = {
    id: 'event-8', type: 'write', order: 8, update: true,
    signature: 'write:main:3:j++', source: source(41, 44, 'j++')
  };
  const terminalRead = {
    id: 'event-8-read', type: 'read', order: 8.5,
    signature: 'read:main:2:j', source: source(34, 35, 'j')
  };
  const terminalCompare = {
    id: 'event-8-compare', type: 'compare', order: 8.75,
    signature: 'compare:main:2:j < 2', source: source(34, 39, 'j < 2')
  };
  const falseCondition = {
    id: 'event-9', type: 'condition', order: 9, conditionKind: 'ForStatement', result: false,
    signature: 'condition:main:2:j < 2', source: source(34, 39, 'j < 2')
  };
  const document = {
    studio: { eventSettings: { defaultEnabled: {}, timelineTypes: {} }, eventStates: {}, eventInstructionStates: {} },
    frames: [{ id: 'frame-1', events: [normalIncrement, trueCondition] },
      { id: 'frame-2', events: [terminalIncrement, terminalRead, terminalCompare, falseCondition] }]
  };

  api.applyEnabledStates(document);
  assert.equal(normalIncrement.loopBoundary, undefined);
  assert.equal(normalIncrement.enabled, true);
  assert.equal(terminalIncrement.loopBoundary, true);
  assert.equal(terminalIncrement.enabled, false);
  assert.equal(terminalIncrement.loopBoundarySuppressed, true);
  assert.equal(falseCondition.loopBoundaryCondition, true);
  assert.equal(falseCondition.loopBoundarySuppressed, true,
    'the terminal false condition is omitted with the disabled boundary');
  assert.equal(terminalRead.loopBoundarySuppressed, true);
  assert.equal(terminalCompare.loopBoundarySuppressed, true);
  assert.equal(api.showInspector(terminalIncrement, document), false);

  document.studio.eventSettings.autoLoopBoundaryEnabled = true;
  api.applyEnabledStates(document);
  assert.equal(terminalIncrement.enabled, true);
  assert.equal(terminalIncrement.loopBoundarySuppressed, false);
  assert.equal(falseCondition.loopBoundarySuppressed, false);
  assert.equal(terminalRead.loopBoundarySuppressed, false);
  assert.equal(terminalCompare.loopBoundarySuppressed, false);
  assert.equal(api.showInspector(terminalIncrement, document), true);
});

test('the Studio inspector keeps for controls when their broad timeline types are hidden', () => {
  const api = eventApi();
  const document = { studio: { eventSettings: {
    timelineTypes: { declare: false, assign: false, compare: false, condition: false, read: false }
  } } };
  const forContext = [{ type: 'ForStatement', headerFrom: 10, headerTo: 40 }];
  for (const type of ['declare', 'assign', 'compare']) {
    assert.equal(api.showInspector({ type, source: { from: 12, to: 20, contexts: forContext } }, document), true,
      `${type} for-header inspector visibility`);
  }
  assert.equal(api.showInspector({ type: 'condition', source: { from: 12, to: 20, contexts: forContext } }, document), false,
    'whole conditions remain internal even inside a for header');
  assert.equal(api.showInspector({ type: 'read', source: { from: 12, to: 20, contexts: forContext } }, document), false);
  assert.equal(api.showInspector({ type: 'condition', source: { from: 50, to: 60, contexts: [] } }, document), false);
  assert.equal(api.showInspector({ type: 'fixed' }, document), false);
  assert.equal(api.showTag('function-enter', document), false,
    'function entry stays out of the compact bottom timeline by default');
  assert.equal(api.showInspector({ type: 'function-enter' }, document), true,
    'the function declaration remains selectable in the Studio event outline');
  assert.equal(api.animation('function-enter'), 'code',
    'function entry highlights its source header without requiring a canvas target');
});

test('auto fixed state follows runtime identity across aliases and batches a frame', () => {
  const api = eventApi();
  const data = { kind: 'sequence', items: [1, 2, 3] };
  const document = {
    variables: {
      'main:arr@1': { name: 'arr', kind: 'sequence' },
      'visit:arr@2': { name: 'arr', kind: 'sequence' }
    },
    studio: {
      eventSettings: { autoFixedEnabled: true, defaultEnabled: {}, timelineTypes: {} },
      eventStates: {},
      eventInstructionStates: { 'fixed:visit:arr@2:0': false }
    },
    frames: [
      {
        id: 'frame-1', source: {},
        state: { 'visit:arr@2': { name: 'arr', identity: 'same-object', data } },
        events: [{ id: 'read-1', type: 'read', order: 1, targets: [
          { variableId: 'visit:arr@2', indexExpression: '0' }
        ] }]
      },
      {
        id: 'frame-2', source: {},
        state: { 'main:arr@1': { name: 'arr', identity: 'same-object', data } },
        events: [{ id: 'read-2', type: 'read', order: 1, targets: [
          { variableId: 'main:arr@1', indexExpression: '0' },
          { variableId: 'main:arr@1', indexExpression: '2' },
          { variableId: 'main:arr@1', indexExpression: '', resolvedIndex: null }
        ] }]
      }
    ]
  };
  api.rebuildAutoFixedEvents(document);
  api.applyEnabledStates(document);
  assert.equal(document.frames[0].events.some(event => event.type === 'fixed'), false,
    'a reference alias must not fix the cell before its actual final use');
  const fixed = document.frames[1].events.filter(event => event.type === 'fixed');
  assert.equal(fixed.length, 1, 'cells completed in one frame are one state batch');
  assert.deepEqual(Array.from(fixed[0].targets, target => target.resolvedIndex), [0, 2]);
  assert.equal(fixed[0].enabled, true);
  assert.equal(api.showInspector(fixed[0]), false);
  assert.equal(document.studio.eventInstructionStates['fixed:visit:arr@2:0'], false,
    'migration cleanup occurs when Studio serializes settings, not while normalizing playback');
});
