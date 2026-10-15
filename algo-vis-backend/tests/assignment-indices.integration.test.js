/**
 * 測試模組：assignment-indices.integration.test
 *
 * 驗證重點：assignment indices.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('insertion shift remains available at its captured indices after j-- reaches -1', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
 vector<int> arr = {3, 1, 2};
 int j = 0;
 // @frame arr
 // @pointer j at arr
 arr[j+1] = arr[j];
 j--;
 // @frame arr
 // @pointer j at arr
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
 // @frame arr
 // @pointer j at arr
 int key = arr[j];
 arr[j]++;
 arr[j] += 2;
 j++;
 // @frame arr,key
 // @pointer j at arr
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

test('arithmetic assignments keep numeric literals separate from displayed data sources', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<vector<int>> grid = {{2, 0}};
  int hidden = 5, result = 0, signedResult = 0;
  // @frame grid,result,signedResult when hidden >= 0
  grid[0][1] = grid[0][0] + 1;
  result = hidden + 2;
  signedResult = grid[0][0] + (-3);
  // @frame grid,result,signedResult when hidden >= 0
}`);
  const frame = trace.frames.at(-1);
  const assignments = frame.events.filter(event => event.type === 'assign'
    && event.binaryOperation === '+');
  assert.equal(assignments.length, 3);
  const matrix = assignments.find(event => event.targets[0].resolvedIndices);
  assert.deepEqual(JSON.parse(JSON.stringify(Array.from(matrix.targets, target => ({
    role: target.role,
    resolvedIndices: target.resolvedIndices,
    literal: target.literal,
    literalValue: target.literalValue,
    operator: target.arithmeticOperator
  })))), [
    { role: 'target', resolvedIndices: [0, 1] },
    { role: 'source-left', resolvedIndices: [0, 0], operator: '+' },
    { role: 'source-right', literal: true, literalValue: '1', operator: '+' }
  ]);
  const scalar = assignments.find(event => !event.targets[0].resolvedIndices);
  assert.equal(scalar.targets[1].expression, 'hidden');
  assert.equal(scalar.targets[2].literal, true);
  assert.equal(scalar.targets[2].literalValue, '2');
  const signed = assignments.find(event => event.targets[0].expression === 'signedResult');
  assert.equal(signed.targets[1].resolvedIndices[0], 0);
  assert.equal(signed.targets[1].resolvedIndices[1], 0);
  assert.equal(signed.targets[2].literal, true);
  assert.equal(signed.targets[2].literalValue, '(-3)');
});

test('max and min assignments record only the selected source role', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> values = {3, 8};
  int maximum = 0, minimum = 0, tied = 0, literal = 0;
  // @frame values,maximum,minimum,tied,literal
  maximum = max(values[0], values[1]);
  minimum = std::min(values[0], values[1]);
  tied = max(values[0], values[0]);
  literal = min(values[1], 5);
  // @frame values,maximum,minimum,tied,literal
}`);
  const events = trace.frames.at(-1).events.filter(event => event.selectionOperation);
  const byTarget = Object.fromEntries(events.map(event => [event.targets[0].expression, event]));
  assert.equal(events.length, 4);
  assert.equal(byTarget.maximum.selectionOperation, 'max');
  assert.equal(byTarget.maximum.selectedSourceRole, 'source-right');
  assert.equal(byTarget.maximum.targets[2].resolvedIndex, 1);
  assert.equal(Number(byTarget.maximum.payload.source.value), 8);
  assert.equal(byTarget.minimum.selectionOperation, 'min');
  assert.equal(byTarget.minimum.selectedSourceRole, 'source-left');
  assert.equal(byTarget.minimum.targets[1].resolvedIndex, 0);
  assert.equal(Number(byTarget.minimum.payload.source.value), 3);
  assert.equal(byTarget.tied.selectedSourceRole, 'source-left');
  assert.equal(byTarget.literal.selectedSourceRole, 'source-right');
  assert.equal(byTarget.literal.targets[2].literal, true);
  assert.equal(byTarget.literal.targets[2].literalValue, '5');
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
