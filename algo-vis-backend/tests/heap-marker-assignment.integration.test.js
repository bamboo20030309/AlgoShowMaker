const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('a first marker assignment reserves motion time even at the captured destination', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {1}; // @frame arr
}`);
  const event = { id: 'move-largest', order: 1, type: 'assign', enabled: true,
    targets: [{ role: 'target', variableId: 'largest' }],
    payload: { before: { kind: 'scalar', value: 4 }, after: { kind: 'scalar', value: 8 } } };
  const marker = { dataset: { traceSourceVariableId: 'largest', traceBindingTarget: 'arr#8' } };
  const placements = new Map([['marker-largest', { x: 80, y: 0, width: 18, height: 18 }]]);
  const slots = window.ASMTraceFrameTween.buildEventTimeline(
    { variables: { largest: { name: 'largest' } } },
    { id: 'frame-motion', events: [event], state: {} }, 1, 520,
    placements, placements, new Map([['marker-largest', marker]])
  );
  assert.equal(slots.length, 1);
  assert.equal(slots[0].end - slots[0].motionStart, 520);
});

test('largest = l/r moves the largest marker without rendering l or r', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
void heapify(vector<int>& arr, int n, int i) {
  int largest = i;
  int l = 2 * i;
  int r = 2 * i + 1;
  if (l <= n && arr[l] > arr[largest]) largest = l;
  if (r <= n && arr[r] > arr[largest]) largest = r;
  // @frame arr[i,largest] render heap with range(1,n)
}
int main() {
  vector<int> arr = {0, 1, 2, 3};
  heapify(arr, 3, 1);
}`);
  const frame = trace.frames.at(-1);
  const assignments = frame.events.filter(event => /^largest = [lr]$/.test(event.expression || ''));
  assert.deepEqual(Array.from(assignments, event => event.expression), ['largest = l', 'largest = r']);
  const byName = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
  const arr = byName('arr');
  const largest = byName('largest');
  const elements = new Map([1, 2, 3].map(index => [`${arr}#${index}`, { dataset: {} }]));
  const placements = new Map([1, 2, 3].map(index => [
    `${arr}#${index}`, { x: index * 40, y: index === 1 ? 0 : 40, width: 40, height: 40 }
  ]));
  elements.set('marker-largest', {
    dataset: {
      traceSourceVariableId: largest,
      traceSourceVariableIds: JSON.stringify([largest]),
      traceBindingTarget: `${arr}#3`
    }
  });
  placements.set('marker-largest', { x: 120, y: 5, width: 18, height: 18 });
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assignments.forEach(event => assert.equal(event.autoAnimationDisabled, false));

  elements.delete('marker-largest');
  placements.delete('marker-largest');
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assignments.forEach(event => assert.equal(event.autoAnimationDisabled, true,
    'the assignment still needs its destination marker'));
  assignments.forEach(event => assert.equal(event.autoAnimationUnavailableReason, 'missing-target'));
});

