'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path');
const { captureEvidence, reconcileEvidence } = require('../scripts/validation-evidence');
const { animationCases, inventory } = require('../scripts/validation-manifest');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'asm-evidence-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const put = (name, value) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), value); };
  put('tests/a.test.js', "require('../a');"); put('a.js', 'module.exports = 1;');
  put('tests/b.test.js', "require('../b');"); put('b.js', 'module.exports = 2;');
  const files = ['tests/a.test.js', 'tests/b.test.js'];
  const environment = { node: 'test-node', compiler: 'test-g++', browser: 'test-browser' };
  const capture = () => captureEvidence(root, files, { environment, animation: false });
  const state = { status: 'complete', passedFiles: [...files], failedFiles: [], remainingFiles: [], evidence: capture() };
  return { root, put, files, environment, capture, state };
}

test('changed uncommitted dependency invalidates only affected passes and preserves unchanged evidence', t => {
  const f = fixture(t); f.put('a.js', 'module.exports = 3;');
  reconcileEvidence(f.state, f.capture());
  assert.deepEqual(f.state.passedFiles, ['tests/b.test.js']);
  assert.deepEqual(f.state.remainingFiles, ['tests/a.test.js']);
  assert.equal(f.state.status, 'running');
  const count = f.state.invalidations.length;
  reconcileEvidence(f.state, f.capture()); assert.equal(f.state.invalidations.length, count);
});
test('fixture and test edits invalidate evidence while documentation edits do not', t => {
  const f = fixture(t);
  f.put('tests/a.test.js', "require('../a'); const input='tests/fixtures/input.cpp';");
  f.put('tests/fixtures/input.cpp', 'first'); f.state.evidence = f.capture();
  f.put('README.md', 'new documentation'); reconcileEvidence(f.state, f.capture());
  assert.deepEqual(f.state.passedFiles, f.files);
  f.put('tests/fixtures/input.cpp', 'changed'); reconcileEvidence(f.state, f.capture());
  assert.deepEqual(f.state.passedFiles, ['tests/b.test.js']);
  f.put('tests/b.test.js', "require('../b'); // new assertion"); reconcileEvidence(f.state, f.capture());
  assert.deepEqual(f.state.passedFiles, []);
});
test('environment changes and legacy state without fingerprints cannot reuse passing results', t => {
  const f = fixture(t); f.environment.compiler = 'new-g++';
  reconcileEvidence(f.state, f.capture()); assert.deepEqual(f.state.remainingFiles, f.files);
  f.state.passedFiles = [...f.files]; delete f.state.evidence;
  reconcileEvidence(f.state, f.capture()); assert.deepEqual(f.state.passedFiles, []);
  assert.equal(f.state.invalidations.at(-1).reason, 'legacy-evidence-without-fingerprint');
});
test('animation fixture edits invalidate that case without discarding unrelated animation passes', t => {
  const f = fixture(t); const [a,b] = animationCases;
  f.put(a.fixture, 'first'); f.put(b.fixture, 'second');
  const capture = () => captureEvidence(f.root, [], { environment: f.environment });
  const state = { passedFiles: [], evidence: capture(), animation: { status: 'complete', passedItems: [a.name,b.name], failedCases: [], failedPrerequisites: [] } };
  f.put(a.fixture, 'changed'); reconcileEvidence(state, capture());
  assert.deepEqual(state.animation.passedItems, [b.name]);
  assert.deepEqual(state.animation.failedCases, [a.name]);
  assert.equal(state.animation.retryAll, false);
});
test('browser evidence covers dynamic frontend files, including newly added scripts', t => {
  const f = fixture(t); f.put('tests/a.test.js', "const chromium=require('playwright');");
  f.put('public/view.js', 'first'); f.state.evidence = f.capture();
  f.put('public/new.js', 'new script'); reconcileEvidence(f.state, f.capture());
  assert.deepEqual(f.state.passedFiles, ['tests/b.test.js']);
  assert.equal(inventory(f.root)[0].browser, true);
  const beforeVendor = f.capture();
  f.put('public/vendor/fabric.js', 'updated dependency');
  assert.notEqual(f.capture().tests['tests/a.test.js'], beforeVendor.tests['tests/a.test.js']);
  assert.equal(f.capture().tests['tests/b.test.js'], beforeVendor.tests['tests/b.test.js']);
});
