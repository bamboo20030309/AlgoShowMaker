'use strict';
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs');
const { JSDOM } = require('jsdom');

test('code completion marks survive stable redraw and returning to a viewed frame without leaking across traces', () => {
  const dom = new JSDOM('<!doctype html><div id="canvasWrapper"><svg id="arraySvg"></svg></div>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  window.requestAnimationFrame = () => 1; window.matchMedia = () => ({ matches: false });
  window.ASMTraceCodeModel = {
    planFrame: (_trace, frame) => ({ sourceCode: 'a=1;', layoutKey: frame.id, focusLine: 1,
      fragments: [{ functionName: 'main', subtreeKey: 'main', focusLine: 1,
        items: [{ kind: 'line', number: 1, text: 'a=1;', segments: [] }] }] }),
    tokenizeSource: () => new Map(),
    mergeSyntaxSegments: () => [{ text: 'a=1;', eventIds: ['a'] }]
  };
  window.eval(fs.readFileSync('public/trace-code-presenter.js', 'utf8'));
  const presenter = window.ASMTraceCodePresenter, trace = { studio: { codePanelScrollMs: 0 } };
  const first = { id: 'first', events: [{ id: 'a', type: 'assign' }] }, second = { id: 'second', events: [] };
  const plan = { phases: [{ steps: [{ kind: 'trace-event', eventId: 'a', enabled: true }] }] };
  presenter.renderFrame(trace, first, plan);
  presenter.setActiveEvent('a', 'start'); presenter.setActiveEvent('a', 'end');
  assert.equal(presenter.visualStateForIds(['a']).complete, true);
  presenter.renderFrame(trace, first, null, { stable: true });
  assert.equal(presenter.visualStateForIds(['a']).complete, true, 'same-frame redraw preserves completed marks');
  assert.ok(window.document.querySelector('.asm-trace-code-event-span.is-complete'), 'recreated DOM restores the gray mark');
  presenter.renderFrame(trace, second, null, { stable: true });
  presenter.renderFrame(trace, first, null, { stable: true });
  assert.equal(presenter.visualStateForIds(['a']).complete, true, 'returning restores this frame history');
  presenter.renderFrame(trace, second);
  presenter.renderFrame(trace, first, plan);
  assert.equal(presenter.visualStateForIds(['a']).complete, false, 'a new playback starts without old completed marks');
  presenter.setActiveEvent('a', 'start'); presenter.setActiveEvent('a', 'end');
  presenter.renderFrame({ studio: {} }, first, null, { stable: true });
  assert.equal(presenter.visualStateForIds(['a']).complete, false, 'another trace with the same event IDs cannot inherit history');
  dom.window.close();
});

test('completed code marks survive canvas tab switching and stable browser redraw', { timeout: 45000 }, async t => {
  const { chromium } = require('playwright');
  const { compile } = require('./helpers/compile'), { startIsolatedServer } = require('./helpers/isolated-server');
  const { base } = await startIsolatedServer(t), previous = process.env.ASM_TEST_BASE_URL;
  let trace;
  try {
    process.env.ASM_TEST_BASE_URL = base;
    ({ trace } = await compile('int main(){int a=2;\n// @frame a\na=5;\n// @frame a\n}'));
  } finally { if (previous === undefined) delete process.env.ASM_TEST_BASE_URL; else process.env.ASM_TEST_BASE_URL = previous; }
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  t.after(() => browser.close()); const page = await browser.newPage();
  await page.goto(base + '/algorithm.html'); await page.waitForFunction(() => window.ASMTracePlayer);
  await page.evaluate(async trace => {
    ASMTracePlayer.apply(trace); window.asmGetAnimationPlaybackRate = () => 4;
    await ASMTracePlayer.render(0, { stable: true });
    await ASMTracePlayer.render(1, { fromIndex: 0, forceTransition: true });
  }, trace);
  const selector = '#traceCodePanel .asm-trace-code-event-span.is-complete';
  const completed = await page.locator(selector).count(); assert.ok(completed > 0, 'the assignment leaves a completed mark');
  await page.locator('[data-tab="tab-input"]').click();
  await page.locator('[data-tab="tab-canvas"]').click();
  await page.evaluate(() => ASMTracePlayer.render(1, { stable: true }));
  assert.equal(await page.locator(selector).count(), completed, 'returning to canvas restores completed marks');
});

test('code-only event states prioritize active yellow over an old completion mark',()=>{
 const vm=require('node:vm');const window={addEventListener(){}};window.window=window;
 vm.createContext(window);vm.runInContext(fs.readFileSync('public/trace-code-presenter.js','utf8'),window);
 const presenter=window.ASMTraceCodePresenter;
 for(const type of ['call','output','function-enter','return']){
  const event={id:type,type,enabled:true},events=new Map([[type,event]]),ids=[type],seen=new Set(ids);
  const active=presenter.visualStateForIds(ids,events,seen,seen,type);
  assert.equal(active.active,true,type+' is yellow during execution');
  assert.equal(active.complete,false,type+' must not be grey while active');
  const finished=presenter.visualStateForIds(ids,events,seen,seen,'');
  assert.equal(finished.active,false);assert.equal(finished.complete,true,type+' is grey after completion');
 }
 const disabled={id:'disabled',type:'call',enabled:false};
 const state=presenter.visualStateForIds(['disabled'],new Map([['disabled',disabled]]),new Set(),new Set(),'disabled');
 assert.equal(state.active,false,'an explicitly disabled call stays unhighlighted');
});