test('retained keep markers never satisfy a live event target', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2, 1};
  int i = 0;
  i++;
  // @frame arr[i]
}`);
  const frame = trace.frames.at(-1);
  const event = frame.events.find(item => item.type === 'write' && item.update === true);
  assert.ok(event);
  const target = event.targets.find(item => item.role !== 'source') || event.targets[0];
  const marker = {
    dataset: {
      traceSourceVariableId: target.variableId,
      traceSourceVariableIds: JSON.stringify([target.variableId]),
      traceRuntimeIdentity: target.lifetimeIdentity || '',
      traceSceneGeneration: String(target.sceneGeneration ?? ''),
      traceBindingTarget: 'arr#1',
      traceSnapshotOwner: 'keep-before-loop'
    }
  };
  const elements = new Map([['kept-marker-i', marker]]);
  const placements = new Map([['kept-marker-i', { x: 40, y: 0, width: 18, height: 18 }]]);

  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assert.equal(event.autoAnimationDisabled, true);
  assert.equal(event.autoAnimationUnavailableReason, 'missing-target',
    'a historical marker is not the current runtime object');

  delete marker.dataset.traceSnapshotOwner;
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assert.equal(event.autoAnimationDisabled, false,
    'the matching live marker makes the event available');

  const comparison = {
    id: 'compare-retained-cells', order: 1, type: 'compare', enabled: true,
    targets: [
      { role: 'left', variableId: 'arr', indexExpression: '0', resolvedIndex: 0 },
      { role: 'right', variableId: 'arr', indexExpression: '1', resolvedIndex: 1 }
    ]
  };
  const retainedCells = new Map([
    ['arr#0', { dataset: { traceSnapshotOwner: 'keep-array' } }],
    ['arr#1', { dataset: { traceSnapshotOwner: 'keep-array' } }]
  ]);
  const retainedPlacements = new Map([
    ['arr#0', { x: 0, y: 0, width: 40, height: 40 }],
    ['arr#1', { x: 40, y: 0, width: 40, height: 40 }]
  ]);
  window.ASMTraceFrameTween.updateEventAvailability(
    { variables: { arr: { kind: 'sequence' } } },
    { id: 'frame-retained-cells', events: [comparison] },
    retainedPlacements,
    retainedCells
  );
  assert.equal(comparison.autoAnimationUnavailableReason, 'missing-target',
    'retained array cells cannot stand in for a missing live array either');
});

test('an unavailable event defaults off but remains user-controllable and remembers intent', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1};
  // @frame arr
}`);
  const event = { enabled: true, autoAnimationDisabled: true };
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.ASMTraceEvents.controlState(event))),
    { checked: false, available: false }
  );
  event.enabled = false;
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.ASMTraceEvents.controlState(event))),
    { checked: false, available: false }
  );

  const savedEvent = {
    id: 'event-saved', signature: 'assign:main:1:value = 1',
    type: 'assign', enabled: true, autoAnimationDisabled: true
  };
  const savedDocument = {
    studio: { eventInstructionStates: { 'assign:main:1:value = 1': true } },
    frames: [{ id: 'frame-saved', events: [savedEvent] }]
  };
  window.ASMTraceEvents.applyEnabledStates(savedDocument);
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.ASMTraceEvents.controlState(savedEvent))),
    { checked: true, available: false },
    'an explicit saved on state remains visible and editable'
  );
  savedDocument.studio.eventInstructionStates['assign:main:1:value = 1'] = false;
  window.ASMTraceEvents.applyEnabledStates(savedDocument);
  assert.deepEqual(
    JSON.parse(JSON.stringify(window.ASMTraceEvents.controlState(savedEvent))),
    { checked: false, available: false }
  );
  assert.equal(window.ASMTraceEvents.availabilityKind(event), 'missing-target');
  event.autoAnimationUnavailableReason = 'unrenderable';
  assert.equal(window.ASMTraceEvents.availabilityKind(event), 'unrenderable');

  const unsupported = { id: 'event-1', order: 1, type: 'call', enabled: true, targets: [] };
  window.ASMTraceFrameTween.updateEventAvailability(
    {}, { id: 'frame-unsupported', events: [unsupported] }, new Map(), new Map()
  );
  assert.equal(unsupported.autoAnimationDisabled, true);
  assert.equal(unsupported.autoAnimationUnavailableReason, 'unrenderable');

  const malformedAssignment = { id: 'event-2', order: 2, type: 'assign', enabled: true, targets: [] };
  window.ASMTraceFrameTween.updateEventAvailability(
    {}, { id: 'frame-malformed', events: [malformedAssignment] }, new Map(), new Map()
  );
  assert.equal(malformedAssignment.autoAnimationUnavailableReason, 'unrenderable');
});

