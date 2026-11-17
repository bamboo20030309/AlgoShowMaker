'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');
const plain = data => Array.isArray(data?.items) ? Array.from(data.items, plain) : data?.value ?? data;

test('container events retain insertion/deletion indices, one assign, and actual move source state', { timeout: 90000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const previous = process.env.ASM_TEST_BASE_URL;
  let result;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    result = await compile(`#include <bits/stdc++.h>
using namespace std;
int main(){
 int cursor=1,inserted=9,resizes=0;
 vector<int> a={1,2},b={3,8,5};
 // @frame a,b
 a=b;
 // @frame a,b
 a.insert(a.begin()+1,inserted++);
 // @frame a,b
 a.erase(a.begin()+cursor++);
 // @frame a,b
 a.resize(5+0*(++resizes),6);
 // @frame a,b
 a.clear();
 // @frame a,b
 a.assign(3,7);
 // @frame a,b
 a=move(b);
 // @frame a,b,cursor,inserted,resizes
}`);
  } finally {
    if (previous === undefined) delete process.env.ASM_TEST_BASE_URL;
    else process.env.ASM_TEST_BASE_URL = previous;
  }
  const { trace, window } = result;
  const state = (frame, name) => plain(Object.values(frame.state).find(entry => entry.name === name)?.data);
  assert.deepEqual(Array.from(trace.frames, frame => state(frame, 'a')), [
    [1,2],[3,8,5],[3,9,8,5],[3,8,5],[3,8,5,6,6],[],[7,7,7],[3,8,5]
  ]);
  const insertion = trace.frames[2].events.find(event => event.operation === 'insert');
  const deletion = trace.frames[3].events.find(event => event.operation === 'erase');
  const resize = trace.frames[4].events.find(event => event.operation === 'resize');
  const clear = trace.frames[5].events.find(event => event.operation === 'clear');
  for (const [event, before, after] of [
    [insertion,[3,8,5],[3,9,8,5]],
    [deletion,[3,9,8,5],[3,8,5]],
    [resize,[3,8,5],[3,8,5,6,6]],
    [clear,[3,8,5,6,6],[]]
  ]) {
    assert.deepEqual(plain(event.payload.before), before, `${event.operation} has the complete pre-operation cells`);
    assert.deepEqual(plain(event.payload.after), after, `${event.operation} has the complete post-operation cells`);
  }
  assert.deepEqual([insertion.payload.edge,insertion.payload.insertIndex,insertion.payload.beforeSize,insertion.payload.afterSize], ['index',1,3,4]);
  assert.equal(plain(insertion.payload.insertedValue), 9);
  assert.deepEqual([deletion.payload.edge,deletion.payload.removeIndex,deletion.payload.removeCount,deletion.payload.beforeSize,deletion.payload.afterSize], ['index',1,1,4,3]);
  assert.equal(deletion.payload.insertedValue, null);
  assert.equal(state(trace.frames[7], 'cursor'), 2, 'erase iterator expression executes once');
  assert.equal(state(trace.frames[7], 'inserted'), 10, 'insert value expression executes once');
  assert.equal(state(trace.frames[7], 'resizes'), 1, 'resize argument executes once');
  const assign = trace.frames[6].events.filter(event => event.type === 'assign');
  assert.equal(assign.length, 1);
  assert.deepEqual(plain(assign[0].payload.before), []);
  assert.deepEqual(plain(assign[0].payload.after), [7,7,7]);
  assert.equal(trace.frames[6].events.some(event => event.type === 'call'), false);
  const move = trace.frames[7].events.find(event => event.type === 'assign');
  assert.equal(move.move, true);
  assert.equal(move.semantics.kind, 'move');
  assert.deepEqual(plain(move.payload.source), [3,8,5]);
  assert.deepEqual(plain(move.payload.sourceAfter), state(trace.frames[7], 'b'), 'record the actual moved-from state without assuming empty');
  const source = move.targets.find(target => target.role === 'source');
  assert.equal(trace.variables[source.variableId].name, 'b');
  trace.studio.eventSettings ||= {};
  trace.studio.eventSettings.defaultEnabled = { assign: false };
  const reopened = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.equal(reopened.frames[7].events.find(event => event.type === 'assign').enabled, false);
});
