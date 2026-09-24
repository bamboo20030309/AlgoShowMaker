const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('insertion shift remains available at its captured indices after j-- reaches -1', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> arr = {3, 1, 2};
 int j = 0;
 // @frame arr[j]
 arr[j+1] = arr[j];
 j--;
 // @frame arr[j]
}`);
  const frame = trace.frames.at(-1);
  const assignment = frame.events.find(event => event.type === 'assign');
  const decrement = frame.events.find(event => event.type === 'write' && event.update);
  assert.deepEqual(Array.from(assignment.targets, target => target.resolvedIndex), [1, 0]);
  assert.ok(assignment.order < decrement.order);
  const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const j = Object.keys(trace.variables).find(id => trace.variables[id].name === 'j');
  assert.equal(Number(frame.state[j].data.value), -1);
  const elements = new Map([0, 1, 2].map(i => [`${arr}#${i}`, { dataset: {} }]));
  const placements = new Map([0, 1, 2].map(i => [`${arr}#${i}`, { x: i * 40, y: 0, width: 40, height: 40 }]));
  elements.set('marker-j', { dataset: { traceSourceVariableId: j } });
  placements.set('marker-j', { x: -40, y: -40, width: 18, height: 18 });
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assert.equal(assignment.autoAnimationDisabled, false);
  assert.equal(decrement.autoAnimationDisabled, false);
  elements.delete(`${arr}#0`);
  window.ASMTraceFrameTween.updateEventAvailability(trace, frame, placements, elements);
  assert.equal(assignment.autoAnimationDisabled, true, 'an actually hidden source must still disable assignment');
  assert.equal(decrement.autoAnimationDisabled, false, 'array source visibility does not suppress j--');
});

test('initializer and indexed ++ keep their own indices when a later increment changes j', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> arr = {3, 1, 2};
 int j = 0;
 // @frame arr[j]
 int key = arr[j];
 arr[j]++;
 arr[j] += 2;
 j++;
 // @frame arr[j],key
}`);
  const frame = trace.frames.at(-1);
  const initializer = frame.events.find(event => event.type === 'assign');
  assert.equal(initializer.targets.find(target => target.role === 'source').resolvedIndex, 0);
  const updates = frame.events.filter(event => event.type === 'write' && event.update);
  assert.equal(updates[0].targets[0].resolvedIndex, 0);
  assert.equal(updates[1].targets[0].resolvedIndex, undefined, 'scalar j++ is not an indexed array write');
  const compound = frame.events.find(event => event.type === 'write' && !event.update);
  assert.equal(compound.targets[0].resolvedIndex, 0);
  assert.equal(Number(frame.state[updates[1].targets[0].variableId].data.value), 1);
});

test('compound += captures its target values and visible source cell', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
vector<int> tree = {0, 27};
int sum = 0;
int main() {
 int now = 1;
 // @frame tree,sum
 sum += tree[now];
 // @frame tree,sum
}`);
  const frame = trace.frames.at(-1);
  const event = frame.events.find(item => item.type === 'write' && item.compound === true);
  const tree = Object.keys(trace.variables).find(id => trace.variables[id].name === 'tree');
  const sum = Object.keys(trace.variables).find(id => trace.variables[id].name === 'sum');
  assert.ok(event);
  assert.equal(event.update, undefined);
  assert.equal(event.payload.before.value, 0);
  assert.equal(event.payload.after.value, 27);
  assert.equal(Object.hasOwn(event.payload, 'source'), false,
    'the renderer reads the source cell text without evaluating the C++ expression twice');
  assert.equal(event.targets.find(target => target.role === 'target').variableId, sum);
  assert.equal(event.targets.find(target => target.role === 'source').variableId, tree);
  assert.equal(event.targets.find(target => target.role === 'source').resolvedIndex, 1);
  assert.equal(window.ASMTraceFrameTween.assignmentTransferOperator(event), '+');
  assert.equal(window.ASMTraceFrameTween.formatAssignmentTransferValue('27', '+'), '+27');
  assert.equal(window.ASMTraceFrameTween.formatAssignmentTransferValue('-3', '+'), '+(-3)');
  assert.equal(window.ASMTraceFrameTween.assignmentTransferOperator({
    compound: true, expression: 'sum -= tree[now]'
  }), '-');
  assert.equal(window.ASMTraceFrameTween.assignmentTransferOperator({
    compound: true, expression: 'sum *= tree[now]'
  }), '*');
  assert.equal(window.ASMTraceFrameTween.assignmentTransferOperator({
    compound: true, expression: 'sum /= tree[now]'
  }), '/');
  assert.equal(window.ASMTraceFrameTween.formatAssignmentTransferValue('-3', '-'), '-(-3)');
  assert.equal(window.ASMTraceFrameTween.formatAssignmentTransferValue('4', '*'), '*4');
  assert.equal(window.ASMTraceFrameTween.formatAssignmentTransferValue('2', '/'), '/2');
  const replay = window.ASMTraceFrameTween.createForwardReplayPlan(trace, frame, [], 1);
  const track = replay.valueTracks.find(item => item.key.endsWith(`${sum}#0`));
  assert.equal(track.initial.value, 0);
  assert.equal(track.steps.at(-1).after.value, 27);
});

