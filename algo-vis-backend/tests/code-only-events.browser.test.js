const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { TWEEN_BUILD } = require('./helpers/builds');
const { compile } = require('./helpers/compile');

test('code-only calls and output highlight yellow while active, then grey after completion', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const { trace } = await compile(`#include <bits/stdc++.h>
using namespace std;
void visit(int value) { (void)value; }
int main() {
  int n = 2;
  // @frame n
  visit(n);
  cout << "cout=" << n << '\\n';
  printf("printf=%d\\n", n);
  // @frame n
}`);
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(() => window.ASMTracePlayer);
    const result = await page.evaluate(async sourceTrace => {
      // Stop the built-in sample before applying this isolated trace.
      window.ASMDefaultAlgorithm?.cancel?.('renderer-fixture');
      sourceTrace.studio ||= {};
      sourceTrace.studio.eventSettings ||= {};
      sourceTrace.studio.eventSettings.defaultEnabled = { call: true, output: true };
      window.asmGetAnimationPlaybackRate = () => 4;
      const document = window.ASMTracePlayer.apply(sourceTrace);
      const frameIndex = document.frames.findIndex(frame => (
        frame.events.some(event => event.type === 'output')
      ));
      const frame = document.frames[frameIndex];
      frame.events.forEach(event => {
        event.enabled = ['call', 'output'].includes(event.type);
      });
      const fromIndex=Math.max(0,frameIndex-1);
      await window.ASMTracePlayer.render(fromIndex,{stable:true});
      const transition=window.ASMTracePlayer.render(frameIndex,{fromIndex,forceTransition:true});
      const samples = [];
      let settled = false;
      transition.finally(() => { settled = true; });
      for (let index = 0; index < 120 && !settled; index += 1) {
        const root = window.document.querySelector('[data-trace-active-event-type]');
        const active = [...window.document.querySelectorAll(
          '.asm-trace-code-event-span.is-active'
        )].map(node => node.textContent).join('');
        const complete = [...window.document.querySelectorAll(
          '.asm-trace-code-event-span.is-complete'
        )].map(node => node.textContent).join('');
        if (root?.dataset.traceActiveEventType && (active || complete)) {
          samples.push({ type: root.dataset.traceActiveEventType, active, complete });
        }
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      await transition;
      return {
        samples,
        completed: [...window.document.querySelectorAll('.asm-trace-code-event-span.is-complete')].map(n=>n.textContent).join(''),
        build: window.ASMTraceFrameTween?.build || '',
        remainingActive: window.document.querySelectorAll(
          '.asm-trace-code-event-span.is-active'
        ).length
      };
    }, trace);
    assert.equal(result.build, TWEEN_BUILD);
    assert.ok(result.samples.some(sample => (
      sample.type === 'call' && /visit\s*\(\s*n\s*\)/.test(sample.active)
        && !/visit\s*\(\s*n\s*\)/.test(sample.complete)
    )), `function call must be yellow, not completed grey, while active: ${JSON.stringify(result)}`);
    assert.ok(result.samples.some(sample => (
      sample.type === 'output' && /cout\s*<</.test(sample.active)
    )), `cout never received an active highlight: ${JSON.stringify(result.samples)}`);
    assert.ok(result.samples.some(sample => (
      sample.type === 'output' && /printf\s*\(/.test(sample.active)
    )), `printf never received an active highlight: ${JSON.stringify(result.samples)}`);
    assert.match(result.completed,/visit\s*\(\s*n\s*\)/,'call turns grey after completion');
    assert.equal(result.remainingActive, 0, 'active highlight clears after playback');
  } finally {
    await browser.close();
  }
});
