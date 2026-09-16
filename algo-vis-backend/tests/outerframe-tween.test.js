const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');

function setup() {
  const dom = new JSDOM('<!doctype html><html><body><svg id="scene"></svg></body></html>', {
    runScripts: 'outside-only'
  });
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8')
    .replace('window.ASMTraceFrameTween = {',
      'window.ASMTraceFrameTween = { outerframeGeometry, applyOuterframeGeometry, parseColor, paintTransitionColors, relativeMotionDelta, outerframeGeometryLabel,');
  dom.window.eval(source);
  return dom.window;
}

function frame(window, x, y, width, height) {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = window.document.querySelector('#scene');
  const object = window.document.createElementNS(namespace, 'g');
  const group = window.document.createElementNS(namespace, 'g');
  const bg = window.document.createElementNS(namespace, 'rect');
  bg.setAttribute('class', 'outerframe-bg');
  const nb = window.document.createElementNS(namespace, 'rect');
  nb.setAttribute('class', 'outerframe-nb');
  const label = window.document.createElementNS(namespace, 'text');
  label.setAttribute('class', 'outerframe-label');
  const cell = window.document.createElementNS(namespace, 'rect');
  cell.setAttribute('class', 'cell');
  cell.setAttribute('width', '40');
  [['x', x], ['y', y], ['width', width], ['height', height]].forEach(([key, value]) => {
    bg.setAttribute(key, String(value));
  });
  [['x', x], ['y', y + height - 24], ['width', width], ['height', 24]]
    .forEach(([key, value]) => nb.setAttribute(key, String(value)));
  label.setAttribute('x', String(x + width / 2));
  label.setAttribute('y', String(y + height - 12));
  [['left', x], ['top', y], ['right', x + width], ['bottom', y + height]]
    .forEach(([key, value]) => group.setAttribute(`data-outerframe-${key}`, String(value)));
  group.append(bg, nb, label, cell);
  object.append(group);
  svg.append(object);
  return { object, group, bg, nb, label, cell };
}

test('outerframe bounds, name area and label resize together without changing cells', () => {
  const window = setup();
  const tween = window.ASMTraceFrameTween;
  const previous = frame(window, 0, 0, 120, 72);
  const current = frame(window, 20, 10, 200, 112);
  const before = tween.outerframeGeometry(previous.object);
  const after = tween.outerframeGeometry(current.object);

  tween.applyOuterframeGeometry(after, before, 0);
  assert.equal(Number(current.bg.getAttribute('width')), 120);
  assert.equal(Number(current.bg.getAttribute('x')), 0);
  assert.equal(Number(current.label.getAttribute('x')), 60);
  assert.equal(Number(current.cell.getAttribute('width')), 40);

  tween.applyOuterframeGeometry(after, before, 0.5);
  assert.equal(Number(current.bg.getAttribute('width')), 160);
  assert.equal(Number(current.bg.getAttribute('height')), 92);
  assert.equal(Number(current.bg.getAttribute('x')), 10);
  assert.equal(Number(current.nb.getAttribute('y')), 73);
  assert.equal(Number(current.label.getAttribute('x')), 90);
  assert.equal(Number(current.group.getAttribute('data-outerframe-right')), 170);
  assert.equal(Number(current.cell.getAttribute('width')), 40);

  tween.applyOuterframeGeometry(after, before, 1);
  assert.equal(Number(current.bg.getAttribute('width')), 200);
  assert.equal(Number(current.group.getAttribute('data-outerframe-bottom')), 122);
});

test('outerframe can shrink and later ticks still use the captured final geometry', () => {
  const window = setup();
  const tween = window.ASMTraceFrameTween;
  const previous = frame(window, 0, 0, 240, 112);
  const current = frame(window, 0, 0, 80, 72);
  const before = tween.outerframeGeometry(previous.object);
  const after = tween.outerframeGeometry(current.object);
  tween.applyOuterframeGeometry(after, before, 0.25);
  assert.equal(Number(current.bg.getAttribute('width')), 200);
  tween.applyOuterframeGeometry(after, before, 0.75);
  assert.equal(Number(current.bg.getAttribute('width')), 120);
  tween.applyOuterframeGeometry(after, after, 1);
  assert.equal(Number(current.bg.getAttribute('width')), 80);
});

test('invalid SVG paint does not resolve to black and none fades from the real color', () => {
  const window = setup();
  const context = {
    value: '#000000',
    get fillStyle() { return this.value; },
    set fillStyle(value) {
      if (value === 'red') this.value = '#ff0000';
      else if (/^#[\da-f]{6}$/i.test(value)) this.value = value;
    }
  };
  window.HTMLCanvasElement.prototype.getContext = () => context;
  const tween = window.ASMTraceFrameTween;
  assert.equal(tween.parseColor('none'), null);
  assert.equal(tween.parseColor('AV_unknown'), null);
  assert.deepEqual(JSON.parse(JSON.stringify(tween.parseColor('red'))),
    { r: 255, g: 0, b: 0, a: 1 });
  const [from, to] = tween.paintTransitionColors(
    { fill: 'none', opacity: 1 }, { fill: 'red', opacity: 1 }
  );
  assert.deepEqual([from.r, from.g, from.b, from.a], [255, 0, 0, 0]);
  assert.deepEqual([to.r, to.g, to.b, to.a], [255, 0, 0, 1]);
});

test('outerframe label inherits parent motion while its x/y follows frame geometry', () => {
  const window = setup();
  const tween = window.ASMTraceFrameTween;
  const previous = frame(window, 0, 0, 120, 72);
  const current = frame(window, 20, 10, 200, 112);
  assert.equal(tween.outerframeGeometryLabel(current.label), true);
  const delta = tween.relativeMotionDelta({ x: -40, y: -20 }, { x: 0, y: 0 }, {
    lockToTarget: tween.outerframeGeometryLabel(current.label)
  });
  assert.deepEqual(JSON.parse(JSON.stringify(delta)), { x: 0, y: 0 });
  tween.applyOuterframeGeometry(
    tween.outerframeGeometry(current.object), tween.outerframeGeometry(previous.object), 0.5
  );
  assert.equal(Number(current.label.getAttribute('x')), 90);
  assert.equal(Number(current.label.getAttribute('y')), 85);
});
