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

test('initial event animation and timeline defaults match the Event Settings panel', () => {
  const api = eventApi();
  const enabled = new Set([
    'declare', 'scope-exit', 'visual-exit', 'write', 'assign', 'sequence-operation', 'compare', 'swap'
  ]);
  const document = { studio: { eventSettings: { defaultEnabled: {}, timelineTypes: {} } } };
  api.definitions.forEach(definition => {
    assert.equal(api.defaultEnabled({ type: definition.type }, document),
      definition.type === 'fixed' || enabled.has(definition.type),
      `${definition.type} animation default`);
    assert.equal(api.showTag(definition.type, document), enabled.has(definition.type),
      `${definition.type} timeline default`);
  });
  assert.equal(api.animation('declare'), 'declare',
    'an enabled declaration is the formal object-entrance animation');
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
