const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function element(name) {
  const attributes = new Map();
  const classes = new Set();
  return {
    name,
    children: [],
    style: {},
    dataset: {},
    classList: { add: value => classes.add(value), contains: value => classes.has(value) },
    setAttribute(key, value) { attributes.set(key, String(value)); },
    getAttribute(key) { return attributes.get(key) ?? null; },
    appendChild(child) { this.children.push(child); return child; },
    querySelector(selector) {
      if (!selector.startsWith('#')) return null;
      return this.children.find(child => child.getAttribute('id') === selector.slice(1)) || null;
    }
  };
}

test('every point and highlight joins one shared wall-clock phase', () => {
  let now = 250;
  const context = vm.createContext({
    window: { performance: { timeOrigin: 1000, now: () => now } },
    document: { createElementNS: (namespace, name) => element(name) },
    CSS: { escape: value => String(value) },
    Date
  });
  context.window.window = context.window;
  context.window.document = context.document;
  context.window.CSS = context.CSS;
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/draw/draw_array_hintWidget.js'), 'utf8'
  ), context);

  const group = element('g');
  context.window.HintWidgets.drawArrow(group, 20, 40, 'red', 'point-a', -20, 12, 8, null, 'style-point-a');
  const first = group.children[0];
  assert.equal(first.style.animationDelay, '-250ms');
  assert.equal(first.dataset.tracePresentationClock, 'global');
  assert.equal(first.classList.contains('arrow-bounce'), true);

  now = 750;
  context.window.HintWidgets.drawArrow(group, 24, 40, 'red', 'point-a', -20, 12, 8, null, 'style-point-a');
  assert.equal(group.children[0], first);
  assert.equal(first.style.animationDelay, '-250ms', 'moving an existing point does not restart its loop');

  const rebuiltGroup = element('g');
  context.window.HintWidgets.drawArrow(rebuiltGroup, 24, 40, 'red', 'point-a-next-frame', -20, 12, 8, null, 'style-point-a');
  assert.equal(rebuiltGroup.children[0].style.animationDelay, '-750ms',
    'a rebuilt point joins the current global phase');

  context.window.HintWidgets.drawArrow(group, 60, 40, 'red', 'point-b', -20, 12, 8, null, 'style-point-b');
  assert.equal(group.children[1].style.animationDelay, '-750ms',
    'a different point joins the same global phase instead of starting independently');

  now = 900;
  context.window.HintWidgets.drawHighlightBox(group, 0, 0, 40, 40, 'red', 'highlight-a', null, 'style-highlight-a');
  assert.equal(group.children[2].style.animationDelay, '-900ms');
  assert.equal(group.children[2].classList.contains('highlight-blink'), true);
  const highlight = group.children[2];
  now = 1150;
  context.window.HintWidgets.drawHighlightBox(group, 80, 20, 60, 48, 'green', 'highlight-a', null, 'style-highlight-a');
  assert.equal(group.children[2], highlight);
  assert.equal(highlight.style.animationDelay, '-900ms', 'moving/resizing/recoloring does not restart highlight');
  assert.equal(highlight.getAttribute('height'), '48');
  const rebuiltHighlights = element('g');
  context.window.HintWidgets.drawHighlightBox(rebuiltHighlights, 80, 20, 60, 48, 'green', 'highlight-rebuilt', null, 'style-highlight-a');
  assert.equal(rebuiltHighlights.children[0].style.animationDelay, '-150ms', 'rebuilt highlight joins the current global phase');
});

test('every array SVG root receives point and highlight animation definitions', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '../public/draw/draw_array.js'), 'utf8'
  );
  assert.doesNotMatch(source, /if\s*\(\s*!initedDefs\s*\)/);
  assert.match(source, /const vp = window\.getViewport\(\);[\s\S]*?ensureDefs\(\);/);

  const traceCss = fs.readFileSync(
    path.join(__dirname, '../public/trace.css'), 'utf8'
  );
  assert.match(traceCss, /\.arrow-bounce\s*\{[\s\S]*?animation:\s*arrow-bounce 1s infinite ease-in-out/);
  assert.match(traceCss, /\.highlight-blink\s*\{[\s\S]*?animation:\s*blink-stroke 1s infinite/);
  assert.match(traceCss, /\.asm-trace-style-paint\s*\{\s*transition: fill 180ms ease, stroke 180ms ease;/);
  assert.match(traceCss, /prefers-reduced-motion: reduce/);

  const tweenSource = fs.readFileSync(
    path.join(__dirname, '../public/trace-frame-tween.js'), 'utf8'
  );
  assert.match(tweenSource, /function syncPresentationHints\(/);
  assert.match(tweenSource, /syncPresentationHints\(overlay\)/);
  assert.match(tweenSource, /syncPresentationHints\(clone\)/);
  assert.match(tweenSource, /Promise\.allSettled\(paintTransitions\.map\(animation => animation\.finished\)\)/,
    'playback waits for finite paint transitions, not infinite hint loops');
});
