'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const { instrumentSource } = require('../trace-instrumenter');

test('saved AST spans separate declaration names from initializer expressions without changing Trace', () => {
  const source = 'int main(){ int left=2, right=left+1, unused; }';
  const instrumented = instrumentSource(source + '\n// @layout linear as scene\n');
  const context = vm.createContext({ window: {} });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const model = context.window.ASMTraceCodeModel;
  for (const name of ['left', 'right', 'unused']) {
    const recorded = Object.entries(instrumented.eventSources)
      .find(([signature, value]) => signature.startsWith('declare:')
        && value.ranges.some(range => range.role === 'declarator'
          && source.slice(range.from, range.to).startsWith(name)))[1];
    const original = JSON.stringify(recorded);
    const projected = model.eventSourceFor({ type: 'declare', name, source: recorded }, [], source, new Set());
    assert.equal(projected.ranges.map(range => source.slice(range.from, range.to)).join('').trim(), `int ${name}`);
    if (name !== 'unused') {
      const assigned = model.eventSourceFor({ type: 'assign', source: recorded }, [], source, new Set());
      assert.equal(assigned.ranges.map(range => source.slice(range.from, range.to)).join(''),
        name === 'left' ? 'left=2' : 'right=left+1');
    }
    assert.equal(JSON.stringify(recorded), original, 'presentation must not rewrite persisted source metadata');
  }
});
