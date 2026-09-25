const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./helpers/compile');

const samplePath = path.join(__dirname, '../algorithm_sample/Backtracking/hanoi-recursion.cpp');
const inputPath = path.join(__dirname, '../algorithm_sample/Backtracking/hanoi-recursion-sample_input.txt');

test('Hanoi sample preserves the original algorithm and renders three disk pegs beside its recursion tree', async () => {
  assert.ok(process.env.ASM_TEST_BASE_URL, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(samplePath, 'utf8');
  const input = fs.readFileSync(inputPath, 'utf8');

  assert.doesNotMatch(code, /AV\.hpp|TreeLayout|\/\/draw\{|draw_all_pegs|color_groups/);
  for (const statement of [
    'if(n==0)return;',
    'hanoi(n-1, from, aux, to);',
    'int disk = pegs[from].front();',
    'pegs[from].pop_front();',
    'pegs[to].push_front(disk);',
    'ans.push_back(from + " → " + to);',
    'cout<<from<<" -> "<<to<<endl;',
    'hanoi(n-1, aux, to, from);'
  ]) assert.ok(code.includes(statement), `original statement is retained: ${statement}`);

  assert.match(code, /@layout recursion as "hanoi_tree" at canvas\.left offset\(360,310\)/);
  assert.match(code, /@layout hanoi_tree direction left-right/);
  assert.match(code, /@layout hanoi_tree degree 2/);
  assert.match(code, /@layout hanoi_tree flow-arrows on/);
  for (const peg of ['Peg_A', 'Peg_B', 'Peg_C']) {
    assert.match(code, new RegExp(`@object ${peg} render disk`));
  }
  assert.match(code, /@place Peg_A\.top-left at canvas\.top-left offset\(70,60\)/);
  assert.match(code, /@place Peg_B\.top-left at Peg_A\.bottom-left offset\(0,36\)/);
  assert.match(code, /@place Peg_C\.top-left at Peg_B\.bottom-left offset\(0,36\)/);

  const { trace } = await compile(code, input);
  assert.equal(trace.frames.length, 47,
    'the sample has an initial frame, three frames per non-base call, and a final frame');
  assert.equal(trace.layouts.length, 1);
  assert.deepEqual({
    id: trace.layouts[0].id,
    direction: trace.layouts[0].direction,
    degree: trace.layouts[0].degree,
    showFlowArrows: trace.layouts[0].showFlowArrows
  }, { id: 'hanoi_tree', direction: 'left-right', degree: 2, showFlowArrows: true });

  assert.equal(trace.snapshots.length, 15, 'N=4 creates the 15 visible non-base recursion calls');
  assert.equal(new Set(trace.snapshots.map(snapshot => snapshot.objectId)).size, 15);
  const roots = trace.snapshots.filter(snapshot => !snapshot.layoutNode?.parentSnapshotId);
  assert.equal(roots.length, 1);
  assert.equal(roots[0].data.value, '4,A→C');
  const rootChildren = trace.snapshots.filter(snapshot => (
    snapshot.recursionParentActivationId === roots[0].recursionActivationId
  ));
  assert.deepEqual(rootChildren.map(snapshot => snapshot.layoutNode.siblingIndex), [0, 1]);

  const variableIds = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const finalState = trace.frames.at(-1).state;
  const values = name => finalState[variableIds[name]].data.items.map(item => Number(item.value));
  assert.deepEqual(values('Peg_A'), []);
  assert.deepEqual(values('Peg_B'), []);
  assert.deepEqual(values('Peg_C'), [1, 2, 3, 4]);

  const writes = trace.frames.flatMap(frame => frame.events).filter(event => event.type === 'write');
  const fromWrites = writes.filter(event => event.source?.text === 'pegs[from].pop_front()');
  const toWrites = writes.filter(event => event.source?.text === 'pegs[to].push_front(disk)');
  assert.equal(fromWrites.length, 15);
  assert.equal(toWrites.length, 15);
  assert.ok(fromWrites.every(event => event.targets[0].indexExpression === 'from'));
  assert.ok(toWrites.every(event => event.targets[0].indexExpression === 'to'));
});
