const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');

test('Euler sieve second frame replays chained data updates and only the declared background', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int n=60;
vector<int> isprime(n+5,1);
vector<int> prime;
void prime_table() {
  isprime[0]=isprime[1]=0;
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  // @style isprime[1] background rgba(223,127,255)
  // @style isprime[1] highlight
}
int main() {
  // @frame
  // @object isprime with range(1,n), columns(10), labels(index)
  // @object prime with columns(10), labels(value)
  // @place prime.top-left at isprime.bottom-left offset(0,60)
  prime_table();
}`);
  const isprimeId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'isprime');
  assert.equal(trace.frames.length, 2);
  assert.equal(window.ASMTraceModel.scalarValue(trace.frames[0].state[isprimeId].data.items[1]), 1);
  assert.equal(window.ASMTraceModel.scalarValue(trace.frames[1].state[isprimeId].data.items[1]), 0);
  const assignments = trace.frames[1].events.filter(event => event.type === 'assign');
  assert.deepEqual(Array.from(assignments, event => event.targets?.[0]?.resolvedIndex), [1, 0]);
  assert.equal(assignments[0].payload.before.value, 1);
  assert.equal(assignments[0].payload.after.value, 0);
  assert.ok(assignments[0].order < assignments[1].order);
  const highlights = window.ASMTraceRules.evaluate(trace, trace.frames[1])[isprimeId];
  assert.equal(highlights['1'].styleTypes.background, 'rgba(223,127,255)');
  assert.equal(highlights['51']?.styleTypes.background, undefined);
});

test('@style supports mixed index and range segments', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 5, 7, 2, 1, 9, 4};
  int i = 1;
  // @frame arr[i] render heap with range(1,6)
  // @style arr[i] point red
  // @style arr[i,i*2:i*2+1] highlight red
  return 0;
}`);
  const frame = trace.frames[0];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const mixed = frame.styles.find(style => style.styleType === 'highlight');
  const point = frame.styles.find(style => style.styleType === 'point');
  assert.equal(mixed.selector.type, 'segments');
  assert.deepEqual(
    JSON.parse(JSON.stringify(mixed.selector.segments)),
    [
      { type: 'index', indexExpression: 'i' },
      {
        type: 'range', startExpression: 'i*2', endExpression: 'i*2+1', endInclusive: true
      }
    ]
  );
  const highlights = window.ASMTraceRules.evaluate(trace, frame)[arrId];
  assert.deepEqual(Object.keys(highlights).sort(), ['1', '2', '3']);
  for (const index of ['1', '2', '3']) {
    assert.equal(highlights[index].styleTypes.highlight, 'red');
  }
  assert.equal(highlights['1'].styleTypes.point, 'red');
  assert.equal(highlights['1'].sourceStyleIds.highlight, mixed.id);
  assert.equal(highlights['1'].sourceStyleIds.point, point.id);
  assert.notEqual(highlights['1'].sourceStyleIds.highlight, highlights['1'].sourceStyleIds.point);
});

test('@style keeps single index and single colon range selectors compatible', async () => {
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1, 2, 3};
  int i = 0;
  // @frame arr
  // @style arr[i] point red
  // @style arr[i:i+1] highlight red
  return 0;
}`);
  assert.deepEqual(
    Array.from(trace.frames[0].styles, style => style.selector.type),
    ['index', 'range']
  );
});

test('@style focus accepts multiple segments and an omitted default color', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 5, 7, 2, 1, 9, 4};
  int i = 2;
  int n = 6;
  // @frame arr render heap with range(1,n)
  // @style arr[1:i,i+2:n] focus
  // @style arr[i:i+1] focus AV_red
  return 0;
}`);
  const frame = trace.frames[0];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const [defaultFocus, redFocus] = frame.styles.filter(style => style.styleType === 'focus');
  assert.equal(defaultFocus.color, 'AV_grey');
  assert.equal(defaultFocus.selector.type, 'segments');
  assert.equal(redFocus.color, 'AV_red');

  const highlights = window.ASMTraceRules.evaluate(trace, frame)[arrId];
  assert.deepEqual(Object.keys(highlights).sort(), ['1', '2', '3', '4', '5', '6']);
  assert.equal(highlights['1'].styleTypes.focus, '#cccccc');
  assert.equal(highlights['2'].styleTypes.focus, 'rgba(239, 154, 154, 0.6)');
  assert.equal(highlights['3'].styleTypes.focus, 'rgba(239, 154, 154, 0.6)');
  assert.equal(highlights['4'].styleTypes.focus, '#cccccc');
  assert.equal(highlights['6'].styleTypes.focus, '#cccccc');
});

test('@style recognizes AV_grey as the grey palette alias', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {0, 5, 7, 2};
  // @frame arr
  // @style arr[1:2] focus AV_grey
  return 0;
}`);
  const frame = trace.frames[0];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  const highlights = window.ASMTraceRules.evaluate(trace, frame)[arrId];
  assert.equal(highlights['1'].styleTypes.focus, '#cccccc');
  assert.equal(highlights['2'].styleTypes.focus, '#cccccc');
});

test('@style allows all five styles without a color and preserves draw defaults', async () => {
  const { trace, window } = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {1, 2, 3, 4, 5};
  // @frame arr
  // @style arr[0] background when value > 0
  // @style arr[1] highlight
  // @style arr[2] focus
  // @style arr[3] mark
  // @style arr[4] point
  return 0;
}`);
  const frame = trace.frames[0];
  const arrId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
  assert.deepEqual(Array.from(frame.styles, style => style.styleType),
    ['background', 'highlight', 'focus', 'mark', 'point']);
  assert.deepEqual(Array.from(frame.styles, style => style.color),
    ['', '', 'AV_grey', '', '']);
  const evaluated = window.ASMTraceRules.evaluate(trace, frame)[arrId];
  assert.ok(Object.hasOwn(evaluated['0'].styleTypes, 'background'));
  assert.ok(Object.hasOwn(evaluated['1'].styleTypes, 'highlight'));
  assert.equal(evaluated['2'].styleTypes.focus, '#cccccc');
  assert.ok(Object.hasOwn(evaluated['3'].styleTypes, 'mark'));
  assert.ok(Object.hasOwn(evaluated['4'].styleTypes, 'point'));
});