test('enabled declarations schedule marker entrances in runtime order while disabled ones are direct', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2, 1};
  // @frame arr
}`);
  const declareJ = {
    id: 'declare-j', order: 1, type: 'declare', enabled: true,
    targets: [{ role: 'target', variableId: 'j' }], payload: { after: 0 }
  };
  const declareI = {
    id: 'declare-i', order: 2, type: 'declare', enabled: true,
    targets: [{ role: 'target', variableId: 'i' }], payload: { after: 0 }
  };
  const frame = { id: 'frame-declarations', events: [declareJ, declareI], state: {} };
  const document = {
    variables: { i: { name: 'i' }, j: { name: 'j' } },
    studio: { eventSettings: { gapMs: 50 } }
  };
  const marker = variableId => ({
    dataset: {
      traceSourceVariableId: variableId,
      traceSourceVariableIds: JSON.stringify([variableId]),
      traceBindingTarget: 'arr#0'
    }
  });
  const elements = new Map([
    ['marker-j', marker('j')],
    ['marker-i', marker('i')]
  ]);
  const placements = new Map([
    ['marker-j', { x: 0, y: 0, width: 18, height: 18 }],
    ['marker-i', { x: 26, y: 0, width: 18, height: 18 }]
  ]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    document, frame, 1, 520, new Map(), placements, elements, 500
  );
  assert.deepEqual(Array.from(timeline, slot => ({
    id: slot.event.id, animation: slot.animation, start: slot.start, end: slot.end
  })), [
    { id: 'declare-j', animation: 'declare', start: 500, end: 720 },
    { id: 'declare-i', animation: 'declare', start: 770, end: 990 }
  ]);
  let schedule = window.ASMTraceFrameTween.declarationVisualSchedule(
    document, frame, timeline, placements, elements
  );
  assert.equal(schedule.slotsByKey.get('marker-j').event, declareJ);
  assert.equal(schedule.slotsByKey.get('marker-i').event, declareI);

  declareI.enabled = false;
  const directTimeline = window.ASMTraceFrameTween.buildEventTimeline(
    document, frame, 1, 520, new Map(), placements, elements, 500
  );
  schedule = window.ASMTraceFrameTween.declarationVisualSchedule(
    document, frame, directTimeline, placements, elements
  );
  assert.equal(schedule.declaredKeys.has('marker-i'), true,
    'the renderer still knows this object has a declaration');
  assert.equal(schedule.slotsByKey.has('marker-i'), false,
    'a disabled declaration has no entrance slot, so its final state is direct');
});

test('a scalar declaration owns both its outer object and inner cell entrance', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {3, 2, 1}; // @frame arr
}`);
  const declareKey = {
    id: 'declare-key', order: 1, type: 'declare', enabled: true,
    targets: [{
      role: 'target', variableId: 'key', lifetimeIdentity: 'life-key', sceneGeneration: 0
    }]
  };
  const frame = { id: 'frame-key', sceneGeneration: 0, events: [declareKey], state: {} };
  const scalar = dataset => ({ dataset, closest: () => null, querySelectorAll: () => [] });
  const elements = new Map([
    ['key', scalar({
      traceVariable: 'key', traceRuntimeLifetime: 'life-key', traceSceneGeneration: '0'
    })],
    ['key#0', scalar({ traceSceneGeneration: '0' })]
  ]);
  const placements = new Map([
    ['key', { x: 0, y: 0, width: 40, height: 76 }],
    ['key#0', { x: 0, y: 0, width: 40, height: 40 }]
  ]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    { variables: { key: { name: 'key', kind: 'scalar' } }, studio: { eventSettings: { gapMs: 50 } } },
    frame, 1, 520, new Map(), placements, elements
  );
  const schedule = window.ASMTraceFrameTween.declarationVisualSchedule(
    { variables: { key: { name: 'key', kind: 'scalar' } } },
    frame, timeline, placements, elements
  );
  assert.equal(schedule.slotsByKey.get('key')?.event, declareKey,
    'the outer frame must remain absent until the declaration event');
  assert.equal(schedule.slotsByKey.get('key#0')?.event, declareKey,
    'the scalar cell remains controlled by the same declaration event');
});

