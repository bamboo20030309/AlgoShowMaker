/**
 * 固定畫面規則的獨立答案入口。
 * snapshot 必須來自實際 DOM；contract 由 fixture 的人工推導提供，
 * 不接受 forwardReplay／renderer 計畫作為答案。未要求的規則不推測，
 * 已要求但缺少樣本、位置或指標一律失敗，不讓空資料通過。
 */
'use strict';

function validateBehavior(snapshot, contract) {
  const violations = [];
  const fail = (rule, expected, actual) => violations.push({ rule, expected, actual });
  const markers = snapshot?.markers || [];
  const marker = label => markers.filter(item => item.label === label);
  const single = label => {
    const found = marker(label);
    if (found.length !== 1) {
      fail('pointer-presence', { label, count: 1 }, { count: found.length });
      return null;
    }
    return found[0];
  };

  // 解算式使用固定整數答案；視覺節點 key 可以有不同的 variable ID。
  for (const [label, index] of Object.entries(contract.bindings || {})) {
    const item = single(label);
    if (item && !String(item.binding || '').endsWith('#' + index)) {
      fail('pointer-index', { label, index }, item.binding);
    }
  }

  // 同一錨點的左右排列依作者 arr[...] 順序。只在已穩定的定點使用，
  // 不套用到交換進行中的路徑，也不要求不同錨點保持全域左右次序。
  for (const labels of contract.orders || []) {
    const items = labels.map(single);
    if (items.some(item => !item)) continue;
    if (items.some(item => !Number.isFinite(item.x))
      || items.some((item, i) => i > 0 && item.x <= items[i - 1].x)) {
      fail('pointer-authored-order', labels, items.map(item => item.x));
    }
  }

  // 比較動作使用同一 canvas 座標系；較大值的標籤應高於較小值。
  // y 往下為正；答案由固定輸入提供，不能由已交換的 SVG 數值反推。
  if (contract.comparison) {
    const { leftLabel, rightLabel, leftValue, rightValue } = contract.comparison;
    const left = single(leftLabel), right = single(rightLabel);
    if (left && right) {
      if (![left.x, left.y, right.x, right.y].every(Number.isFinite)) {
        fail('comparison-geometry', 'finite canvas coordinates', { left, right });
      } else {
        if (left.x >= right.x) fail('comparison-binding', 'left operand stays left', { left, right });
        const direction = Math.sign(leftValue - rightValue);
        if (direction && (right.y - left.y) * direction <= 1) {
          fail('comparison-direction', contract.comparison, { left, right });
        }
      }
    }
  }

  // 完成畫面需保留指定物件；明確的 visibility 契約不同於「所有變數永不退場」。
  for (const key of contract.visible || []) {
    const opacity = snapshot?.visibility?.[key];
    if (!Number.isFinite(opacity) || opacity < 0.99) fail('required-visibility', key, opacity);
  }
  for (const [key, expected] of Object.entries(contract.values || {})) {
    const actual = snapshot?.values?.[key];
    if (actual == null || String(actual) !== String(expected)) fail('fixed-value', { key, expected }, actual);
  }
  return { pass: !violations.length, firstViolation: violations[0] || null, violations };
}

module.exports = { validateBehavior };