test('binary arithmetic assignments capture both operands and their operators', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
 int a = 12, b = 3;
 int added = 0, subtracted = 0, multiplied = 0, divided = 0;
 // @frame a,b,added,subtracted,multiplied,divided
 added = a + b;
 subtracted = a - b;
 multiplied = a * b;
 divided = a / b;
 // @frame a,b,added,subtracted,multiplied,divided
}`);
  const frame = trace.frames.at(-1);
  const nameById = new Map(Object.entries(trace.variables).map(([id, variable]) => (
    [id, variable.name]
  )));
  const arithmetic = frame.events.filter(event => (
    ['+', '-', '*', '/'].includes(event.binaryOperation)
  ));
  assert.deepEqual(Array.from(arithmetic, event => [
    nameById.get(event.targets.find(target => target.role === 'target')?.variableId),
    event.binaryOperation,
    Array.from(event.targets, target => target.role)
  ]), [
    ['added', '+', ['target', 'source-left', 'source-right']],
    ['subtracted', '-', ['target', 'source-left', 'source-right']],
    ['multiplied', '*', ['target', 'source-left', 'source-right']],
    ['divided', '/', ['target', 'source-left', 'source-right']]
  ]);
  assert.deepEqual(Array.from(arithmetic, event => (
    window.ASMTraceFrameTween.assignmentTransferOperator(event)
  )), ['+', '-', '*', '/']);
});

test('binary addition assignment captures both visible sources without reevaluating them', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
vector<int> tree = {0, 3, 4, 0};
int main() {
 int left = 1, right = 2, parent = 3;
 int a = 5, b = 6, total = 0;
 // @frame tree,a,b,total
 total = a + b;
 tree[parent] = tree[left] + tree[right];
 // @frame tree,a,b,total
}`);
  const frame = trace.frames.at(-1);
  const tree = Object.keys(trace.variables).find(id => trace.variables[id].name === 'tree');
  const variableByName = name => Object.keys(trace.variables)
    .find(id => trace.variables[id].name === name);
  const event = frame.events.find(item => item.type === 'assign'
    && item.targets?.some(target => target.variableId === tree && target.role === 'target'));
  assert.ok(event);
  assert.equal(event.binaryOperation, '+');
  assert.equal(event.payload.before.value, 0);
  assert.equal(event.payload.after.value, 7);
  assert.equal(Object.hasOwn(event.payload, 'source'), false);
  assert.deepEqual(Array.from(event.targets, target => [target.role, target.resolvedIndex]), [
    ['target', 3], ['source-left', 1], ['source-right', 2]
  ]);
  const replay = window.ASMTraceFrameTween.createForwardReplayPlan(trace, frame, [], 1);
  const track = replay.valueTracks.find(item => item.key.endsWith(`${tree}#3`));
  assert.equal(track.initial.value, 0);
  assert.equal(track.steps.at(-1).after.value, 7);
  const scalarEvent = frame.events.find(item => item.type === 'assign'
    && item.targets?.some(target => target.variableId === variableByName('total')));
  assert.equal(scalarEvent.binaryOperation, '+');
  assert.equal(window.ASMTraceFrameTween.assignmentTransferOperator(scalarEvent), '+');
  assert.deepEqual(Array.from(scalarEvent.targets, target => [target.role, target.variableId]), [
    ['target', variableByName('total')],
    ['source-left', variableByName('a')],
    ['source-right', variableByName('b')]
  ]);
});

test('capturing initializer metadata does not evaluate an index function again', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int calls = 0;
int nextIndex() { calls++; return 0; }
int main() {
 vector<int> arr = {3, 1};
 int key = arr[nextIndex()];
 // @frame arr,key,calls
}`);
  const frame = trace.frames.at(-1);
  const calls = Object.keys(trace.variables).find(id => trace.variables[id].name === 'calls');
  assert.equal(Number(frame.state[calls].data.value), 1);
  const key = Object.keys(trace.variables).find(id => trace.variables[id].name === 'key');
  const initializer = frame.events.find(event => event.type === 'assign' && event.targets[0]?.variableId === key);
  assert.equal(initializer.targets[1].resolvedIndex, undefined);
});

test('compound assignment does not reevaluate a side-effecting target index', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int calls = 0;
int nextIndex() { calls++; return 0; }
int main() {
 vector<int> arr = {3, 1};
 // @frame arr,calls
 arr[nextIndex()] += 2;
 // @frame arr,calls
}`);
  const frame = trace.frames.at(-1);
  const calls = Object.keys(trace.variables).find(id => trace.variables[id].name === 'calls');
  const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  assert.equal(Number(frame.state[calls].data.value), 1);
  assert.equal(Number(frame.state[arr].data.items[0].value), 5);
  const write = frame.events.find(event => event.type === 'write'
    && event.targets?.some(target => target.variableId === arr));
  assert.equal(write.compound, undefined,
    'unsafe target expressions preserve the single-evaluation write path');
});
