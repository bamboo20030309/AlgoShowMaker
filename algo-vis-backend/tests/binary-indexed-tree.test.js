/**
 * 測試模組：binary-indexed-tree.test
 *
 * 驗證重點：binary indexed tree.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives } = require('../trace-instrumenter');
const { load } = require('./helpers/compile');

const buildSamplePath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree_Build.cpp');
const buildInputPath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree_Build-sample_input.txt');
const querySamplePath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree_Range_Query.cpp');
const queryInputPath = path.join(__dirname, '../algorithm_sample/Tree/Binary_Indexed_Tree_Range_Query-sample_input.txt');

function rulesContext() {
  const context = vm.createContext({ queueMicrotask() {} });
  context.window = context;
  load(context, 'trace-model.js');
  load(context, 'trace-rules.js');
  return context;
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('directive expressions parse and evaluate C++ bitwise precedence', () => {
  const [frame] = findFrameDirectives(`int main() {
    int i = 12, mask = 5;
    int arr[32] = {};
    // @frame arr
    // @pointer i & -i at arr
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

test('@let creates frame-local read-only aliases without C++ variables', () => {
  const source = `// @preset view
// @object arr
// @let lb = i & -i
// @let left = i - lb + 1
// @let deduct = left == 1
// @style arr[left:i] background AV_blue
// @text "range \${left}~\${i}" at arr.top
// @endpreset
int main() {
  int i = 4;
  int arr[8] = {};
  // @frame use view
}`;
  const [frame] = findFrameDirectives(source);
  assert.deepEqual(frame.lets.map(binding => ({ name: binding.name, expression: binding.expression })), [
    { name: 'lb', expression: 'i & -i' },
    { name: 'left', expression: 'i - lb + 1' },
    { name: 'deduct', expression: 'left == 1' }
  ]);
  const i = frame.variables.find(variable => variable.name === 'i');
  assert.ok(i && frame.captureOnlyVariableIds.includes(i.id));
  assert.equal(frame.variables.some(variable => variable.name === 'lb' || variable.name === 'left'), false);

  const context = rulesContext();
  const document = { variables: { [i.id]: { name: 'i' } } };
  const runtimeFrame = {
    lets: frame.lets,
    state: { [i.id]: { data: { kind: 'scalar', value: 4 } } }
  };
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'lb'), 4);
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'left'), 1);
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'deduct'), true);
  assert.equal(context.ASMTraceRules.resolveTextExpression(document, runtimeFrame, 'i + lb'), '8');

  assert.throws(() => findFrameDirectives(source.replace('@let left = i - lb + 1', '@let lb = 2')),
    /@let 名稱重複/);
  assert.throws(() => findFrameDirectives(source.replace('@let lb = i & -i', '@let lb = missing')),
    /@let 找不到可見變數或先前別名/);
});

test('@let cell text supports ternary strings, concatenation and independent frame text', () => {
  const source = `int main() {
  int board[4] = {};
  int n = 1, N = 4, L = 2, M = 2, R = 2;
  // @frame board with display("\${cell_text}")
  // @let cell_text = (value == 1 ? '♕' : '') + (row == n && (L & (1 << (N - 1 - column))) ? '↙' : '') + (row == n && (M & (1 << (N - 1 - column))) ? '↓' : '') + (row == n && (R & (1 << (N - 1 - column))) ? '↘' : '')
  // @let wrapped = '[' + cell_text + ']'
}`;
  const [frame] = findFrameDirectives(source);
  const document = { variables: Object.fromEntries(frame.variables.map(variable => [variable.id, variable])) };
  const values = { n: 1, N: 4, L: 2, M: 2, R: 2 };
  const runtimeFrame = { lets: frame.lets, state: Object.fromEntries(frame.variables
    .filter(variable => variable.name in values)
    .map(variable => [variable.id, { data: { kind: 'scalar', value: values[variable.name] } }])) };
  const context = rulesContext();
  const resolve = (expression, locals = {}) => context.ASMTraceRules.resolveExpression(document, runtimeFrame, expression, locals, true);
  assert.equal(resolve('cell_text', { value: 0, row: 1, column: 2 }), '↙↓↘');
  assert.equal(resolve('wrapped', { value: 0, row: 1, column: 2 }), '[↙↓↘]');
  assert.equal(resolve('cell_text', { value: 1, row: 0, column: 2 }), '♕');
  assert.equal(resolve('cell_text', { value: 0, row: 0, column: 0 }), '');
  assert.equal(resolve('n'), 1, 'frame text still resolves without cell locals');
  assert.equal(resolve('cell_text'), null, 'cell aliases do not invent missing coordinates');
  assert.equal(resolve('1 + 2'), 3);
  assert.equal(resolve("'column ' + 2"), 'column 2');
  assert.equal(resolve("'(' + '+' + '*' + ')'"), '(+*)', 'quoted operator glyphs are literal content');
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'cell_text',
    { value: 0, row: 1, column: 2 }), '↙↓↘', 'aliases also resolve outside the text-only entry point');
  assert.equal(frame.variables.some(variable => variable.name === 'cell_text'), false);
  assert.throws(() => findFrameDirectives(source.replace("(value == 1 ? '♕' : '')", 'unknown(value)')),
    /@let 運算式無效/);
});

test('@let resolves string size and character subscripts', () => {
  const context = rulesContext();
  const document = { variables: { text: { name: 'text' } } };
  const runtimeFrame = {
    lets: [
      { name: 'last', expression: 'text.size() - 1' },
      { name: 'same', expression: 'text[1] == text[last]' }
    ],
    state: { text: { name: 'text', data: { kind: 'scalar', value: 'aba' } } }
  };
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'last'), 2);
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'text[0]'), 'a');
  assert.equal(context.ASMTraceRules.resolveExpression(document, runtimeFrame, 'same'), false);
});

test('Binary Indexed Tree build and query samples are separate two-object examples', () => {
  const buildCode = fs.readFileSync(buildSamplePath, 'utf8');
  const queryCode = fs.readFileSync(querySamplePath, 'utf8');
  for (const code of [buildCode, queryCode]) {
    assert.doesNotMatch(code, /AV\.hpp|\bAV\s+av\b|frame_draw|start_draw|end_draw|_draw_|@keep|long long/);
    assert.match(code, /@object num with labels\(value,index\)/);
    assert.doesNotMatch(code, /@object num[^\n]*\brange\(/);
    assert.match(code, /@object BIT(?:\[i\])? render binary indexed tree/);
    assert.match(code, /@style num\[0\] background AV_grey/);
    assert.match(code, /num\.resize\(n \+ 1\)/);
    assert.match(code, /for \(int i = 1; i <= n; i\+\+\) cin >> num\[i\];/);
    assert.match(code, /@place num\.left-bottom at BIT\.left-top offset\(-40,-70\)/);
    assert.doesNotMatch(code, /\bint l\s*=/);
    assert.match(code, /@let lb = i & -i/);
    assert.doesNotMatch(code, /\bint lb\b/);
    assert.deepEqual(
      [...new Set(Array.from(code.matchAll(/@object\s+([A-Za-z_]\w*)/g), match => match[1]))].sort(),
      ['BIT', 'num']
    );
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
  }

  const buildBody = buildCode.match(/void build\(int i\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(buildBody, /@style num\[k\] highlight/);
  assert.match(buildCode,
    /@style BIT\[1:n\] focus when index >= k && index - \(index & -index\) < k/);
  assert.doesNotMatch(buildBody, /@style num\[[^\n]+\] background/);
  assert.match(buildBody, /for \(; i <= n; i \+= i & -i\)/);
  assert.match(buildCode, /BIT\[i\] \+= num\[k\];/);
  assert.doesNotMatch(buildCode, /int sum\(int i\)/);

  const sumBody = queryCode.match(/int sum\(int i\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(sumBody, /for \(; i > 0; i -= i & -i\)/);
  assert.match(queryCode, /@let start = iteration\.first\(i\)/);
  assert.match(queryCode,
    /@style BIT\[1:n\] focus when index <= start && index \+ \(index & -index\) > start/);
  assert.match(sumBody, /@style num\[i-lb\+1:i\] background AV_green when !deduct/);
  assert.match(sumBody, /@style num\[i-lb\+1:i\] background AV_red when deduct/);
  assert.match(queryCode, /num\[\$\{i-lb\+1\}~\$\{i\}\]/);
  assert.match(queryCode, /@let deduct = start == L - 1/);
  assert.doesNotMatch(queryCode, /(?:^|\n)\s*(?:bool\s+deduct|deduct\s*=)/);
  assert.match(queryCode, /int sumR = sum\(R\);\s*int sumL = sum\(L - 1\);/);
  assert.match(queryCode, /while \(cin >> L >> R\)/);
  assert.match(sumBody, /@text "所有數字總和為 \$\{ans\}" as sum_total/);
  assert.match(sumBody,
    /@style BIT\[1:n\] background AV_green when !deduct && index <= start/);
  assert.match(sumBody,
    /@style BIT\[1:n\] background AV_red when deduct && index <= start/);
  assert.doesNotMatch(queryCode, /下一個索引/);
  assert.doesNotMatch(queryCode, /void build\(int i\)/);
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
  // @frame arr
  // @pointer i & -i at arr
  arr[i & -i] += 7;
  // @frame arr
  // @pointer i & -i at arr
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

test('Binary Indexed Tree build and query samples preserve their results', async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const buildCode = fs.readFileSync(buildSamplePath, 'utf8');
  const buildInput = fs.readFileSync(buildInputPath, 'utf8');
  const queryCode = fs.readFileSync(querySamplePath, 'utf8');
  const queryInput = fs.readFileSync(queryInputPath, 'utf8');
  async function compileSample(code, input) {
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
    return result;
  }

  const buildResult = await compileSample(buildCode, buildInput);
  assert.equal(buildResult.output.trim(), '5 12 2 15 9 13 11 54 8 14');
  const result = await compileSample(queryCode, queryInput);
  assert.equal(result.output.trim(), 'sum of L to R = 25');

  const trace = result.traceDocument;
  const byName = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  assert.ok(trace.frames.length >= 4, 'query sample generates the two prefix-sum teaching paths');
  assert.ok(trace.frames.every(frame => frame.renderers?.[byName.BIT] === 'original-bit'));
  assert.ok(trace.frames.every(frame => frame.rendererOptions?.[byName.BIT]?.indexMode === 4));
  assert.ok(trace.frames.every(frame => frame.rendererOptions?.[byName.num]?.indexMode === 1));
  assert.equal(trace.frames.at(-1).state[byName.num].data.items.length, 11);
  assert.equal(Number(trace.frames.at(-1).state[byName.num].data.items[0].value), 0);
  assert.deepEqual(trace.frames.at(-1).state[byName.BIT].data.items.slice(1).map(item => Number(item.value)),
    [5, 12, 2, 15, 9, 13, 11, 54, 8, 14]);
  const buildTrace = buildResult.traceDocument;
  const buildByName = Object.fromEntries(Object.entries(buildTrace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const bitWrites = buildTrace.frames.flatMap(frame => frame.events || []).filter(event => (
    event.type === 'write' && event.compound === true
      && event.targets?.some(target => target.role === 'target' && target.variableId === buildByName.BIT)
  ));
  assert.ok(bitWrites.length > 0);
  assert.ok(bitWrites.every(event => {
    const source = event.targets.find(target => target.role === 'source');
    return source?.variableId === buildByName.num
      && Number.isInteger(source.resolvedIndex)
      && source.resolvedIndex >= 1
      && source.resolvedIndex <= 10;
  }), 'every BIT compound assignment keeps its visible num[k] source cell');
  assert.ok(buildTrace.frames.filter(frame => frame.source?.function === 'build')
    .every(frame => frame.bindings.some(binding => (
      binding.targetName === 'BIT' && binding.indexExpression === 'i'
    ))));
  assert.ok(trace.frames.filter(frame => frame.source?.function === 'sum'
      && frame.bindings.some(binding => binding.indexExpression === 'i'))
    .every(frame => frame.bindings.some(binding => (
      binding.targetName === 'BIT' && binding.indexExpression === 'i'
    ))));
});