test('for initializer assignment is pointer motion without an assignment value box', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {3, 2, 1}; // @frame arr
}`);
  const initializer = {
    id: 'init-i', order: 1, type: 'assign', enabled: true,
    forInitializer: true, payload: { before: null, after: { kind: 'scalar', value: 0 } },
    targets: [{ role: 'target', variableId: 'i', lifetimeIdentity: 'life-i' }]
  };
  const marker = {
    dataset: {
      traceSourceVariableId: 'i',
      traceSourceVariableIds: JSON.stringify(['i']),
      traceRuntimeIdentity: 'life-i',
      traceBindingTarget: 'arr#0'
    }
  };
  const elements = new Map([['marker-i', marker]]);
  const placements = new Map([
    ['marker-i', { x: 0, y: 0, width: 18, height: 18 }],
    ['arr#0', { x: 0, y: 30, width: 40, height: 40 }]
  ]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    { studio: { eventSettings: { gapMs: 50 } } },
    { id: 'frame-init', events: [initializer], state: {} },
    1, 520, new Map(), placements, elements
  );
  assert.equal(timeline.length, 1);
  assert.equal(timeline[0].animation, 'position');
  assert.equal(timeline[0].markerAssignment, false,
    'position-only initialization cannot create the assignment popup');

  const legacyInitializer = {
    ...initializer,
    id: 'legacy-init-i',
    forInitializer: undefined,
    source: {
      from: 12,
      to: 17,
      contexts: [{
        type: 'ForStatement', headerFrom: 7, conditionFrom: 18
      }]
    }
  };
  const legacyTimeline = window.ASMTraceFrameTween.buildEventTimeline(
    { studio: { eventSettings: { gapMs: 50 } } },
    { id: 'legacy-frame-init', events: [legacyInitializer], state: {} },
    1, 520, new Map(), placements, elements
  );
  assert.equal(legacyTimeline[0].animation, 'position',
    'older saved traces infer the same initializer mode from their AST span');
  assert.equal(legacyTimeline[0].markerAssignment, false);
});

test('a declared marker with an initializer enters directly at its assigned position', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2, 1};
  int i = 0;
  // @frame arr[i]
}`);
  const initializer = trace.frames.flatMap(frame => frame.events || []).find(event => (
    event.type === 'assign' && event.expression === 'i = 0'
  ));
  const initializerFrame = trace.frames.find(frame => (frame.events || []).includes(initializer));
  assert.ok(initializer);
  assert.equal(initializer.declarationInitializer, true);
  assert.equal(window.ASMTraceFrameTween.isDeclarationInitializerAssignment(initializer), true);

  const iId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'i');
  const marker = {
    dataset: {
      traceSourceVariableId: iId,
      traceSourceVariableIds: JSON.stringify([iId]),
      traceRuntimeIdentity: initializer.lifetimeIdentity,
      traceBindingTarget: `${Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr')}#0`
    }
  };
  const elements = new Map([['marker-i', marker]]);
  const placements = new Map([
    ['marker-i', { x: 0, y: 0, width: 18, height: 18 }],
    [marker.dataset.traceBindingTarget, { x: 0, y: 30, width: 40, height: 40 }]
  ]);
  assert.equal(
    window.ASMTraceFrameTween.markerTargetBeforeFrameEvents(trace, initializerFrame, marker),
    marker.dataset.traceBindingTarget,
    'the declaration entrance starts at the initializer result rather than unresolved parking'
  );
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    trace, { id: 'declared-marker', events: [initializer], state: {} },
    1, 520, new Map(), placements, elements
  );
  assert.equal(timeline[0]?.animation, 'position');
  assert.equal(timeline[0]?.markerAssignment, false,
    'the initialized entrance must not create a falling assignment value box');
});

test('container replay never overwrites an array outerframe label', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {0, 8, 15, 6}; // @frame arr
}`);
  const label = { textContent: 'arr' };
  const object = {
    dataset: {},
    matches: () => false,
    querySelector: () => label
  };
  const sequence = { kind: 'sequence', items: [0, 8, 15, 6] };
  const replay = window.ASMTraceFrameTween.prepareForwardValues({
    currentElements: new Map([['arr', object]])
  }, {
    visualValueTracks: [{
      kind: 'value', key: 'arr', initial: null,
      steps: [{ mode: 'animated', commitMs: 100, before: null, after: sequence }]
    }]
  });
  replay.update(200);
  replay.finish();
  assert.equal(label.textContent, 'arr');
});

test('scope exit schedules an in-order fade only for the matching old lifetime', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {1}; // @frame arr
}`);
  const exit = {
    id: 'exit-j', order: 4, type: 'scope-exit', enabled: true,
    targets: [{ role: 'target', variableId: 'j', lifetimeIdentity: 'life-old' }]
  };
  const previousMarker = {
    dataset: {
      traceSourceVariableId: 'j',
      traceSourceVariableIds: JSON.stringify(['j']),
      traceRuntimeIdentity: 'life-old'
    },
    closest: () => null,
    querySelectorAll: () => []
  };
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    { studio: { eventSettings: { gapMs: 50 } } },
    { id: 'frame-exit', events: [exit], state: {} },
    1, 520, new Map(), new Map(), new Map(), 300,
    new Map([['marker-j', previousMarker]])
  );
  assert.deepEqual(Array.from(timeline, slot => ({
    animation: slot.animation, start: slot.start, end: slot.end
  })), [{ animation: 'exit', start: 300, end: 520 }]);
  assert.equal(exit.autoAnimationDisabled, false);
});

