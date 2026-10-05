/**
 * 測試模組：mobile-ui.test
 *
 * 驗證重點：mobile ui.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

const source = fs.readFileSync(path.join(__dirname, '../public/mobile-ui.js'), 'utf8');
const css = fs.readFileSync(path.join(__dirname, '../public/mobile-ui.css'), 'utf8');

function mobileDom(markup, prepare) {
  const dom = new JSDOM(`<!doctype html><body>${markup}</body>`, {
    runScripts: 'outside-only',
    url: 'http://localhost/'
  });
  const media = {
    matches: true,
    addEventListener() {}
  };
  dom.window.matchMedia = () => media;
  dom.window.requestAnimationFrame = callback => {
    callback();
    return 1;
  };
  prepare?.(dom.window);
  dom.window.eval(source);
  return dom;
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('mobile CSS is isolated behind a mobile breakpoint', () => {
  assert.match(css, /@media \(max-width: 760px\)/);
  assert.match(css, /body\.asm-trace-studio-open:has\(#arraySvg\)/);
  assert.match(css, /body\.asm-mobile-slide-tools-open\.asm-edit-mode:has\(#slidesRoot\)/);
});

test('algorithm mobile dock switches between canvas and collapsible code', () => {
  const dom = mobileDom(`
    <div id="arraySvg"></div>
    <div id="codePanel" class="collapsed"></div>
    <div id="subTabs"><button class="tab-btn" data-tab="tab-canvas"></button><button class="tab-btn" data-tab="tab-input"></button></div>
    <button id="algoSamplesBtn"></button><button id="editAnimationBtn"></button><button id="eventSettingsBtn"></button>
  `);
  const { document } = dom.window;
  document.querySelector('[data-mobile-action="code"]').click();
  assert.ok(document.body.classList.contains('asm-mobile-code-open'));
  assert.ok(!document.getElementById('codePanel').classList.contains('collapsed'));
  document.querySelector('[data-mobile-action="canvas"]').click();
  assert.ok(!document.body.classList.contains('asm-mobile-code-open'));
  assert.equal(document.querySelectorAll('.asm-mobile-extra-tab').length, 3);
});

test('mobile algorithm editor enables native long-press clipboard handling', () => {
  const optionCalls = [];
  const sessionListeners = {};
  let sourceValue = 'int main() {}';
  const dom = mobileDom(`
    <div id="arraySvg"></div>
    <div id="editor"></div>
    <div id="subTabs"></div>
  `, window => {
    window.document.getElementById('editor').env = {
      editor: {
        getValue: () => sourceValue,
        on(name, listener) { sessionListeners[name] = listener; },
        setOption(name, value) {
          optionCalls.push([name, value]);
        },
        session: {
          markUndoGroup() {},
          getLength: () => sourceValue.split('\n').length,
          getLine: row => sourceValue.split('\n')[row],
          replace(_range, value) { sourceValue = value; sessionListeners.change?.(); },
          on(name, listener) {
            sessionListeners[name] = listener;
          },
          setValue(value) {
            sourceValue = value;
            sessionListeners.change?.();
          }
        },
        selection: { setSelectionRange() {} }
      }
    };
  });
  const textInput = dom.window.document.querySelector('.asm-mobile-code-input');
  assert.deepEqual(optionCalls, [['enableMobileMenu', false]]);
  assert.ok(dom.window.document.body.classList.contains('asm-mobile-ui'));
  assert.equal(textInput.value, 'int main() {}');
  textInput.value = 'int answer = 42;';
  textInput.dispatchEvent(new dom.window.Event('input'));
  assert.equal(sourceValue, 'int answer = 42;');
});

test('slides mobile dock keeps editor tools in an explicit bottom sheet', () => {
  const dom = mobileDom('<div id="slidesRoot"></div><button id="modeToggleBtn"></button>');
  const { document } = dom.window;
  document.body.classList.add('asm-edit-mode');
  document.querySelector('[data-mobile-action="tools"]').click();
  assert.ok(document.body.classList.contains('asm-mobile-slide-tools-open'));
  document.querySelector('[data-mobile-action="canvas"]').click();
  assert.ok(!document.body.classList.contains('asm-mobile-slide-tools-open'));
});
