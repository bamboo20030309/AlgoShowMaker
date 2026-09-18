const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compile, load } = require('./helpers/compile');

function api() {
  const context = vm.createContext({}); context.window = context;
  for (const file of ['trace-model.js','trace-rules.js','trace-events.js']) load(context,file);
  return context.ASMTraceEvents;
}
function document() {
  return { frames: [{
    id: 'compact', state: {}, eventControls: [{types:['all'],animate:false}],
    events: [{id:'fixed',type:'fixed',targets:[]},{id:'write',type:'write',targets:[]}]
  }], studio: {eventSettings:{autoFixedEnabled:true},eventStates:{}} };
}

test('all animate off leaves persistent fixed state enabled and outside source animation control', () => {
  const doc = document();
  api().applyEnabledStates(doc);
  assert.equal(doc.frames[0].events[0].enabled, true);
  assert.equal(doc.frames[0].events[0].directiveAnimationControl, undefined);
  assert.equal(doc.frames[0].events[1].enabled, false);
});

test('all animate on preserves fixed switches while an explicit fixed control remains authoritative', () => {
  const events = api(), doc = document(), frame = doc.frames[0];
  doc.studio.eventSettings.autoFixedEnabled = false;
  frame.eventControls = [{types:['all'],animate:true}];
  events.applyEnabledStates(doc);
  assert.equal(frame.events[0].enabled, false, 'all must not turn global fixed state on');
  doc.studio.eventSettings.autoFixedEnabled = true;
  doc.studio.eventStates.compact = {[events.eventKey(frame.events,0)]:false};
  events.applyEnabledStates(doc);
  assert.equal(frame.events[0].enabled, false, 'all must not turn frame fixed state on');
  frame.eventControls = [{types:['fixed'],animate:false},{types:['all'],animate:true}];
  events.applyEnabledStates(doc);
  assert.equal(frame.events[0].enabled, false, 'all does not override an explicit fixed rule');
  frame.eventControls.push({types:['fixed'],animate:true});
  events.applyEnabledStates(doc);
  assert.equal(frame.events[0].enabled, true);
  assert.equal(frame.events[0].directiveAnimationControl, true);
});

test('post-loop sieve compact frames keep fixed metadata enabled while timed events remain off', async () => {
  const source = fs.readFileSync(path.join(__dirname,'fixtures/automark-events-sieve.cpp'),'utf8');
  const {trace,window} = await compile(source,'30');
  const iId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'i');
  const compact = trace.frames.filter(frame => frame.eventControls.length);
  assert.ok(compact.some(frame => frame.state[iId]?.data.value === 8));
  const fixed = compact.flatMap(frame => frame.events.filter(event => event.type === 'fixed'));
  assert.ok(fixed.length > 0, 'fixed cells are completed in condensed frames');
  assert.ok(fixed.every(event => event.enabled === true));
  assert.ok(compact.every(frame => frame.events.filter(event => event.type !== 'fixed' && event.type !== 'condition')
    .every(event => event.enabled === false)));
  const reload = window.ASMTraceModel.normalizeTraceDocument(JSON.parse(JSON.stringify(trace)));
  assert.ok(reload.frames.filter(frame => frame.eventControls.length)
    .flatMap(frame => frame.events.filter(event => event.type === 'fixed')).every(event => event.enabled === true));
});
