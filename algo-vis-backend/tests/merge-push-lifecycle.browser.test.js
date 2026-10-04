const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('stable empty array has its name and outerframe without a placeholder cell', { timeout: 30000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  const { trace } = await compile(`#include <vector>
using namespace std;
int main(){ vector<int> empty;
// @frame empty
empty.push_back(9);
// @frame empty
}`);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage();
    await page.goto(`${base}/algorithm.html`);
    const result = await page.evaluate(async trace => {
      window.ASMTracePlayer.apply(trace);
      await window.ASMTracePlayer.render(0, { stable: true });
      const owner = document.querySelector(`[data-trace-object-key="${trace.frames[0].source.primaryVariableId}"]`);
      return { name:owner?.querySelector('.outerframe-label')?.textContent,
        frame:!!owner?.querySelector('.outerframe-bg'),
        cells:owner?.querySelectorAll('[data-trace-index], [data-trace-index-label]').length };
    }, trace);
    assert.deepEqual(result,{name:'empty',frame:true,cells:0});
  } finally { await browser.close(); }
});

test('recursive merge push lifecycle keeps empty name, cell and index in event order', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base);
  const code = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout.cpp', 'utf8');
  const input = fs.readFileSync('algorithm_sample/Sorting/merge_sort_recursive_layout-sample_input.txt', 'utf8');
  const { trace } = await compile(code, input);
  const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    const result = await page.evaluate(async trace => {
      window.asmGetAnimationPlaybackRate = () => 2;
      window.ASMTracePlayer.apply(trace);
      const indices = [trace.frames.findIndex((f,i)=>i>5&&f.source.layoutId==='split_tree'&&trace.frames[i-1].source.layoutId==='merge_tree'&&f.source.primaryVariableId===trace.frames[i-1].source.primaryVariableId), trace.frames.findIndex(f=>f.events.some(e=>e.type==='declare'&&e.name==='merged')), trace.frames.findIndex(f=>f.events.some(e=>e.operation==='push_back'&&e.payload.beforeSize===2))];
      const reports = [];
      for (const index of [...new Set(indices)]) {
        await window.ASMTracePlayer.render(index - 1, { stable: true });
        const frame = trace.frames[index];
        const primary = frame.source.primaryVariableId;
        const before = [...document.querySelectorAll('[data-trace-layout-node]')].map(el => ({key:el.dataset.traceObjectKey,layout:el.dataset.traceLayoutId,activation:el.dataset.traceLayoutActivation,y:el.getBoundingClientRect().y}));
        let done = false;
        const transition = window.ASMTracePlayer.render(index, { fromIndex: index - 1, forceTransition: true }).finally(() => { done = true; });
        const samples = [];
        for (let count = 0; count < 900 && !done; count++) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const owner = [...document.querySelectorAll(`[data-trace-object-key="${primary}"]`)].find(el=>!el.closest('.asm-trace-snapshot'));
          const bg = owner?.querySelector('.outerframe-bg');
          const label = owner?.querySelector('.outerframe-label');
          const rect = bg?.getBoundingClientRect();
          const cell = owner?.querySelector('[data-trace-index]');
          const visible = el => { if(!el) return false; for(let p=el;p&&p!==document.body;p=p.parentElement){if(Number(getComputedStyle(p).opacity)===0||getComputedStyle(p).display==='none')return false;} return true; };
          const cells = [...owner?.querySelectorAll('[data-trace-index], [data-trace-index-label]')||[]].map(el=>({key:el.dataset.traceObjectKey,value:el.textContent,visible:visible(el),x:el.getBoundingClientRect().x,right:el.getBoundingClientRect().right,transform:el.getAttribute('transform')}));
          const root = document.querySelector('#asm-trace-root');
          const snapshot = {event:root?.dataset.traceActiveEventId||'',type:root?.dataset.traceActiveEventType||'',name:label?.textContent||'',nameVisible:visible(label),bgRight:rect?.right,bgY:rect?.y,cells,transfer:!!document.querySelector('.asm-trace-sequence-cell-transfer'),growth:owner?.dataset.traceRecursionGrowth||'',motion:owner?.querySelector('.asm-trace-motion')?.getAttribute('transform')};
          if(!samples.length || JSON.stringify(snapshot)!==JSON.stringify(samples.at(-1))) samples.push(snapshot);
        }
        await transition;
        reports.push({index:index+1,source:frame.source,before,events:frame.events.map(e=>({id:e.id,type:e.type,operation:e.operation,name:e.name,expression:e.expression,payload:e.payload,targets:e.targets})),samples});
      }
      return reports;
    }, trace);
    const split = result[0];
    assert.equal(split.samples[0].growth, '1', 'returning to a split tree grows the new child from its split parent');
    const motion = split.samples[0].motion.match(/translate\(([-\d.]+), ([-\d.]+)\)/);
    assert.ok(motion && Number(motion[2]) < 0, 'the child starts above its destination, never at the lower merge leaf');
    const initialMerge = result[1];
    const declaration = initialMerge.events.find(e => e.type==='declare'&&e.name==='merged');
    const declarationSamples = initialMerge.samples.filter(s=>s.event===declaration.id);
    assert.ok(declarationSamples.length > 0);
    assert.ok(declarationSamples.some(s=>s.nameVisible && s.name==='merged'));
    assert.ok(declarationSamples.every(s=>s.cells.every(c=>!c.visible)), 'empty declaration shows no data or index cells');
    for(const report of result.slice(1)) {
      const push = report.events.find(e=>e.operation==='push_back');
      const samples = report.samples.filter(s=>s.event===push.id);
      assert.ok(samples.some(s=>s.transfer), `visible retained source transfers a full cell at frame ${report.index}`);
      assert.ok(samples.every(s=>s.name==='merged'&&s.nameVisible), 'name survives every sequence tick');
      const index = push.payload.beforeSize;
      const keys = [`${report.source.primaryVariableId}#${index}`,`${report.source.primaryVariableId}#${index}:index`];
      for(const sample of samples) {
        for(const cell of sample.cells.filter(c=>keys.includes(c.key))) {
          assert.ok(!cell.transform || cell.transform==='translate(0, 0)', 'source transfer has no additional edge motion');
          if(sample.transfer) assert.equal(cell.visible,false,'real destination and index stay hidden until transfer handoff');
          if(cell.visible) assert.ok(cell.right <= sample.bgRight + 1, 'index cannot precede outerframe extension');
        }
      }
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
