/**
 * 測試模組：camera-embed-parity.test
 *
 * 驗證重點：camera embed parity.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const canvaSource = fs.readFileSync(path.join(__dirname, '../public/canva.js'), 'utf8');

function element(tagName, rect = { width: 1280, height: 720 }) {
  const attributes = new Map();
  return {
    tagName,
    children: [],
    parentElement: { clientWidth: rect.width, clientHeight: rect.height },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    removeAttribute(name) { attributes.delete(name); },
    appendChild(child) { this.children.push(child); return child; },
    addEventListener() {},
    getBoundingClientRect() { return { ...rect, left: 0, top: 0 }; },
    querySelectorAll() { return []; }
  };
}

function cameraSurface(childHeight, topHeight) {
  const canvas = element('svg');
  const document = {
    documentElement: { clientHeight: childHeight },
    getElementById: id => id === 'arraySvg' ? canvas : null,
    createElementNS: (_namespace, tagName) => element(tagName),
    addEventListener(type, callback) { if (type === 'DOMContentLoaded') callback(); }
  };
  const context = vm.createContext({
    document,
    innerHeight: childHeight,
    top: { document: { documentElement: { clientHeight: topHeight } }, innerHeight: topHeight },
    addEventListener() {},
    requestAnimationFrame: callback => { callback(0); return 1; },
    cancelAnimationFrame() {},
    setTimeout: callback => { callback(); return 1; },
    clearTimeout() {},
    performance: { now: () => 0 }
  });
  context.window = context;
  vm.runInContext(canvaSource, context);
  return { context, canvas };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('each canvas keeps the original viewport-relative camera scale', () => {
  const editor = cameraSurface(650, 900);
  const runtime = cameraSurface(720, 900);

  editor.context.setCamera(100, 200, 0.92, false);
  runtime.context.setCamera(100, 200, 0.92, false);

  assert.ok(Math.abs(editor.context.getScale() - 0.92 * 650 / 900) < 1e-12);
  assert.ok(Math.abs(runtime.context.getScale() - 0.92 * 720 / 900) < 1e-12);
  const renderedScale = surface => Number(
    surface.canvas.children[1].getAttribute('transform').match(/scale\(([^)]+)\)/)?.[1]
  );
  assert.ok(Math.abs(renderedScale(editor) - 0.92 * 650 / 900) < 1e-12);
  assert.ok(Math.abs(renderedScale(runtime) - 0.92 * 720 / 900) < 1e-12);
});
