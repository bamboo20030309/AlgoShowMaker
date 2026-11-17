/**
 * 測試模組：studio-event-availability.test
 *
 * 驗證重點：左側「事件動畫」標籤的事件文字與事件可用性通知。
 *   - 物件入場／退場的標籤與摘要顯示受影響的物件，而非 frame 指令文字。
 *   - 大量可用性通知合併成下一個動畫幀的一次重畫，且只在目前幀受影響時重畫事件按鈕。
 *   - 設定標籤沒有顯示、或通知屬於舊文件時，不排程任何工作；取消會清掉待處理的 frame ID。
 * 執行環境：Node.js 單元／契約測試，以 vm 載入真正的 trace-studio.js，只替換 DOM 與渲染邊界。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function studioHarness(count = 200) {
  const listeners = new Map();
  const scheduled = new Map();
  const counters = { inspector: 0 };
  let nextId = 1;
  let visible = true;
  const trace = { frames: Array.from({ length: count }, (_, i) => ({
    id: `frame-${i}`, events: [{ autoAnimationDisabled: false }]
  })) };
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    ASMTraceEvents: { labels: {
      'visual-enter': '物件入場',
      'visual-exit': '物件退場'
    } }
  };
  const document = {
    readyState: 'complete',
    addEventListener() {},
    querySelectorAll: () => [],
    getElementById: () => null,
    body: { classList: { contains: () => false } }
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-studio.js'), 'utf8')
    .replace('window.ASMTraceStudio = {', `window.testStudio = {
      configure(value, calls, isVisible) {
        trace = value; currentIndex = 0;
        renderFrameEventsEditor = () => calls.inspector++;
        settingsTabVisible = isVisible;
      }, cancelEventAvailabilityRefresh, eventLabel, eventSummary, eventDisplayText
    }; window.ASMTraceStudio = {`);
  vm.runInNewContext(source, {
    window, document, localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: fn => { const id = nextId++; scheduled.set(id, fn); return id; },
    cancelAnimationFrame: id => scheduled.delete(id)
  });
  window.testStudio.configure(trace, counters, () => visible);
  return {
    trace, counters, scheduled,
    visible: value => { visible = value; },
    cancel: window.testStudio.cancelEventAvailabilityRefresh,
    eventLabel: window.testStudio.eventLabel,
    eventSummary: window.testStudio.eventSummary,
    eventDisplayText: window.testStudio.eventDisplayText,
    notify: (frameId, doc = trace) => listeners.get('asm:trace-event-availability-changed')({
      detail: { document: doc, frameId }
    }),
    flush() {
      const callbacks = [...scheduled.values()]; scheduled.clear();
      callbacks.forEach(fn => fn());
    }
  };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('visual lifecycle labels identify the affected object instead of the frame directive', () => {
  const h = studioHarness(1);
  const target = { role: 'target', variableId: 'mergesort:temp@1', expression: 'temp' };
  const enter = {
    type: 'visual-enter', name: 'temp', source: { text: '// @frame use merge_step' }, targets: [target]
  };
  const exit = {
    type: 'visual-exit', automaticVisibility: true, name: 'temp',
    source: { text: '// @frame num' }, targets: [target]
  };
  assert.equal(h.eventLabel(enter), '物件入場');
  assert.equal(h.eventSummary(enter), 'temp');
  assert.equal(h.eventDisplayText(enter), 'temp');
  assert.equal(h.eventLabel(exit), '物件退場');
  assert.equal(h.eventSummary(exit), 'temp');
  assert.equal(h.eventDisplayText(exit), 'temp');
});

test('200 availability notifications coalesce into one event-button render', () => {
  const h = studioHarness();
  for (const frame of h.trace.frames) {
    h.notify(frame.id); h.notify(frame.id);
  }
  assert.equal(h.scheduled.size, 1);
  h.flush();
  assert.equal(h.counters.inspector, 1, 'the current frame was among the notifications');
  assert.equal(h.scheduled.size, 0, 'rendering does not schedule another availability pass');
});

test('notifications for other frames do not redraw the current frame buttons', () => {
  const h = studioHarness(3);
  h.notify('frame-1'); h.notify('frame-2');
  h.flush();
  assert.equal(h.counters.inspector, 0);
});

test('hidden settings tabs and stale documents do not schedule work', () => {
  const h = studioHarness(1);
  h.notify('frame-0', {});
  h.visible(false);
  h.notify('frame-0');
  assert.equal(h.scheduled.size, 0);
  h.visible(true); h.notify('frame-0'); h.visible(false); h.flush();
  assert.equal(h.counters.inspector, 0, 'a tab hidden before the frame callback skips the render');
});

test('cancelling clears pending frame IDs', () => {
  const h = studioHarness(2);
  h.notify('frame-0'); h.cancel();
  assert.equal(h.scheduled.size, 0);
  h.notify('frame-1'); h.flush();
  assert.equal(h.counters.inspector, 0, 'the cancelled current-frame notification is forgotten');
});
