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
        setOption(name, value) {
          optionCalls.push([name, value]);
        },
        session: {
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
