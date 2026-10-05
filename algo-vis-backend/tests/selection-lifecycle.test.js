'use strict';
const test=require('node:test'), assert=require('node:assert/strict'), vm=require('node:vm');
const {load}=require('./helpers/compile');
function context(){const c=vm.createContext({queueMicrotask(){}});c.window=c;load(c,'trace-events.js');load(c,'trace-frame-tween.js');return c;}

test('visual exit does not end the variable lifetime needed by the following i++',()=>{
  const c=context(), target={variableId:'i',lifetimeIdentity:'loop'};
  const frame={events:[{type:'visual-exit',order:1,manualVisualExit:true,targets:[target]},
    {type:'write',order:2,targets:[target]},{type:'scope-exit',order:3,targets:[target]}]};
  const marker={dataset:{traceSourceVariableId:'i',traceRuntimeIdentity:'loop'}};
  assert.equal(c.ASMTraceFrameTween.markerLifetimeActiveAtEvent(frame,frame.events[1],marker),true);
  assert.equal(c.ASMTraceFrameTween.markerLifetimeActiveAtEvent(frame,{order:4},marker),false);
});

test('completed capture survives natural cleanup while explicit saved settings still win',()=>{
  const c=context();
  for(const legacy of [false,true]) {
    const event={id:'cleanup',signature:'scope-exit:main:40:arr',type:'scope-exit',order:10,
      source:{line:40},targets:[{variableId:'arr'}],...(legacy?{}:{afterCapture:true})};
    const document={frames:[{id:'last',source:{line:36,statementKind:'manual-frame'},events:[event]}],studio:{}};
    c.ASMTraceEvents.applyEnabledStates(document);
    assert.equal(event.enabled,false);
    document.studio.eventInstructionStates={'scope-exit:main:arr':true};
    c.ASMTraceEvents.applyEnabledStates(document);assert.equal(event.enabled,true);
    document.studio.eventInstructionStates={'scope-exit:main:arr':false};
    c.ASMTraceEvents.applyEnabledStates(document);assert.equal(event.enabled,false);
    delete document.studio.eventInstructionStates;
    document.studio.eventSettings={defaultEnabled:{'object-exit':true}};
    c.ASMTraceEvents.applyEnabledStates(document);assert.equal(event.enabled,true);
  }
  const manual={type:'visual-exit',manualVisualExit:true,afterCapture:true};
  assert.equal(c.ASMTraceEvents.defaultEnabled(manual,{frames:[{events:[manual]}]}),true);
});
