/**
 * 測試模組：range-for-variables.integration.test
 *
 * 驗證重點：range for variables.integration.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { analyzeSource, findFrameDirectives } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const source = `
#include <vector>
int main() {
  int i = 2;
  std::vector<int> isprime(8, 1);
  std::vector<int> prime = {2, 3};
  for (auto& v : prime) {
    // @frame isprime
    // @style isprime[i*v] highlight red
    isprime[i*v] = 0;
  }
  // @frame isprime
  return 0;
}`;

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('range-for variables resolve inside @style and leave scope after the loop', () => {
  const analysis = analyzeSource(source);
  const variable = analysis.variables.find(item => item.name === 'v');
  assert.ok(variable);
  assert.equal(variable.functionName, 'main');
  assert.equal(variable.kind, 'scalar');
  assert.equal(variable.declarationKind, 'local');
  const frames = findFrameDirectives(source, analysis);
  assert.equal(frames.length, 2);
  assert.ok(frames[0].captureOnlyVariableIds.includes(variable.id));
  assert.ok(!frames[1].captureOnlyVariableIds.includes(variable.id));

  const outside = source.replace('  // @frame isprime\n  return 0;',
    '  // @frame isprime\n  // @style isprime[i*v] highlight red\n  return 0;');
  assert.throws(() => findFrameDirectives(outside), /@style 找不到可見變數：v/);
});

test('range-for value, const-reference and structured bindings are collected', () => {
  for (const header of [
    'for (auto v : prime)', 'for (const auto& v : prime)', 'for (int v : prime)'
  ]) {
    const code = `void f(){ int prime[2] = {2,3}; ${header} { // @frame prime[v]\n } }`;
    const variable = analyzeSource(code).variables.find(item => item.name === 'v');
    assert.ok(variable, header);
    assert.equal(variable.functionName, 'f');
    assert.equal(findFrameDirectives(code).length, 1);
  }
  const structured = analyzeSource(`
#include <utility>
void f(){ std::pair<int,int> pairs[1]; for(auto&& [x,y] : pairs) { // @frame pairs\n } }`);
  assert.ok(structured.variables.some(item => item.name === 'x'));
  assert.ok(structured.variables.some(item => item.name === 'y'));
});

test('nested range-for loops resolve the nearest variable with the same name', () => {
  const code = `
#include <vector>
void f() {
  std::vector<int> prime = {2, 3};
  for (auto v : prime) {
    for (auto& v : prime) {
      // @frame prime
      // @style prime[v] highlight red
    }
  }
}`;
  const variables = analyzeSource(code).variables.filter(item => item.name === 'v');
  assert.equal(variables.length, 2);
  const [frame] = findFrameDirectives(code);
  assert.ok(frame.captureOnlyVariableIds.includes(variables[1].id));
  assert.ok(!frame.captureOnlyVariableIds.includes(variables[0].id));
});

test('range-for variable values are captured across iterations without leaking past the loop', async () => {
  const { trace } = await compile(source);
  const variable = Object.values(trace.variables).find(item => item.name === 'v');
  const array = Object.values(trace.variables).find(item => item.name === 'isprime');
  assert.ok(variable);
  assert.ok(array);
  const loopFrames = trace.frames.filter(frame => frame.state?.[variable.id]);
  assert.deepEqual(Array.from(loopFrames, frame => frame.state[variable.id].data.value), [2, 3]);
  assert.ok(!trace.frames.at(-1).state?.[variable.id]);
  const values = trace.frames.at(-1).state[array.id].data.items.map(item => item.value);
  assert.equal(values[4], 0);
  assert.equal(values[6], 0);
});
