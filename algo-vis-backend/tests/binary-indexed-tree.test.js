const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives } = require('../trace-instrumenter');
const { load } = require('./helpers/compile');

const samplePath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree-sample_input.txt');

function rulesContext() {
  const context = vm.createContext({ queueMicrotask() {} });
  context.window = context;
  load(context, 'trace-model.js');
  load(context, 'trace-rules.js');
  return context;
}

test('directive expressions parse and evaluate C++ bitwise precedence', () => {
  const [frame] = findFrameDirectives(`int main() {
    int i = 12, mask = 5;
    int arr[32] = {};
    // @frame arr[i & -i]
    // @style arr[(i >> 1):(i | mask)] background AV_green when (mask & 1) != 0
  }`);
  assert.equal(frame.bindings[0].indexExpression, 'i & -i');
  assert.equal(frame.styles[0].selector.startExpression, '(i >> 1)');
  assert.equal(frame.styles[0].selector.endExpression, '(i | mask)');
  assert.equal(frame.styles[0].when.expression, '(mask & 1) != 0');

  const context = rulesContext();
  const document = { variables: {
    i: { name: 'i' }, mask: { name: 'mask' }
  } };
  const state = value => ({ data: { kind: 'scalar', value } });
  const runtimeFrame = { state: { i: state(12), mask: state(5) } };
  const evaluate = expression => context.ASMTraceRules.resolveExpression(document, runtimeFrame, expression);
  assert.equal(evaluate('i & -i'), 4);
  assert.equal(evaluate('1 << 2 + 1'), 8, 'addition binds before shift');
  assert.equal(evaluate('16 >> 1 + 1'), 4, 'addition binds before shift');
  assert.equal(evaluate('1 | 2 ^ 3 & 1'), 3, 'and, xor and or use C++ precedence');
  assert.equal(evaluate('~0'), -1);
  assert.equal(evaluate('(mask & 1) != 0'), true);
});

