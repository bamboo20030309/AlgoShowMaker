'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { startIsolatedServer } = require('./helpers/isolated-server');
const { compile } = require('./helpers/compile');

test('returning from canvas tabs or a hidden page resumes the same event and preserves manual pause', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile('#include <vector>\nusing namespace std;\nint main(){vector<int>a={2,7};\n// @frame a\na[0]=a[1];\n// @frame a\n}'));
  } finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage();
  await page.goto(base + '/algorithm.html'); await page.waitForFunction(() => window.ASMPlaybackNavigation);
  for (const mode of ['canvas', 'document', 'manual-pause', 'autoplay']) {
    await page.evaluate(async ({ trace, mode }) => {
      ASMTracePlayer.apply(JSON.parse(JSON.stringify(trace))); window.asmGetAnimationPlaybackRate = () => 1;
      await ASMTracePlayer.render(0, { stable: true });
      if (mode === 'autoplay') ASMPlaybackNavigation.play();
      else window.fixtureTransition = ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
    }, { trace, mode });
    await page.waitForFunction(() => Number(document.querySelector('.asm-trace-assign-transfer')?.getAttribute('opacity')) > .1);
    if (mode === 'manual-pause') await page.evaluate(() => ASMPlaybackNavigation.pause());
    const plan = await page.evaluate(() => ASMTracePlayer.getActivePlaybackPlan().id);
    if (mode === 'document') await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => window.fixtureHidden });
      window.fixtureHidden = true; document.dispatchEvent(new Event('visibilitychange'));
    });
    else await page.locator('[data-tab="tab-input"]').click();
    const frozen = await page.locator('.asm-trace-assign-transfer').first().getAttribute('transform');
    await page.waitForTimeout(100);
    assert.equal(await page.locator('.asm-trace-assign-transfer').first().getAttribute('transform'), frozen, mode + ' freezes in place');
    assert.equal(await page.evaluate(() => ASMTracePlayer.getActivePlaybackPlan()?.id), plan, 'hide must not replace the original plan');
    if (mode === 'document') await page.evaluate(() => {
      window.fixtureHidden = false; document.dispatchEvent(new Event('visibilitychange')); delete document.hidden;
    });
    else await page.locator('[data-tab="tab-canvas"]').click();
    if (mode === 'manual-pause') {
      assert.equal(await page.evaluate(() => ASMTraceFrameTween.isPaused()), true, 'a user-paused event does not auto-resume');
      await page.locator('#playToggleBtn').click();
    }
    await page.waitForFunction(() => !ASMTracePlayer.getActivePlaybackPlan());
    const value = await page.evaluate(() => {
      const doc = ASMTracePlayer.getDocument(), id = Object.keys(doc.variables).find(id => doc.variables[id].name === 'a');
      return document.querySelector(`[data-trace-object-key="${CSS.escape(id + '#0')}"] text[data-trace-content-role="value"]`)?.textContent;
    });
    assert.equal(value, '7', mode + ' resumes and commits the original assignment');
  }
});

// Fixed answer: the destination starts at 2 and receives 7. Pausing an active
// transfer must keep its exact SVG transform, not finish the assignment early.
test('manual frame pause freezes its transfer and play resumes that same completion', { timeout: 60000 }, async t => {
  const { base } = await startIsolatedServer(t);
  const browser = await chromium.launch({ headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/algorithm.html?asmEmbed=runtime');
  await page.waitForFunction(() => window.ASMTraceFrameTween?.pause && window.ASMPlaybackNavigation);
  const prepared = await page.evaluate(async () => {
    const code = `#include <vector>
using namespace std;
int main() {
  vector<int> a = {2,7};
  // @frame a
  a[0] = a[1];
  // @frame a
}`;
    const post = async (url, body) => {
      const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || result.error) throw Error(result.error || url);
      return result;
    };
    const analysis = await post('/trace/analyze', { code });
    const result = await post('/compile', { code, input: '', trace: { enabled: true,
      watches: [...new Set(analysis.frameDirectives.flatMap(frame => frame.variableIds))], sliceMode: 'manual' } });
    const trace = ASMTraceModel.normalizeTraceDocument(result.traceDocument);
    trace.studio ||= {};
    trace.studio.eventSettings = { ...(trace.studio.eventSettings || {}), gapMs: 0 };
    asmApplyTraceDocument(trace);
    window.asmGetAnimationPlaybackRate = () => 1;
    const id = Object.keys(trace.variables).find(id => trace.variables[id].name === 'a');
    window.fixtureTransition = CodeScript.next();
    return { id, count: trace.frames.length };
  });
  assert.equal(prepared.count, 2);
  await page.waitForFunction(() => document.querySelector('.asm-trace-assign-transfer'));
  const paused = await page.evaluate(() => {
    ASMPlaybackNavigation.pause();
    const transfer = document.querySelector('.asm-trace-assign-transfer');
    return { paused: ASMTraceFrameTween.isPaused(), transform: transfer.getAttribute('transform') };
  });
  assert.equal(paused.paused, true);
  await page.waitForTimeout(100);
  assert.equal(await page.locator('.asm-trace-assign-transfer').first().getAttribute('transform'), paused.transform);
  await page.locator('#playToggleBtn').click();
  await page.evaluate(() => window.fixtureTransition);
  assert.equal(await page.evaluate(() => ASMTraceFrameTween.isPaused()), false);
  assert.equal(await page.locator('.asm-trace-assign-transfer').count(), 0);
  const values = await page.evaluate(id => [...document.querySelectorAll(`[data-trace-variable="${id}"] [data-trace-index]`)]
    .map(cell => cell.querySelector('text:not([data-trace-content-role="index"])')?.textContent), prepared.id);
  assert.deepEqual(values, ['7', '7']);
  assert.deepEqual(errors, []);
});