test('scope exit can target a variable declared and exited in the same frame', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {1}; // @frame arr
}`);
  const exit = {
    id: 'exit-current-j', order: 8, type: 'scope-exit', enabled: true,
    targets: [{ role: 'target', variableId: 'j', lifetimeIdentity: 'life-current' }]
  };
  const declaration = {
    id: 'declare-current-j', order: 1, type: 'declare', enabled: true,
    targets: [{ role: 'target', variableId: 'j', lifetimeIdentity: 'life-current' }]
  };
  const marker = lifetimeIdentity => ({
    dataset: {
      traceSourceVariableId: 'j',
      traceSourceVariableIds: JSON.stringify(['j']),
      traceRuntimeIdentity: lifetimeIdentity
    },
    closest: () => null,
    querySelectorAll: () => []
  });
  const elements = new Map([['marker-j', marker('life-current')]]);
  const placements = new Map([['marker-j', { x: 0, y: 0, width: 18, height: 18 }]]);
  const previousObjects = new Map([['marker-j', marker('life-previous')]]);
  const timeline = window.ASMTraceFrameTween.buildEventTimeline(
    { studio: { eventSettings: { gapMs: 50 } } },
    { id: 'frame-current-exit', events: [declaration, exit], state: {} },
    1, 520, placements, placements, elements, 0, previousObjects
  );
  assert.deepEqual(Array.from(timeline, slot => ({
    animation: slot.animation, start: slot.start, end: slot.end
  })), [
    { animation: 'declare', start: 0, end: 220 },
    { animation: 'exit', start: 270, end: 490 }
  ]);
  assert.equal(exit.autoAnimationDisabled, false,
    'the current lifetime must win over an older marker from the preceding frame');
});

test('scope exit without a displayed lifetime is a missing-target event', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() { vector<int> arr = {1}; // @frame arr
}`);
  const exit = {
    id: 'exit-hidden-j', order: 3, type: 'scope-exit', enabled: true,
    targets: [{ role: 'target', variableId: 'j', lifetimeIdentity: 'life-hidden' }]
  };
  window.ASMTraceFrameTween.updateEventAvailability(
    {}, { id: 'frame-hidden-exit', events: [exit] }, new Map(), new Map(), null
  );
  assert.equal(exit.autoAnimationDisabled, true);
  assert.equal(exit.autoAnimationUnavailableReason, 'missing-target');
});

test('whole conditions remain internal code-color metadata without a timed animation', async () => {
  const { window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  for (int i = 0; i < 2; i++) {}
}`);
  const condition = {
    id: 'event-condition', order: 1, type: 'condition', enabled: true,
    expression: 'i < 2', targets: []
  };
  window.ASMTraceFrameTween.updateEventAvailability(
    {}, { id: 'frame-condition', events: [condition] }, new Map(), new Map()
  );
  assert.equal(condition.autoAnimationDisabled, false);
  assert.equal(condition.autoAnimationUnavailableReason, undefined);
  assert.equal(window.ASMTraceEvents.showInspector(condition), false);
  assert.equal(window.ASMTraceEvents.showTag('condition'), false);
  assert.equal(window.ASMTraceEvents.animation('condition'), 'none');
});

test('classic for controls stay editable but report a missing visible target without a marker', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {2, 1};
  // @frame arr
  for (int i = 0; i < 2; i++) {
    // @frame arr
  }
}`);
  const event = trace.frames.flatMap(frame => frame.events || [])
    .find(item => item.type === 'assign' && item.expression === 'i = 0');
  const comparison = trace.frames.flatMap(frame => frame.events || [])
    .find(item => item.type === 'compare' && item.source?.text === 'i < 2');
  assert.ok(event);
  assert.ok(comparison);
  window.ASMTraceFrameTween.updateEventAvailability(
    trace, { id: 'frame-for-initializer', events: [event, comparison] }, new Map(), new Map()
  );
  assert.equal(event.autoAnimationDisabled, true);
  assert.equal(event.autoAnimationUnavailableReason, 'missing-target');
  assert.equal(comparison.autoAnimationDisabled, true,
    'a comparison still requires its operands to be visible on the canvas');
  assert.equal(comparison.autoAnimationUnavailableReason, 'missing-target');
  assert.equal(window.ASMTraceEvents.showInspector(event, trace), true);
  assert.equal(window.ASMTraceEvents.showInspector(comparison, trace), true);

  const ordinary = {
    id: 'event-ordinary', order: 2, type: 'assign', enabled: true,
    source: { from: 200, to: 205, contexts: event.source.contexts },
    targets: event.targets
  };
  window.ASMTraceFrameTween.updateEventAvailability(
    trace, { id: 'frame-ordinary', events: [ordinary] }, new Map(), new Map()
  );
  assert.equal(ordinary.autoAnimationDisabled, true,
    'ordinary hidden assignments must keep the existing canvas-target rule');
});