test('Binary Indexed Tree sample only uses the two new-directive objects', () => {
  const code = fs.readFileSync(samplePath, 'utf8');
  assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw|_draw_|@keep|long long/);
  assert.match(code, /@object num with labels\(value,index\)/);
  assert.doesNotMatch(code, /@object num[^\n]*\brange\(/);
  assert.match(code, /@object BIT(?:\[i\])? render binary indexed tree/);
  assert.match(code, /@style num\[0\] background AV_grey/);
  assert.match(code, /num\.resize\(n \+ 1\)/);
  assert.match(code, /for \(int i = 1; i <= n; i\+\+\) cin >> num\[i\];/);
  assert.match(code, /@place num\.left-bottom at BIT\.left-top offset\(-40,-70\)/);
  const buildBody = code.match(/void build\(int i\) \{([\s\S]*?)\n\}/)?.[1] || '';
  const sumBody = code.match(/int sum\(int i\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(buildBody, /@style num\[k\] highlight/);
  assert.doesNotMatch(buildBody, /@style num\[[^\n]+\] background/);
  assert.doesNotMatch(code, /\bint l\s*=/);
  assert.match(sumBody, /@style num\[i-lb\+1:i\] background AV_blue/);
  assert.match(code, /num\[\$\{i-lb\+1\}~\$\{i\}\]/);
  assert.doesNotMatch(code, /\$\{l\}\.\.\$\{i\}/);
  assert.deepEqual(
    [...new Set(Array.from(code.matchAll(/@object\s+([A-Za-z_]\w*)/g), match => match[1]))].sort(),
    ['BIT', 'num']
  );
  assert.match(code, /void build\(int i\)/);
  assert.match(code, /int k = i;/);
  assert.match(buildBody, /for \(; i <= n; i \+= i & -i\)/);
  assert.match(code, /BIT\[i\] \+= num\[k\];/);
  assert.match(code, /int sum\(int i\)/);
  assert.match(sumBody, /for \(; i > 0; i -= i & -i\)/);
  assert.match(code, /int lb = i & -i;/);

  const frames = findFrameDirectives(code);
  assert.ok(frames.length > 0);
  assert.ok(frames.every(frame => frame.objects.length === 2));
  assert.ok(frames.every(frame => frame.objects.some(object => object.renderer === 'original-bit')));
  assert.ok(frames.every(frame => frame.objects.find(object => object.primaryName === 'num')
    ?.rendererOptions.labels?.indexFormat === 'decimal'));
  assert.ok(frames.every(frame => frame.objects.find(object => object.primaryName === 'BIT')
    ?.rendererOptions.labels?.indexFormat === 'binary-padded'));
  assert.ok(frames.every(frame => frame.placeBindings.some(binding => (
    binding.sourceName === 'num' && binding.targetName === 'BIT'
      && binding.sourceAnchor === 'bottom-left' && binding.anchor === 'top-left'
      && binding.offsetX === -40 && binding.offsetY === -70
  ))));
  assert.ok(frames.flatMap(frame => frame.styles)
    .filter(style => style.styleType === 'highlight' || style.styleType === 'point')
    .every(style => !style.color), 'highlight and point keep their default colors');
});

test('Binary Indexed Tree renderer accepts its full name and legacy aliases', () => {
  for (const renderer of ['binary indexed tree', 'binary-indexed-tree', 'binary_indexed_tree', 'bit', 'fenwick']) {
    const [frame] = findFrameDirectives(`int main() {
      int tree[3] = {};
      // @frame tree render ${renderer} with range(1,2), labels(value,binary-index-padded)
    }`);
    assert.equal(frame.objects[0].renderer, 'original-bit');
    assert.equal(frame.objects[0].rendererOptions.labels.indexFormat, 'binary-padded');
  }
});

test('bitwise array indices retain their resolved write target', async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr(9, 0);
  int i = 12;
  // @frame arr[i & -i]
  arr[i & -i] += 7;
  // @frame arr[i & -i]
}`;
  const analyzeResponse = await fetch(base + '/trace/analyze', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code })
  });
  const analysis = await analyzeResponse.json();
  assert.equal(analyzeResponse.ok, true, JSON.stringify(analysis));
  const watches = [...new Set(analysis.frameDirectives.flatMap(frame => frame.variableIds))];
  const compileResponse = await fetch(base + '/compile', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      code, input: '', trace: { enabled: true, watches, sliceMode: 'manual' }
    })
  });
  const result = await compileResponse.json();
  assert.equal(compileResponse.ok, true, JSON.stringify(result));
  assert.equal(result.error, '', result.error);
  const arrId = Object.entries(result.traceDocument.variables)
    .find(([, variable]) => variable.name === 'arr')?.[0];
  const write = result.traceDocument.frames.flatMap(frame => frame.events || [])
    .find(event => event.type === 'write' && event.targets?.some(target => target.variableId === arrId));
  assert.ok(write, 'compound write event is captured');
  assert.equal(write.targets.find(target => target.variableId === arrId).resolvedIndex, 4);
});

test('Binary Indexed Tree sample preserves point updates and range-sum output', async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(samplePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');
  const analyzeResponse = await fetch(base + '/trace/analyze', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ code })
  });
  const analysis = await analyzeResponse.json();
  assert.equal(analyzeResponse.ok, true, JSON.stringify(analysis));
  const watches = [...new Set(analysis.frameDirectives.flatMap(frame => frame.variableIds))];
  const compileResponse = await fetch(base + '/compile', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({
      code, input, trace: { enabled: true, watches, sliceMode: 'manual' }
    })
  });
  const result = await compileResponse.json();
  assert.equal(compileResponse.ok, true, JSON.stringify(result));
  assert.equal(result.error, '', result.error);
  assert.equal(result.output.trim(), 'sum of L to R = 42');

  const trace = result.traceDocument;
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  assert.ok(trace.frames.length > 20, 'build and sum loops generate teaching frames');
  assert.ok(trace.frames.every(frame => frame.renderers?.[byName.BIT] === 'original-bit'));
  assert.ok(trace.frames.every(frame => frame.rendererOptions?.[byName.BIT]?.indexMode === 4));
  assert.ok(trace.frames.every(frame => frame.rendererOptions?.[byName.num]?.indexMode === 1));
  assert.equal(trace.frames.at(-1).state[byName.num].data.items.length, 11);
  assert.equal(Number(trace.frames.at(-1).state[byName.num].data.items[0].value), 0);
  assert.deepEqual(trace.frames.at(-1).state[byName.BIT].data.items.slice(1).map(item => Number(item.value)),
    [5, 12, 2, 15, 9, 13, 11, 54, 8, 14]);
  const bitWrites = trace.frames.flatMap(frame => frame.events || []).filter(event => (
    event.type === 'write' && event.compound === true
      && event.targets?.some(target => target.role === 'target' && target.variableId === byName.BIT)
  ));
  assert.ok(bitWrites.length > 0);
  assert.ok(bitWrites.every(event => {
    const source = event.targets.find(target => target.role === 'source');
    return source?.variableId === byName.num
      && Number.isInteger(source.resolvedIndex)
      && source.resolvedIndex >= 1
      && source.resolvedIndex <= 10;
  }), 'every BIT compound assignment keeps its visible num[k] source cell');
  assert.ok(trace.frames.filter(frame => ['build', 'sum'].includes(frame.source?.function))
    .every(frame => frame.bindings.some(binding => (
      binding.targetName === 'BIT' && binding.indexExpression === 'i'
    ))));
});
