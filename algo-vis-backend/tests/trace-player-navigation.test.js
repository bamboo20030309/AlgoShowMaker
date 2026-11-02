/**
 * 測試模組：trace-player-navigation.test
 *
 * 驗證重點：trace player navigation.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function playerHarness(options = {}) {
  const harnessOptions = options;
  const renders = [];
  let cancellations = 0;
  let pauses = 0;
  const documentListeners = new Map();
  const windowListeners = new Map();
  const browserDocument = {
    hidden: false,
    body: { classList: { contains: () => false } },
    addEventListener: (name, callback) => documentListeners.set(name, callback),
    getElementById: () => ({
      getBoundingClientRect: () => ({ width: 800, height: 600 })
    })
  };
  const window = {
    document: browserDocument,
    ASMTraceModel: { normalizeTraceDocument: value => value, clone: value => structuredClone(value) },
    ASMTraceRenderers: {
      renderFrame: (document, frame, previousFrame, renderOptions) => {
        renders.push({ frame, previousFrame, options: renderOptions });
        const transition = Promise.resolve();
        if (previousFrame && harnessOptions.playbackPlans) {
          transition.playbackPlan = {
            id: `plan-${frame.id}`,
            phases: [{ id: 'frame-transition', startMs: 0, durationMs: 1000 }]
          };
        }
        return transition;
      }
    },
    ASMTraceFrameTween: { cancel() { cancellations += 1; } },
    ASMPlaybackNavigation: { pause() { pauses += 1; } },
    ASMTraceCamera: { apply() {}, transitionDuration: () => 0 },
    ASMTraceCodePresenter: { transitionDelay: () => 0 },
    dispatchEvent() {},
    requestAnimationFrame: callback => callback(),
    addEventListener: (name, callback) => windowListeners.set(name, callback)
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
  return { window, browserDocument, renders, cancellations: () => cancellations,
    pauses: () => pauses, documentListeners, windowListeners };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
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

test('next during playback settles the current frame before animating the following frame', async () => {
  const { window, renders, cancellations } = playerHarness({ playbackPlans: true });
  const first = window.CodeScript.next();
  const second = window.CodeScript.next();
  await Promise.all([first, second]);

  assert.deepEqual(renders.map(item => ({
    frame: item.frame.id,
    previous: item.previousFrame?.id || null,
    stable: item.options.animateEvents === false && item.options.animatePositions === false,
    interrupted: item.options.interruptedPlayback === true
  })), [
    { frame: 'f1', previous: 'f0', stable: false, interrupted: false },
    { frame: 'f1', previous: null, stable: true, interrupted: true },
    { frame: 'f2', previous: 'f1', stable: false, interrupted: false }
  ]);
  assert.equal(cancellations(), 1);
});

test('leaving the visible page cancels its active run and retains the destination as a stable frame', async () => {
  const { window, browserDocument, renders, documentListeners, pauses } = playerHarness({ playbackPlans: true });
  const transition = window.CodeScript.next();
  browserDocument.hidden = true;
  documentListeners.get('visibilitychange')();
  await transition;
  assert.equal(pauses(), 1);
  assert.equal(window.CodeScript.get_current_frame_index(), 1);
  assert.equal(renders.at(-1).frame.id, 'f1');
  assert.equal(renders.at(-1).previousFrame, null);
  assert.equal(renders.at(-1).options.pageLeave, true);
  assert.equal(renders.at(-1).options.animateEvents, false);
  const count = renders.length;
  browserDocument.hidden = false;
  documentListeners.get('visibilitychange')();
  assert.equal(renders.length, count, 'returning must not replay the abandoned transition');
});

test('pagehide settles the current destination even before document.hidden changes', async () => {
  const { window, renders, windowListeners, pauses } = playerHarness({ playbackPlans: true });
  const transition = window.CodeScript.next();
  windowListeners.get('pagehide')();
  await transition;
  assert.equal(pauses(), 1);
  assert.equal(renders.at(-1).frame.id, 'f1');
  assert.equal(renders.at(-1).options.animatePositions, false);
  assert.equal(window.ASMTracePlayer.getActivePlaybackPlan(), null);
});
