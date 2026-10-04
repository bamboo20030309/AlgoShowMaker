/**
 * 測試模組：sequence-operations.integration.test
 *
 * 驗證重點：sequence operations.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1, 2};
  // @frame arr
  arr.push_back(3);
  // @frame arr
  arr.pop_back();
  // @frame arr
  return 0;
}`;

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('push_back and pop_back emit ordered controllable sequence events with edge snapshots', async () => {
  const { trace, window } = await compile(source);
  assert.equal(trace.frames.length, 3);
  const push = trace.frames[1].events.find(event => event.operation === 'push_back');
  const pop = trace.frames[2].events.find(event => event.operation === 'pop_back');
  assert.ok(push && pop);
  assert.equal(push.type, 'sequence-operation');
  assert.equal(pop.type, 'sequence-operation');
  assert.deepEqual([push.payload.beforeSize, push.payload.afterSize], [2, 3]);
  assert.deepEqual([pop.payload.beforeSize, pop.payload.afterSize], [3, 2]);
  assert.equal(push.payload.afterBack.value, 3);
  assert.equal(pop.payload.beforeBack.value, 3);
  assert.equal(push.targets[0].variableId, pop.targets[0].variableId);
  assert.equal(window.ASMTraceEvents.animation(push.type), 'sequence');
  assert.equal(push.enabled, true);
  assert.equal(pop.enabled, true);
  assert.ok(push.order < pop.order);
});

test('sequence operation switch suppresses its slot without removing runtime metadata', async () => {
  const { trace, window } = await compile(source);
  const frame = trace.frames[1];
  const push = frame.events.find(event => event.operation === 'push_back');
  const topKey = push.targets[0].variableId;
  const visual = { dataset: {}, closest() { return null; } };
  const elements = new Map([[topKey, visual], [`${topKey}#2`, visual]]);
  const placements = new Map([[topKey, { x: 0, y: 0, width: 120, height: 60 }],
    [`${topKey}#2`, { x: 100, y: 0, width: 40, height: 40 }]]);
  const enabled = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map()
  );
  assert.ok(enabled.some(slot => slot.event === push && slot.animation === 'sequence'));
  push.enabled = false;
  const disabled = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map()
  );
  assert.ok(!disabled.some(slot => slot.event === push));
  push.enabled = true;
  push.autoAnimationDisabled = true;
  const reversePresentation = window.ASMTraceFrameTween.buildEventTimeline(
    trace, frame, 1, 520, placements, placements, elements, 0, new Map(),
    event => event.type === 'sequence-operation',
    { skipAvailability: true, ignoreAutoDisabled: true }
  );
  assert.ok(reversePresentation.some(slot => slot.event === push),
    'reverse playback retains the outgoing sequence slot when its destination cell is absent');
  assert.ok(frame.events.includes(push));
});

test('vector assign emits one assignment event for the whole container', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 1, m = 2;
  vector<vector<int>> num;
  // @frame num
  num.assign(n + 1, vector<int>(m + 1, 0));
  // @frame num
}`;
  const { trace } = await compile(source);
  const events = trace.frames.flatMap(frame => frame.events || []);
  const matching = events.filter(event => (
    event.expression === 'num.assign(n + 1, vector<int>(m + 1, 0))'
    || event.operation === 'assign'
  ));
  assert.equal(matching.length, 1, 'the assign call must map to one runtime event');
  assert.equal(matching[0].type, 'assign');
  assert.equal(matching[0].targets?.[0]?.expression, 'num');
  assert.equal(events.some(event => (
    event.type === 'sequence-operation' && event.operation === 'assign'
  )), false, 'container assign is presented as assignment rather than a sequence operation');
});

test('comma-separated initialized declarations emit declaration then assignment per variable', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n=0,m=0,plain;
  // @frame n, m, plain
}`;
  const { trace } = await compile(source);
  const events = trace.frames.flatMap(frame => frame.events || []);
  const relevant = events.filter(event => (
    ['declare', 'assign'].includes(event.type)
    && ['n', 'm', 'plain'].includes(event.targets?.[0]?.expression)
  ));
  assert.deepEqual(Array.from(relevant, event => [event.type, event.targets[0].expression]), [
    ['declare', 'n'],
    ['assign', 'n'],
    ['declare', 'm'],
    ['assign', 'm'],
    ['declare', 'plain']
  ]);
  assert.equal(relevant.some(event => (
    event.type === 'assign' && event.targets[0].expression === 'plain'
  )), false, 'a declaration without an initializer must not invent an assignment');
  assert.deepEqual(Array.from(relevant, event => event.source?.text), [
    'int n=0',
    'n = 0',
    'int … m=0',
    'm = 0',
    'int … plain'
  ]);
  assert.deepEqual(Array.from(relevant.filter(event => event.type === 'declare'), event => (
    Array.from(event.source?.ranges || [], range => range.role)
  )), [['type', 'declarator'], ['type', 'declarator'], ['type', 'declarator']]);
  assert.equal(new Set(relevant.map(event => event.source?.declaratorId)).size, 3,
    'each comma-separated declarator owns one declaration/initializer group');
});

test('visible sequence sources and insertion destinations are captured for value transfer', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> num = {8, 5, 3};
  vector<int> temp;
  int l = 1;
  // @frame num, temp
  temp.push_back(num[l]);
  // @frame num, temp
  temp.insert(temp.begin(), num[2]);
  // @frame num, temp
}`;
  const { trace } = await compile(source);
  const push = trace.frames[1].events.find(event => event.operation === 'push_back');
  const insert = trace.frames[2].events.find(event => event.operation === 'insert');
  assert.ok(push && insert);
  assert.deepEqual([
    push.payload.edge,
    push.payload.insertedValue?.value,
    push.targets.find(target => target.role === 'source')?.expression,
    push.targets.find(target => target.role === 'source')?.resolvedIndex
  ], ['back', 5, 'num[l]', 1]);
  assert.deepEqual([
    insert.payload.edge,
    insert.payload.insertIndex,
    insert.payload.insertedValue?.value,
    insert.targets.find(target => target.role === 'source')?.expression,
    insert.targets.find(target => target.role === 'source')?.resolvedIndex
  ], ['index', 0, 3, 'num[2]', 2]);
});

test('sequence insertion captures side-effecting source indices without replaying the update', async () => {
  const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> num = {4, 9, 7};
  vector<int> temp;
  int i = 1;
  // @frame num,temp
  temp.push_back(num[i++]);
  // @frame num,temp
}`;
  const { trace } = await compile(code);
  const push = trace.frames[1].events.find(event => (
    event.type === 'sequence-operation' && event.operation === 'push_back'
  ));
  const source = push?.targets?.find(target => target.role === 'source');
  assert.equal(source?.indexExpression, 'i++');
  assert.equal(source?.resolvedIndex, 1,
    'the transfer starts at the element selected before post-increment');
  const iId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'i');
  assert.equal(trace.frames[1].state[iId].data.value, 2,
    'capturing the visual index does not execute i++ a second time');
});

test('stack and queue push operations preserve their visual insertion edge and source', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> num = {4, 9};
  stack<int> pending;
  queue<int> ready;
  // @frame num, pending, ready
  pending.push(num[0]);
  ready.push(num[1]);
  pending.emplace(num[1]);
  // @frame num, pending, ready
}`;
  const { trace } = await compile(source);
  const pushes = trace.frames[1].events.filter(event => event.operation === 'push');
  assert.equal(pushes.length, 2);
  assert.deepEqual(Array.from(pushes, event => event.payload.edge), ['back', 'back']);
  assert.deepEqual(Array.from(pushes, event => event.payload.insertedValue?.value), [4, 9]);
  assert.deepEqual(Array.from(pushes, event => (
    event.targets.find(target => target.role === 'source')?.resolvedIndex
  )), [0, 1]);
  const emplace = trace.frames[1].events.find(event => event.operation === 'emplace');
  assert.equal(emplace?.payload?.insertedValue?.value, 9);
  assert.equal(emplace?.targets.find(target => target.role === 'source')?.resolvedIndex, 1);
});
