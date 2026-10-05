'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { validateBehavior } = require('../scripts/trace-behavior-rules');
const check = (snapshot, contract) => validateBehavior(snapshot, contract);

test('j=1 means j+1 points to index 2, never string-concatenated index 11', () => {
  const contract = { bindings: { 'j+1': 2 } };
  assert.equal(check({ markers: [{ label: 'j+1', binding: 'main:arr#2' }] }, contract).pass, true);
  assert.equal(check({ markers: [{ label: 'j+1', binding: 'main:arr#11' }] }, contract).firstViolation.rule, 'pointer-index');
});
test('required pointer cannot silently disappear or exist twice', () => {
  const contract = { bindings: { min_idx: 0 } };
  assert.equal(check({ markers: [] }, contract).firstViolation.rule, 'pointer-presence');
  const marker = { label: 'min_idx', binding: 'arr#0' };
  assert.equal(check({ markers: [marker, marker] }, contract).firstViolation.rule, 'pointer-presence');
});
test('authored order changes when arr[min_idx,i] becomes arr[i,min_idx]', () => {
  const snapshot = { markers: [{ label: 'min_idx', x: 10 }, { label: 'i', x: 30 }] };
  assert.equal(check(snapshot, { orders: [['min_idx', 'i']] }).pass, true);
  assert.equal(check(snapshot, { orders: [['i', 'min_idx']] }).firstViolation.rule, 'pointer-authored-order');
});
test('missing geometry and coincident labels cannot pass an order contract', () => {
  for (const x of [undefined, NaN, 10]) {
    assert.equal(check({ markers: [{ label: 'i', x: 10 }, { label: 'j', x }] },
      { orders: [['i', 'j']] }).pass, false);
  }
});
test('i++ must update the next-round binding, while reverse seek restores zero', () => {
  const at = index => ({ markers: [{ label: 'i', binding: 'arr#' + index }] });
  assert.equal(check(at(1), { bindings: { i: 1 } }).pass, true);
  assert.equal(check(at(0), { bindings: { i: 1 } }).pass, false);
  assert.equal(check(at(0), { bindings: { i: 0 } }).pass, true);
});
test('8 > 7 lifts the left label; 2 < 5 lifts the right label', () => {
  const comparison = { leftLabel: 'j', rightLabel: 'j+1', leftValue: 8, rightValue: 7 };
  const snapshot = { markers: [{ label: 'j', x: 0, y: -6 }, { label: 'j+1', x: 40, y: 6 }] };
  assert.equal(check(snapshot, { comparison }).pass, true);
  assert.equal(check(snapshot, { comparison: { ...comparison, leftValue: 2, rightValue: 5 } }).firstViolation.rule, 'comparison-direction');
});
test('correct lift cannot excuse pointers attached to swapped operands', () => {
  const comparison = { leftLabel: 'j', rightLabel: 'j+1', leftValue: 8, rightValue: 7 };
  assert.equal(check({ markers: [{ label: 'j', x: 40, y: -6 }, { label: 'j+1', x: 0, y: 6 }] },
    { comparison }).firstViolation.rule, 'comparison-binding');
});
test('equal operands do not impose a lift direction; missing samples still fail', () => {
  const comparison = { leftLabel: 'a', rightLabel: 'b', leftValue: 3, rightValue: 3 };
  assert.equal(check({ markers: [{ label: 'a', x: 0, y: 0 }, { label: 'b', x: 40, y: 0 }] }, { comparison }).pass, true);
  assert.equal(check({}, { comparison }).pass, false);
  assert.equal(check({ markers: [{ label: 'a', x: 0 }, { label: 'b', x: 40 }] }, { comparison }).pass, false);
});
test('final arr must remain painted, including transparent or missing inner wrappers', () => {
  const contract = { visible: ['arr'] };
  assert.equal(check({ visibility: { arr: 1 } }, contract).pass, true);
  for (const opacity of [undefined, NaN, 0, 0.5]) {
    assert.equal(check({ visibility: { arr: opacity } }, contract).firstViolation.rule, 'required-visibility');
  }
});
test('fixed scalar answers reject wrong values and missing data', () => {
  const contract = { values: { sum: 6 } };
  assert.equal(check({ values: { sum: '6' } }, contract).pass, true);
  assert.equal(check({ values: { sum: 7 } }, contract).firstViolation.rule, 'fixed-value');
  assert.equal(check({}, contract).pass, false);
});
