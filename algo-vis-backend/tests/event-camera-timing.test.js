'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function harness(transition, rate = 1) {
  const calls = [];
  const window = {
    document: { documentElement: {} },
    asmGetAnimationPlaybackRate: () => rate,
    ASMTraceTransitions: { resolve: () => transition },
    setAutoCamera: (...args) => calls.push(args)
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../public/trace-camera.js'), 'utf8'), {
    window, getComputedStyle: () => ({ getPropertyValue: () => '' })
  });
  return { camera: window.ASMTraceCamera, calls };
}

test('automatic camera restores the 520ms base duration shared with the event precondition', () => {
  const { camera, calls } = harness(null);
  assert.equal(camera.transitionDuration({}, { id: 'after' }, { id: 'before' }), 520);
  camera.apply({}, { id: 'after' }, { id: 'before' });
  assert.equal(calls[0][4], 520);
});

test('custom and explicit zero camera durations survive old and new settings', () => {
  for (const value of [0, 120, 800]) {
    const { camera, calls } = harness({ duration: value }, 2);
    assert.equal(camera.transitionDuration({}, { id: 'after' }, { id: 'before' }), value);
    camera.apply({}, { id: 'after' }, { id: 'before' });
    assert.equal(calls[0][4], value / 2);
  }
});

test('instant camera transitions do not reserve event wait time', () => {
  const { camera, calls } = harness({ mode: 'instant', duration: 800 });
  assert.equal(camera.transitionDuration({}, { id: 'after' }, { id: 'before' }), 0);
  camera.apply({}, { id: 'after' }, { id: 'before' });
  assert.equal(calls[0][1], false);
});
