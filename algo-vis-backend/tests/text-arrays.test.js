const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives } = require('../trace-instrumenter');
const { compile, load } = require('./helpers/compile');
const source = fs.readFileSync(path.join(__dirname, 'fixtures/text-arrays.cpp'), 'utf8');

function rules() {
  const context = vm.createContext({});
  context.window = context;
  load(context, 'trace-model.js');
  load(context, 'trace-rules.js');
  return context.ASMTraceRules;
}
const scalar = value => ({ kind: 'scalar', value });
const sequence = values => ({ kind: 'sequence', items: values.map(scalar) });

test('text array slices capture base and endpoint variables, including preset and drawing locals', () => {
  const frames = findFrameDirectives(source);
  const full = frames[0];
  assert.ok(full.variables.some(variable => variable.name === 'prime'));
  assert.ok(full.captureOnlyVariableIds.length > 0);
  assert.equal(full.texts.find(text => text.id === 'slice').segments[0].expression, 'prime[1:2]');
  const completed = frames.find(frame => frame.texts.some(text => text.id === 'completed'));
  assert.deepEqual(completed.texts.find(text => text.id === 'completed').segments[0].identifiers, ['prime']);
  assert.ok(completed.texts.find(text => text.id === 'row').drawLoops.length);
  const code = 'int main(){int a[4]={};int lo=1,hi=2;\n// @frame a\n// @text "\${a[lo:hi]}"\n}';
  assert.deepEqual(findFrameDirectives(code)[0].texts[0].segments[0].identifiers, ['a','lo','hi']);
});

test('text formatting handles whole, nested, empty and string arrays while preserving scalar text', () => {
  const r = rules();
  const frame = { state: {
    prime: { data: sequence([2,3,5,7]) },
    matrix: { data: { items: [sequence([2,3]), sequence([5,7])] } },
    words: { data: sequence(['a','b']) },
    empty: { data: sequence([]) },
    factor: { data: scalar(11) }
  } };
  for (const [expression, expected] of [
    ['prime','[2,3,5,7]'], ['matrix','[[2,3],[5,7]]'], ['matrix[1][:]','[5,7]'],
    ['words','["a","b"]'], ['empty','[]'], ['factor','11'], ['prime[2]','5'],
    ['factor*prime[1]','33'], ['missing','']
  ]) assert.equal(r.resolveTextExpression({}, frame, expression), expected, expression);
  assert.equal(r.resolveTextExpression({}, frame, 'matrix[k][0:1]', { k: 1 }), '[5,7]');
  assert.equal(r.resolveExpression({}, frame, 'prime[0:2]'), null, 'slice syntax stays text-only');
});

test('inclusive text slice bounds are clipped without negative indexing, mutation or invalid coercion', () => {
  const r = rules(), frame = { state: { prime: { data: sequence([2,3,5,7]) } } };
  const before = JSON.stringify(frame);
  for (const [expression, expected] of [
    ['prime[1:2]','[3,5]'], ['prime[:]','[2,3,5,7]'], ['prime[:1]','[2,3]'],
    ['prime[2:]','[5,7]'], ['prime[-5:99]','[2,3,5,7]'], ['prime[3:1]','[]'],
    ['prime[7:99]','[]'], ['prime[0:-1]','[]'], ['prime[0.5:2]',''],
    ['prime[0:missing]',''], ['prime[0:1:2]','']
  ]) assert.equal(r.resolveTextExpression({}, frame, expression), expected, expression);
  assert.equal(JSON.stringify(frame), before);
});

test('malformed text slices fail analysis instead of capturing partial expressions', () => {
  for (const expression of ['a[0:1:2]', 'a[]', 'a[0:1']) {
    assert.throws(() => findFrameDirectives('int main(){int a[4]={};\n// @frame a\n// @text "\${' + expression + '}"\n}'), /運算式無效/);
  }
});

test('compiled array texts use each frame snapshot and completed loop bounds after JSON reload', async () => {
  const { trace, window } = await compile(source);
  const r = window.ASMTraceRules;
  assert.equal(r.resolveTextExpression(trace, trace.frames[0], 'prime'), '[2,3,5,7]');
  assert.equal(r.resolveTextExpression(trace, trace.frames.at(-1), 'prime'), '[2,3,5,7,11]');
  const completed = trace.frames.filter(frame => frame.texts.some(text => text.id === 'completed'));
  assert.deepEqual(Array.from(completed, frame => r.resolveTextExpression(trace, frame, 'prime[0:iteration.last(j)]')), ['[2,3]', '[2,3,5]']);
  const reloaded = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  const reloadFrames = reloaded.frames.filter(frame => frame.texts.some(text => text.id === 'completed'));
  assert.deepEqual(Array.from(reloadFrames, frame => r.resolveTextExpression(reloaded, frame, 'prime[0:iteration.last(j)]')), ['[2,3]', '[2,3,5]']);
});
