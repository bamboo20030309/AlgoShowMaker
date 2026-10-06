const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('events before the first and after the last frame survive; code hide alone suppresses them',
  { timeout: 60000 }, async () => {
    const base = process.env.ASM_TEST_BASE_URL;
    assert.ok(base, 'use an isolated server');
    const code = `#include <iostream>
void hidden_helper(int& value) { value += 100; }
int main() {
  int value = 0;
  value = 1;
  // @code hide
  value = 2;
  hidden_helper(value);
  // @endcode
  // @frame value
  value = 3;
  // @frame value
  value = 4;
  std::cout << value;
  // @code hide
  value = 5;
  hidden_helper(value);
  // @endcode
  return 0;
}
/* @asm-view
{"version":1,"rules":[],"skins":{},"studio":{"eventSettings":{"autoFixedEnabled":false,"autoLoopBoundaryEnabled":false}}}
@asm-view */`;
    const { trace } = await compile(code);
    const line = statement => code.split('\n').indexOf(statement) + 1;
    assert.equal(trace.frames.length, 2, 'restoring events does not add frames');
    const id = Object.entries(trace.variables).find(([, variable]) => variable.name === 'value' && variable.functionName === 'main')[0];
    assert.deepEqual(Array.from(trace.frames, frame => Number(frame.state[id].data.value)), [102, 3]);
    assert.ok(trace.frames[0].events.some(event => event.line === line('  value = 1;')));
    const last = trace.frames[1];
    assert.ok(last.events.some(event => event.line === line('  value = 4;') && event.afterCapture));
    assert.ok(last.events.some(event => event.type === 'output' && event.afterCapture));
    assert.ok(last.events.some(event => event.type === 'return' && event.afterCapture));
    const events = trace.frames.flatMap(frame => frame.events);
    const hidden = [line('  value = 2;'), line('  value = 5;'), 2];
    assert.ok(events.every(event => !hidden.includes(event.line)));
    assert.ok(events.every(event => event.type !== 'call' || event.calledFunction !== 'hidden_helper'));
    assert.equal(new Set(events.map(event => event.id)).size, events.length, 'no duplicated boundary events');

    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(base + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.ASMTraceCodeModel);
      await page.evaluate(document => window.asmApplyTraceDocument(document), trace);
      const restored = await page.evaluate(async () => {
        const document = ASMTracePlayer.getDocument();
        const collect = frame => ASMTraceCodeModel.planFrame(document, frame).fragments
          .flatMap(fragment => fragment.items).flatMap(item => item.segments || [])
          .flatMap(segment => segment.eventIds || []);
        await ASMTracePlayer.renderStable(0);
        const first = collect(document.frames[0]);
        await ASMTracePlayer.renderStable(1);
        const last = collect(document.frames[1]);
        const saved = JSON.stringify(document);
        const persistedEvents = JSON.parse(saved).frames.map(frame => frame.events);
        ASMTracePlayer.apply(JSON.parse(saved));
        return { first, last, events: ASMTracePlayer.getDocument().frames.map(frame => frame.events),
          persistedEvents,
          autoFixed: ASMTracePlayer.getDocument().studio.eventSettings.autoFixedEnabled };
      });
      const initial = trace.frames[0].events.find(event => event.line === line('  value = 1;'));
      const output = last.events.find(event => event.type === 'output');
      assert.ok(restored.first.includes(initial.id), 'initial events appear in code snippets');
      assert.ok(restored.last.includes(output.id), 'trailing output appears in code snippets');
      assert.deepEqual(restored.events, restored.persistedEvents, 'saving and reopening retain runtime and availability metadata');
      assert.equal(restored.autoFixed, false);
      const legacy = await page.evaluate(async () => {
        const document = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
        document.provenance.engineVersion = 10;
        document.frames.forEach(frame => {
          delete frame.captureOrder;
          frame.events.forEach(event => { delete event.afterCapture; });
        });
        document.frames[0].events[0].enabled = false;
        document.frames[0].events[0].color = '#123456';
        document.frames[0].events[0].text = '';
        const status = ASMTraceProvenance.status(document, document.sourceCode, document.input).kind;
        ASMTracePlayer.apply(document);
        await ASMTracePlayer.renderStable(0);
        const saved = JSON.stringify(ASMTracePlayer.getDocument());
        ASMTracePlayer.apply(JSON.parse(saved));
        const reopened = ASMTracePlayer.getDocument();
        return { status, frames: reopened.frames.length, event: reopened.frames[0].events[0],
          autoFixed: reopened.studio.eventSettings.autoFixedEnabled };
      });
      assert.equal(legacy.status, 'outdated');
      assert.equal(legacy.frames, 2);
      assert.equal(legacy.event.enabled, false);
      assert.equal(legacy.event.color, '#123456');
      assert.equal(legacy.event.text, '');
      assert.equal(legacy.event.afterCapture, undefined);
      assert.equal(legacy.autoFixed, false);
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
