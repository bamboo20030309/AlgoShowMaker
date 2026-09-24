const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { findFrameDirectives } = require('../trace-instrumenter');

test('an unresolved focus target uses automatic capture instead of the previous center', () => {
  let automatic = 0;
  const window = {
    document: { documentElement: {} },
    ASMTraceRules: { conditionMatches: () => true },
    ASMTraceRenderers: { currentAnchor: () => null, fitCurrentObjectsCamera: () => { automatic++; return true; } },
    setCamera: () => assert.fail('missing target must not reuse the previous viewport center')
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/trace-camera.js'), 'utf8'), {
    window, getComputedStyle: () => ({ getPropertyValue: () => '' })
  });
  window.ASMTraceCamera.apply({}, { id: 'frame-1', camera: { autoCapture: false, target: { objectKey: 'missing' }, zoom: 2 } });
  assert.equal(automatic, 1);
});

test('@camera auto and focus attach to a frame with semantic center defaults', () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 1, 2};
  int i = 1;
  // @frame arr[i]
  // @camera focus arr[i] zoom(1.6) offset(4,-8) when i >= 0
  // @frame arr
  // @camera auto zoom(0.8)
}`;
  const frames = findFrameDirectives(source);
  assert.equal(frames[0].camera.autoCapture, false);
  assert.equal(frames[0].camera.zoom, 1.6);
  assert.equal(frames[0].camera.target.anchor, 'center');
  assert.equal(frames[0].camera.target.indexExpression, 'i');
  assert.equal(frames[0].camera.condition.expression, 'i >= 0');
  assert.equal(frames[1].camera.autoCapture, true);
  assert.equal(frames[1].camera.zoom, 0.8);
});

test('camera priority is Studio frame override, directive, Studio global, automatic', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-camera.js'), 'utf8');
  const window = {
    ASMTraceRules: { conditionMatches: () => true },
    ASMTraceViewSource: { frameIdsForDescriptor: () => ['frame-1'] }
  };
  vm.runInNewContext(source, { window, getComputedStyle: () => ({ getPropertyValue: () => '' }) });
  const frame = { id: 'frame-1', camera: { source: 'directive', zoom: 1.6 } };
  const trace = { studio: { cameraRules: [{ id: 'global', allFrames: true, zoom: 0.7 }] } };
  assert.equal(window.ASMTraceCamera.ruleForFrame(trace, frame).source, 'directive');
  trace.studio.cameraRules.push({ id: 'frame', frameIds: ['frame-1'], zoom: 2 });
  assert.equal(window.ASMTraceCamera.ruleForFrame(trace, frame).id, 'frame');
  delete frame.camera;
  trace.studio.cameraRules.pop();
  assert.equal(window.ASMTraceCamera.ruleForFrame(trace, frame).id, 'global');
  trace.studio.cameraRules = [];
  assert.equal(window.ASMTraceCamera.ruleForFrame(trace, frame), null);
});

test('camera expression conditions decide whether a focus directive applies', () => {
  const source = fs.readFileSync(path.join(__dirname, '../public/trace-camera.js'), 'utf8');
  const window = {
    ASMTraceRules: {
      conditionMatches: () => true,
      expressionMatches: (_trace, frame) => frame.state.allow === true
    }
  };
  vm.runInNewContext(source, { window, getComputedStyle: () => ({ getPropertyValue: () => '' }) });
  const camera = { source: 'directive', target: { objectKey: 'num' }, condition: { expression: 'allow' } };
  const frame = { id: 'frame-1', state: { allow: false }, camera };
  assert.equal(window.ASMTraceCamera.ruleForFrame({}, frame), null);
  frame.state.allow = true;
  assert.equal(window.ASMTraceCamera.ruleForFrame({}, frame), camera);
});
