const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

class Matrix {
  constructor(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) {
    Object.assign(this, { a, b, c, d, e, f });
  }
  multiply(other) {
    return new Matrix(
      this.a * other.a + this.c * other.b,
      this.b * other.a + this.d * other.b,
      this.a * other.c + this.c * other.d,
      this.b * other.c + this.d * other.d,
      this.a * other.e + this.c * other.f + this.e,
      this.b * other.e + this.d * other.f + this.f
    );
  }
  inverse() {
    const determinant = this.a * this.d - this.b * this.c;
    return new Matrix(this.d / determinant, -this.b / determinant,
      -this.c / determinant, this.a / determinant,
      (this.c * this.f - this.d * this.e) / determinant,
      (this.b * this.e - this.a * this.f) / determinant);
  }
}

test('style decorations paint between objects and arrows and follow a scaled, resized cell', () => {
  const dom = new JSDOM(`<!doctype html><html><body><svg>
    <g id="asm-trace-root">
      <g id="object"><g id="cell"><rect x="10" y="5" width="40" height="30"/></g>
        <rect id="hint" x="10" y="5" width="40" height="42" class="highlight-blink"/>
      </g>
      <g class="asm-trace-foreground-arrows"><path id="arrow"/></g>
    </g></svg></body></html>`, { runScripts: 'outside-only' });
  const { window } = dom;
  const root = window.document.getElementById('asm-trace-root');
  const object = window.document.getElementById('object');
  const cell = window.document.getElementById('cell');
  const hint = window.document.getElementById('hint');
  const rect = cell.querySelector('rect');
  let cellMatrix = new Matrix();
  root.getScreenCTM = () => new Matrix();
  object.getScreenCTM = () => new Matrix();
  cell.getScreenCTM = () => cellMatrix;
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-renderer.js'), 'utf8'));

  assert.equal(window.ASMTraceRenderers.attachStyleVisual(hint, cell, 'highlight'), true);
  const layer = root.querySelector('.asm-trace-style-layer');
  assert.ok(layer);
  assert.deepEqual([...root.children].map(element => element.id || element.classList[0]),
    ['object', 'asm-trace-style-layer', 'asm-trace-foreground-arrows']);
  assert.equal(hint.closest('.asm-trace-style-layer'), layer);
  assert.equal(layer.getAttribute('pointer-events'), 'none');
  assert.equal(hint.classList.contains('highlight-blink'), true);

  cellMatrix = new Matrix(1.5, 0, 0, 1.5, 100, 20);
  rect.setAttribute('width', '60');
  cell.setAttribute('opacity', '0.4');
  window.ASMTraceRenderers.refreshArrows();
  const wrapper = layer.firstElementChild;
  assert.equal(wrapper.getAttribute('transform'), 'matrix(1.5 0 0 1.5 100 20)');
  assert.equal(wrapper.getAttribute('opacity'), '0.4');
  assert.equal(hint.getAttribute('width'), '60');
  assert.equal(hint.getAttribute('height'), '42');

  cell.setAttribute('display', 'none');
  window.ASMTraceRenderers.refreshArrows();
  assert.equal(wrapper.getAttribute('display'), 'none');
  hint.remove();
  window.ASMTraceRenderers.refreshArrows();
  assert.equal(layer.childElementCount, 0);
});
