const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('a retained merge source commits its transferred cell before the following i++', { timeout: 120000 }, async () => {
  // Freeze this handoff contract independently of edits to the teaching sample.
  const handoff = `#include <bits/stdc++.h>
using namespace std;
void merge_step(vector<int>& num) {
  int i = 0;
  vector<int> merged;
  // @frame num[i],merged
  merged.push_back(num[i]);
  i++;
  // @frame num[i],merged
}
int main() {
  vector<int> num = {27,38};
  // @frame num
  // @keep num as "source"
  merge_step(num);
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */`;
  const { trace } = await compile(handoff);
  const targetIndex = trace.frames.findIndex(f => f.events.some(push => push.operation === 'push_back'
    && push.payload?.beforeSize === 0 && push.payload?.insertedValue?.value === 27
    && f.events.some(e => e.type === 'write' && e.order > push.order)));
  assert.ok(targetIndex > 0, 'fixture contains the first 27 transfer followed by a separate increment');
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const reports = await page.evaluate(async ({ trace, targetIndex }) => {
      const reports = [];
      const frame = trace.frames[targetIndex];
      const mergedId = Object.values(trace.variables).find(v => v.name === 'merged').id;
      const push = frame.events.find(e => e.operation === 'push_back');
      const write = frame.events.find(e => e.order > push.order && e.type === 'write');
      if (!write) throw new Error('fixture must retain separate push_back and increment events');
      const opacity = element => {
        if (!element) return 0;
        let value = 1;
        for (let p = element; p && p.id !== 'asm-trace-root'; p = p.parentElement) {
          const style = getComputedStyle(p);
          if (style.display === 'none' || style.visibility === 'hidden') return 0;
          value *= Number(style.opacity);
        }
        return value;
      };
      for (const speed of [1, 4]) for (const mode of ['manual', 'autoplay', 'disabled']) {
        const autoplay = mode === 'autoplay';
        const copy = JSON.parse(JSON.stringify(trace));
        if (mode === 'disabled') {
          const instruction = window.ASMTraceEvents.instructionKey(push);
          copy.studio.eventInstructionStates = { ...copy.studio.eventInstructionStates, [instruction]: false };
        }
        if (autoplay) {
          copy.frames = copy.frames.slice(targetIndex - 1, targetIndex + 1);
          copy.frames.forEach(f => { f.texts = []; });
        }
        window.ASMTracePlayer.apply(copy);
        window.asmGetAnimationPlaybackRate = () => speed;
        const index = autoplay ? 1 : targetIndex;
        await window.ASMTracePlayer.render(index - 1, { stable: true });
        let done = false;
        let pending;
        if (autoplay) document.querySelector('#playToggleBtn').click();
        else pending = window.ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true }).finally(() => { done = true; });
        const samples = [];
        let transferSeen = false;
        const deadline = performance.now() + 25000;
        do {
          await new Promise(requestAnimationFrame);
          if (performance.now() > deadline) throw new Error('transition timed out');
          const root = document.querySelector('#asm-trace-root');
          const transfer = !!root.querySelector('.asm-trace-sequence-cell-transfer');
          transferSeen ||= transfer;
          if (root.dataset.traceActiveEventId === write.id) {
            const live = key => [...root.querySelectorAll(`[data-trace-object-key="${key}"]`)]
              .find(el => !el.closest('[data-trace-snapshot]')
                && el.closest('[data-trace-variable]')?.dataset.traceVariable === mergedId);
            const cell = live(`${mergedId}#0`);
            const label = live(`${mergedId}#0:index`);
            samples.push({ value: cell?.textContent, cell: opacity(cell), index: opacity(label), transfer });
          }
          if (autoplay) done = document.querySelector('#playToggleBtn').getAttribute('aria-pressed') !== 'true';
        } while (!done);
        if (pending) await pending;
        reports.push({ speed, mode, transferSeen, samples, write: copy.frames[index].events.find(e => e.id === write.id) });
      }
      return reports;
    }, { trace, targetIndex });
    for (const report of reports) {
      assert.equal(report.transferSeen, report.mode !== 'disabled', JSON.stringify(report));
      assert.ok(report.samples.length, JSON.stringify(report));
      assert.ok(report.samples.every(s => s.value === '27' && s.cell >= .99 && s.index >= .99 && !s.transfer), JSON.stringify(report));
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
