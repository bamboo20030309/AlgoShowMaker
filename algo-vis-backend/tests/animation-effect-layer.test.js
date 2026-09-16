const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

test('only directly animated cells rise above ordinary objects, below style and arrows, then restore', () => {
  const dom = new JSDOM(`<!doctype html><html><body><svg>
    <g id="scene">
      <g id="first"><g id="first-before"/><g id="first-cell"/><g id="first-after"/></g>
      <g id="second"><g id="second-cell"/></g>
      <g class="asm-trace-style-layer" id="style"/>
      <g class="asm-trace-foreground-arrows" id="arrows"/>
    </g>
  </svg></body></html>`, { runScripts: 'outside-only' });
  const { window } = dom;
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'));
  const scene = window.document.getElementById('scene');
  const first = window.document.getElementById('first');
  const second = window.document.getElementById('second');
  const firstCell = window.document.getElementById('first-cell');
  const secondCell = window.document.getElementById('second-cell');
  firstCell.setAttribute('data-trace-index', '0');
  secondCell.setAttribute('data-trace-index', '0');
  const controller = window.ASMTraceFrameTween.createAnimationEffectLayer(scene);
  const order = () => [...scene.children].map(node => node.id || node.classList[0]);
  assert.deepEqual(order(), ['first', 'second', 'asm-trace-animation-effect-layer', 'style', 'arrows']);

  controller.sync([firstCell]);
  assert.equal(first.parentNode, scene, 'the array/object host stays in the ordinary layer');
  assert.equal(firstCell.parentNode.parentNode, controller.layer);
  assert.equal(firstCell.parentNode.classList.contains('asm-trace-animation-cell-host'), true);
  assert.deepEqual(order(), ['first', 'second', 'asm-trace-animation-effect-layer', 'style', 'arrows']);
  controller.sync([secondCell]);
  assert.equal(firstCell.parentNode, first);
  assert.equal(second.parentNode, scene, 'the second array/object host also stays put');
  assert.equal(secondCell.parentNode.parentNode, controller.layer);
  assert.deepEqual(order(), ['first', 'second', 'asm-trace-animation-effect-layer', 'style', 'arrows']);
  controller.sync([]);
  assert.deepEqual([...first.children].map(node => node.id),
    ['first-before', 'first-cell', 'first-after']);
  assert.equal(secondCell.parentNode, second);
  assert.deepEqual(order(), ['first', 'second', 'asm-trace-animation-effect-layer', 'style', 'arrows']);

  const popup = window.document.createElementNS('http://www.w3.org/2000/svg', 'g');
  popup.id = 'event-popup';
  scene.insertBefore(popup, window.document.getElementById('style'));
  controller.sync([]);
  assert.equal(popup.parentNode, controller.layer);
  popup.remove();
  controller.sync([]);
  assert.equal([...scene.childNodes].filter(node => node.nodeType === 8).length, 0);
  controller.sync([first, second]);
  assert.equal(first.parentNode, controller.layer);
  assert.equal(second.parentNode, controller.layer);
  controller.clear();
  assert.deepEqual(order(), ['first', 'second', 'asm-trace-animation-effect-layer', 'style', 'arrows']);
  assert.equal([...scene.childNodes].filter(node => node.nodeType === 8).length, 0);
});
