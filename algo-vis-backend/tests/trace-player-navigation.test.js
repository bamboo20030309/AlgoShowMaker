const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function playerHarness() {
  const renders = [];
  const browserDocument = {
    hidden: false,
    body: { classList: { contains: () => false } },
    getElementById: () => ({
      getBoundingClientRect: () => ({ width: 800, height: 600 })
    })
  };
  const window = {
    document: browserDocument,
    ASMTraceModel: { normalizeTraceDocument: value => value, clone: value => structuredClone(value) },
    ASMTraceRenderers: {
      renderFrame: (document, frame, previousFrame, options) => {
        renders.push({ frame, previousFrame, options });
        return Promise.resolve();
      }
    },
    ASMTraceFrameTween: { cancel() {} },
    ASMTraceCamera: { apply() {}, transitionDuration: () => 0 },
    ASMTraceCodePresenter: { transitionDelay: () => 0 },
    dispatchEvent() {},
    requestAnimationFrame: callback => callback(),
    addEventListener() {}
  };
  const context = vm.createContext({
    window,
    document: browserDocument,
    CustomEvent: function CustomEvent(type, options) { this.type = type; this.detail = options?.detail; },
    ResizeObserver: undefined,
    setTimeout: callback => { callback(); return 1; },
    clearTimeout() {},
    console
  });
  vm.runInContext(
    fs.readFileSync(path.join(__dirname, '../public/trace-player.js'), 'utf8'),
    context
  );
  window.ASMTracePlayer.apply({
    frames: [{ id: 'f0', source: {} }, { id: 'f1', source: {} }, { id: 'f2', source: {} }]
  });
  renders.length = 0;
  return { window, browserDocument, renders };
}

test('previous and timeline navigation rebuild stable frames while next still animates', async () => {
  const { window, renders } = playerHarness();
  await window.CodeScript.next();
  assert.equal(renders.at(-1).previousFrame.id, 'f0');
  assert.equal(renders.at(-1).options.direction, 1);

  await window.CodeScript.prev();
  assert.equal(renders.at(-1).frame.id, 'f0');
  assert.equal(renders.at(-1).previousFrame, null);
  assert.equal(renders.at(-1).options.animateEvents, false);
  assert.equal(renders.at(-1).options.animatePositions, false);

  await window.CodeScript.next();
  assert.equal(renders.at(-1).previousFrame.id, 'f0',
    'forward navigation after previous can replay the forward animation');

  await window.CodeScript.goto(2);
  assert.equal(renders.at(-1).frame.id, 'f2');
  assert.equal(renders.at(-1).previousFrame, null);
  assert.equal(renders.at(-1).options.direction, 0);
});

test('navigation while hidden abandons animation and renders the latest stable frame', async () => {
  const { window, browserDocument, renders } = playerHarness();
  browserDocument.hidden = true;
  await window.CodeScript.next();
  assert.equal(renders.at(-1).frame.id, 'f1');
  assert.equal(renders.at(-1).previousFrame, null);
  assert.equal(renders.at(-1).options.animateEvents, false);
  assert.equal(renders.at(-1).options.animatePositions, false);
});
