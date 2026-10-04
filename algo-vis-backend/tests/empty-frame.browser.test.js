const { test } = require('node:test');
const assert = require('node:assert/strict');
const { compile } = require('./helpers/compile');
const { chromium } = require('playwright');

test('empty frames are retained and show no implicit objects before/after an object frame', { timeout: 60000 }, async () => {
  const code = `#include <vector>
using namespace std;
int main(){
vector<int> arr={4,1};
// @frame
// @frame arr
arr[0]=3;
// @frame
// @frame
// @text "只有文字"
// @frame when arr[0] == 3
}`;
  const { trace } = await compile(code);
  const { trace: onlyEmpty } = await compile('int main(){\n// @frame\n// @frame\nreturn 0;}');
  assert.equal(onlyEmpty.frames.length, 2);
  assert.ok(onlyEmpty.frames.every(frame => Object.keys(frame.state).length === 0));
  assert.equal(trace.frames.length, 5);
  for (const index of [0, 2, 3, 4]) {
    assert.ok(Object.keys(trace.frames[index].state).every(id => trace.frames[index].captureOnlyVariableIds.includes(id)));
  }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
    const results = await page.evaluate(async trace => {
      const results = [];
      const inspect = index => ({ index,
        objects: document.querySelectorAll('#asm-trace-root [data-trace-variable]').length,
        text: document.querySelector('#asm-trace-root')?.textContent || '' });
      for (const speed of [1, 4]) {
        ASMTracePlayer.apply(trace);
        window.asmGetAnimationPlaybackRate = () => speed;
        for (let index = 0; index < 5; index++) {
          await ASMTracePlayer.render(index, index ? { fromIndex: index - 1, forceTransition: true } : { stable: true });
          results.push({ speed, ...inspect(index) });
        }
        await ASMTracePlayer.render(1, { stable: true });
        await ASMTracePlayer.render(0, { fromIndex: 1, forceTransition: true });
        results.push({ speed, ...inspect(0) });
        const autoplay = JSON.parse(JSON.stringify(trace));
        autoplay.frames.forEach(frame => { frame.texts = []; });
        ASMTracePlayer.apply(autoplay);
        await ASMTracePlayer.render(0, { stable: true });
        document.querySelector('#playToggleBtn').click();
        const deadline = performance.now() + 15000;
        do {
          await new Promise(requestAnimationFrame);
          if (performance.now() > deadline) throw new Error('empty-frame autoplay timed out');
        } while (document.querySelector('#playToggleBtn').getAttribute('aria-pressed') === 'true');
        if (ASMTracePlayer.getCurrentFrame() !== 4) throw new Error('autoplay skipped/stopped at an empty frame');
        results.push({ speed, ...inspect(4) });
      }
      const saved = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
      ASMTracePlayer.apply(saved);
      await ASMTracePlayer.render(2, { stable: true });
      return { results, reopened: inspect(2), frames: ASMTracePlayer.getDocument().frames.length };
    }, trace);
    assert.equal(results.frames, 5);
    for (const result of results.results) assert.equal(result.objects, result.index === 1 ? 1 : 0, JSON.stringify(result));
    assert.ok(results.results.filter(r => r.index === 3).every(r => r.text.includes('只有文字')));
    assert.equal(results.reopened.objects, 0);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
