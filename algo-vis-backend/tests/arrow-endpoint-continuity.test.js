const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const context = vm.createContext({ window: {}, document: { documentElement: { dataset: {} } }, queueMicrotask() {} });
vm.runInContext(fs.readFileSync('public/trace-renderer.js', 'utf8'), context);
const sameBinding = context.window.ASMTraceRenderers.sameArrowEndpointBinding;
const endpoint = (key, owner, extra = {}) => ({ dataset: { traceArrowFromKey: key,
  traceArrowFromOwner: owner, traceArrowFromAnchor: 'top', traceArrowFromDx: '0', traceArrowFromDy: '0',
  traceArrowFromCell: 'false', ...extra } });
test('live-to-keep keeps the presented node endpoint instead of blending it a second time', () => {
  const identity = JSON.stringify(['merge_tree', 'activation-8', '']);
  assert.equal(sameBinding(endpoint('merged', identity), endpoint('snapshot:frame:18', identity), 'From'), true);
  assert.equal(sameBinding(endpoint('merged', identity), endpoint('merged', '["merge_tree","activation-2",""]'), 'From'), false);
  assert.equal(sameBinding(endpoint('merged', identity), endpoint('snapshot:frame:18', identity,
    { traceArrowFromAnchor: 'bottom' }), 'From'), false);
  assert.equal(sameBinding(endpoint('a', ''), endpoint('a', ''), 'From'), true, 'old arrows without owner metadata remain compatible');
  assert.equal(sameBinding(endpoint('a', ''), endpoint('b', ''), 'From'), false);
});
