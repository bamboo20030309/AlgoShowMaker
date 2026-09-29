const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('function calls turn grey while output statements receive active code highlights', { timeout: 60000 }, async () => {
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
    const result = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const frameIndex = document.frames.findIndex(frame => (
        frame.events.some(event => event.type === 'output')
      ));
      const frame = document.frames[frameIndex];
      const previous = document.frames[Math.max(0, frameIndex - 1)];
      frame.events.forEach(event => {
        event.enabled = ['call', 'output'].includes(event.type);
      });
      await window.ASMTraceRenderers.renderFrame(document, previous, null, {
        animatePositions: false,
        animateEvents: false
      });
      window.ASMTraceCodePresenter.renderFrame(document, frame, null, false);
      const transition = window.ASMTraceRenderers.renderFrame(document, frame, previous, {
        animatePositions: true,
        animateEvents: true
      });
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
        build: window.ASMTraceFrameTween?.build || '',
        remainingActive: window.document.querySelectorAll(
          '.asm-trace-code-event-span.is-active'
        ).length
      };
    }, trace);
    assert.equal(result.build, 'trace-260');
    assert.ok(result.samples.some(sample => (
      sample.type === 'call' && !sample.active
        && /visit\s*\(\s*n\s*\)/.test(sample.complete)
    )), `function call never received a completed grey highlight: ${JSON.stringify(result)}`);
    assert.ok(result.samples.some(sample => (
      sample.type === 'output' && /cout\s*<</.test(sample.active)
    )), `cout never received an active highlight: ${JSON.stringify(result.samples)}`);
    assert.ok(result.samples.some(sample => (
      sample.type === 'output' && /printf\s*\(/.test(sample.active)
    )), `printf never received an active highlight: ${JSON.stringify(result.samples)}`);
    assert.equal(result.remainingActive, 0, 'active highlight clears after playback');
  } finally {
    await browser.close();
  }
});