test('fixed mark availability follows its switch instead of being auto-disabled', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1};
  // @frame arr
}`);
  const frame = trace.frames[0];
  const variableId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const key = `${variableId}#0`;
  const fixed = {
    id: 'fixed-test', order: 1, type: 'fixed', signature: `fixed:${variableId}:0`,
    targets: [{ role: 'target', variableId, expression: 'arr[0]', indexExpression: '0' }]
  };
  frame.events = [fixed];
  window.ASMTraceFrameTween.updateEventAvailability(
    trace,
    frame,
    new Map([[key, { x: 0, y: 0, width: 40, height: 40 }]]),
    new Map([[key, { dataset: {} }]])
  );
  assert.equal(fixed.autoAnimationDisabled, false);
  assert.equal(window.ASMTraceEvents.controlState(fixed).available, true);

  trace.studio.eventSettings ||= {};
  trace.studio.eventSettings.autoFixedEnabled = false;
  window.ASMTraceEvents.applyEnabledStates(trace);
  assert.equal(fixed.enabled, false, 'the fixed mark must obey the disabled setting');
  assert.equal(window.ASMTraceEvents.controlState(fixed).checked, false);
});

test('fixed cells use the actual object last access across function aliases', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
void inspect(vector<int>& values) {
  int seen = values[0];
  // inside: @frame values
}
int main() {
  vector<int> values = {4, 2};
  inspect(values);
  values[0] = 9;
  int tail = values[1];
  // outside: @frame values
}`);
  const fixedFrames = trace.frames.flatMap((frame, frameIndex) => (
    frame.events.filter(event => event.type === 'fixed').map(event => ({ frameIndex, event }))
  ));
  assert.ok(fixedFrames.length > 0);
  assert.equal(fixedFrames.some(({ frameIndex }) => frameIndex === 0), false,
    'the callee alias must not fix cells that the caller accesses later');
  const outside = fixedFrames.filter(({ frameIndex }) => frameIndex === trace.frames.length - 1);
  assert.equal(outside.length, 1, 'the caller final accesses are emitted as one fixed batch');
  assert.deepEqual(Array.from(outside[0].event.targets, target => target.resolvedIndex), [0, 1]);
  assert.equal(outside[0].event.autoFixed, true);
});

test('recursive heapify activations retain distinct runtime identities and ordered marker assignments', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
void heapify(vector<int>& arr, int n, int i) {
  int largest = i;
  int l = 2 * i + 1;
  int r = 2 * i + 2;
  if (l < n && arr[l] > arr[largest]) largest = l;
  if (r < n && arr[r] > arr[largest]) largest = r;
  if (largest != i) {
    swap(arr[i], arr[largest]);
  }
  // heap: @frame arr[i,largest] render heap with range(0,n-1)
  if (largest != i) heapify(arr, n, largest);
}
int main() {
  vector<int> arr = {5, 7, 2, 1, 9, 4};
  heapify(arr, 6, 1);
}`);
  const variableId = name => Object.keys(trace.variables).find(id => trace.variables[id].name === name);
  const iId = variableId('i');
  const largestId = variableId('largest');
  assert.ok(iId && largestId);
  const heapFrames = trace.frames.filter(frame => frame.state[iId]?.identity);
  assert.ok(heapFrames.length >= 2);
  const identities = heapFrames.map(frame => frame.state[iId]?.identity).filter(Boolean);
  assert.ok(new Set(identities).size >= 2, 'recursive i activations must remain distinguishable');
  heapFrames.forEach(frame => {
    const assignments = frame.events.filter(event => /^largest = (i|l|r)$/.test(event.expression || ''));
    const orders = Array.from(assignments, event => event.order);
    assert.deepEqual(orders, [...orders].sort((left, right) => left - right));
  });
});
