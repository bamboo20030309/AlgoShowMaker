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
      'window.ASMTraceFrameTween = { outerframeGeometry, applyOuterframeGeometry, parseColor, paintTransitionColors, relativeMotionDelta, outerframeGeometryLabel, alignedDirectRectGeometry, applyLeftAnchoredRectGeometry,');
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

test('heap cell follows its outerframe origin while sequence width opens to the right', () => {
  const window = setup();
  const namespace = 'http://www.w3.org/2000/svg';
  const previous = window.document.createElementNS(namespace, 'g');
  const beforeRect = window.document.createElementNS(namespace, 'rect');
  [['x', 20], ['y', 8], ['width', 40], ['height', 40]]
    .forEach(([name, value]) => beforeRect.setAttribute(name, String(value)));
  const beforeText = window.document.createElementNS(namespace, 'text');
  [['x', 40], ['y', 28], ['font-size', 12]]
    .forEach(([name, value]) => beforeText.setAttribute(name, String(value)));
  previous.append(beforeRect, beforeText);
  const current = window.document.createElementNS(namespace, 'g');
  const afterRect = window.document.createElementNS(namespace, 'rect');
  [['x', 0], ['y', 8], ['width', 80], ['height', 40]]
    .forEach(([name, value]) => afterRect.setAttribute(name, String(value)));
  const afterText = window.document.createElementNS(namespace, 'text');
  [['x', 40], ['y', 28], ['font-size', 16]]
    .forEach(([name, value]) => afterText.setAttribute(name, String(value)));
  current.append(afterRect, afterText);

  const geometry = window.ASMTraceFrameTween.alignedDirectRectGeometry(previous, current);
  window.ASMTraceFrameTween.applyLeftAnchoredRectGeometry(geometry, 0);
  assert.equal(Number(afterRect.getAttribute('width')), 40);
  assert.equal(Number(afterRect.getAttribute('x')), 0);
  assert.equal(Number(afterText.getAttribute('x')), 20);
  assert.equal(Number(afterText.getAttribute('y')), 28);
  assert.equal(Number(afterText.getAttribute('font-size')), 12);

  window.ASMTraceFrameTween.applyLeftAnchoredRectGeometry(geometry, 0.5);
  assert.equal(Number(afterRect.getAttribute('width')), 60);
  assert.equal(Number(afterRect.getAttribute('x')), 0);
  assert.equal(Number(afterText.getAttribute('x')), 30);
  assert.equal(Number(afterText.getAttribute('font-size')), 14);

  window.ASMTraceFrameTween.applyLeftAnchoredRectGeometry(geometry, 1);
  assert.equal(Number(afterRect.getAttribute('width')), 80);
  assert.equal(Number(afterRect.getAttribute('x')), 0);
  assert.equal(Number(afterText.getAttribute('x')), 40);
  assert.equal(Number(afterText.getAttribute('font-size')), 16);
});

test('recursive keep grows from its active parent center and retracts to the same point', () => {
  const tween = setup().ASMTraceFrameTween;
  const parent = {
    id: 'snapshot:parent:1', objectId: 'F', layoutId: 'fib_tree',
    recursionActivationId: 'call:1'
  };
  const child = {
    id: 'snapshot:child:1', objectId: 'F_1', layoutId: 'fib_tree',
    recursionActivationId: 'call:2', recursionParentActivationId: 'call:1'
  };
  const document = { snapshots: [parent, child] };
  const parentFrame = { snapshotIds: [parent.id] };
  const childFrame = { snapshotIds: [parent.id, child.id] };
  const parentPlacements = new Map([['F', { x: 100, y: 40, width: 80, height: 50 }]]);
  const childPlacements = new Map([
    ['F', { x: 70, y: 40, width: 80, height: 50 }],
    ['F_1', { x: 180, y: 130, width: 60, height: 30 }]
  ]);

  const forward = tween.recursionGrowthTransitions(
    document, parentFrame, childFrame, 1, parentPlacements, childPlacements
  );
  assert.deepEqual(JSON.parse(JSON.stringify(forward.entering.get('F_1').placement)), {
    x: 110, y: 50, width: 60, height: 30
  });
  assert.equal(forward.entering.get('F_1').parentKey, 'F');

  const reverse = tween.recursionGrowthTransitions(
    document, childFrame, parentFrame, -1, childPlacements, parentPlacements
  );
  assert.deepEqual(JSON.parse(JSON.stringify(reverse.retracting.get('F_1').placement)), {
    x: 110, y: 50, width: 60, height: 30
  });
});

test('recursive return replacement is not treated as a newly grown node', () => {
  const tween = setup().ASMTraceFrameTween;
  const pending = {
    id: 'snapshot:call:pending', objectId: 'F_1', layoutId: 'fib_tree',
    recursionActivationId: 'call:2', recursionParentActivationId: 'call:1'
  };
  const returned = {
    ...pending,
    id: 'snapshot:call:returned',
    replacesSnapshotId: pending.id
  };
  const document = { snapshots: [pending, returned] };
  const placement = new Map([['F_1', { x: 180, y: 130, width: 60, height: 30 }]]);
  const transition = tween.recursionGrowthTransitions(
    document,
    { snapshotIds: [pending.id] },
    { snapshotIds: [returned.id] },
    1,
    placement,
    placement
  );
  assert.equal(transition.entering.size, 0);
  assert.equal(transition.retracting.size, 0);
});
