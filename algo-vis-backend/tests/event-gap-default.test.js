'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
test('missing event gaps use 500ms while explicit zero and custom gaps survive',()=>{
  const context=vm.createContext({window:{}});
  vm.runInContext(fs.readFileSync(path.join(__dirname,'../public/trace-events.js'),'utf8'),context);
  const events=context.window.ASMTraceEvents;
  for(const value of [undefined,null,'',' ',NaN,Infinity,'invalid']) assert.equal(events.normalizeEventGapMs(value),500);
  for(const [value,expected] of [[0,0],['0',0],[600,600],[2001,2000],[-1,0]]) {
    assert.equal(events.eventGapMs({studio:{eventSettings:{gapMs:value}}}),expected);
  }
  assert.equal(events.eventGapMs({}),500);
  assert.equal(events.eventGapMs(),500);
});
