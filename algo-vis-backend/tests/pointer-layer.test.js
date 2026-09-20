const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('pointer hosts stay above styles and are not lifted into the cell effect layer', () => {
  const dom = new JSDOM('<svg><g id="root"><g id="arr"><g class="asm-trace-style-layer asm-trace-segment-layer"/></g><g id="pointer" class="asm-trace-bound-object"><g class="trace-variable-marker-point"/></g><g class="asm-trace-animation-effect-layer"/><g class="asm-trace-style-layer"/><g class="asm-trace-foreground-arrows"/></g></svg>', { runScripts: 'outside-only' });
  const { window } = dom;
  for (const file of ['trace-renderer.js', 'trace-frame-tween.js']) {
    window.eval(fs.readFileSync(path.join(__dirname, '../public', file), 'utf8'));
  }
  const root = window.document.getElementById('root');
  const pointer = window.document.getElementById('pointer');
  window.ASMTraceRenderers.settlePointerLayer(root);
  const layer = root.querySelector('.asm-trace-pointer-layer');
  assert.equal(pointer.parentNode, layer);
  assert.equal(root.children[0].id, 'arr');
  assert.ok([...root.children].indexOf(layer) > [...root.children].indexOf(root.children[0]));
  assert.equal(layer.previousElementSibling.classList.contains('asm-trace-style-layer'), true);
  assert.equal(layer.nextElementSibling.classList.contains('asm-trace-foreground-arrows'), true);
  const effects = window.ASMTraceFrameTween.createAnimationEffectLayer(root);
  effects.sync([pointer]);
  assert.equal(pointer.parentNode, layer);
  effects.clear();
});
