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
    'pegs[to].push_front(pegs[from].front());',
    'pegs[from].pop_front();',
    'ans.push_back(from + " → " + to);',
    'cout<<from<<" -> "<<to<<endl;',
    'hanoi(n-1, aux, to, from);'
  ]) assert.ok(code.includes(statement), `original statement is retained: ${statement}`);

  assert.match(code, /@layout recursion as "hanoi_tree" at canvas\.left offset\(360,100\)/);
  assert.match(code, /@layout hanoi_tree direction left-right/);
  assert.doesNotMatch(code, /@layout hanoi_tree mode/);
  assert.doesNotMatch(code, /@layout hanoi_tree sibling-gap/);
  assert.match(code, /@layout hanoi_tree degree 3/);
  assert.doesNotMatch(code, /@layout hanoi_tree flow-arrows/);
  assert.match(code, /@layout hanoi_tree background AV_opaque_red/);
  assert.match(code, /@branch as "Move" in hanoi_tree/);
  assert.match(code, /@endbranch/);
  assert.match(code, /@let state = n/);
  assert.doesNotMatch(code, /string\s+state\s*=/);
  assert.match(code, /@let disk = n/);
  assert.doesNotMatch(code, /int\s+disk\s*=/);
  assert.match(code, /@let move_index = ans\.size\(\) - 1/);
  assert.doesNotMatch(code, /int\s+move_index\s*=/);
  assert.match(code, /@object state in hanoi_tree with display\("\$\{n\},\$\{from\}→\$\{to\}"\)/);
  assert.match(code, /@object state in hanoi_tree with display\("1, \$\{from\}→\$\{to\}"\)/);
  assert.match(code, /@object ans render normal with columns\(1\), gap\(0,68\)/);
  assert.match(code, /@place ans\.top-left at hanoi_tree\.top-right offset\(150,0\)/);
  assert.match(code, /@arrow from state\[0\]\.right to ans\[move_index\]\.left/);
  assert.equal((code.match(/@object Peg_A, Peg_B, Peg_C render disk with capacity\(N\)/g) || []).length, 1,
    'shared scene objects are declared by one reusable multi-object directive');
  assert.match(code, /@style state\[0\] highlight/);
  assert.match(code, /@style state\[0\] point/);
  assert.equal((code.match(/河內塔遞迴的核心概念/g) || []).length, 3,
    'each root preview authors its own old-sample color emphasis');
  assert.match(code, /@preset core_preview_text/);
  assert.match(code, /at recursion_parent\.top offset\(0,-20\) when recursion_preview && recursion_depth == 1/);
  assert.match(code, /when recursion_preview && recursion_depth > 1 && recursion_branch == 0/);
  assert.match(code, /when recursion_preview && recursion_depth > 1 && recursion_branch == 2/);
  assert.match(code, /"background":"AV_opaque_red","color":"black"/);
  assert.match(code, /"background":"AV_opaque_green","color":"black"/);
  assert.match(code, /@frame use hanoi_node_view, current_node_view, hanoi_scene_view when n > 1/);
  assert.doesNotMatch(code, /if\s*\(n\s*>\s*1\s*\)/);
  assert.equal((code.match(/@let count =/g) || []).length, 2,
    'message values are calculated by drawing aliases');
  assert.doesNotMatch(code, /string\s+(?:next_preview_text|frame_text|handoff_text|left_preview_text|move_preview_text|right_preview_text)\b/);
  assert.match(code, /@frame use hanoi_node_view, current_node_view, hanoi_scene_view, active_disks_view/);
  assert.match(code, /@frame use move_node_view, current_node_view, hanoi_scene_view, active_disks_view/);
  assert.doesNotMatch(code, /all_disks_view/);
  assert.equal((code.match(/@code hide/g) || []).length, 3,
    'drawing declarations, initialization and mutations stay hidden from the C++ timeline');
  assert.match(code, /@place Peg_A\.top-left at canvas\.top-left offset\(70,60\)/);
  assert.match(code, /@place Peg_B\.top-left at Peg_A\.bottom-left offset\(0,36\)/);
  assert.match(code, /@place Peg_C\.top-left at Peg_B\.bottom-left offset\(0,36\)/);

  const { trace } = await compile(code, input);
  assert.equal(trace.frames.length, 75,
    'each non-leaf call adds one handoff frame after its three branch previews');
  assert.equal(trace.layouts.length, 1);
  assert.deepEqual({
    id: trace.layouts[0].id,
    direction: trace.layouts[0].direction,
    mode: trace.layouts[0].mode,
    degree: trace.layouts[0].degree,
    showFlowArrows: trace.layouts[0].showFlowArrows,
    background: trace.layouts[0].background
  }, { id: 'hanoi_tree', direction: 'left-right', mode: 'compact', degree: 3, showFlowArrows: false, background: 'AV_opaque_red' });

  assert.equal(trace.snapshots.length, 45,
    '15 recursion calls and two visual states for each of the 15 move branches are retained');
  assert.equal(new Set(trace.snapshots.map(snapshot => snapshot.objectId)).size, 30);
  const roots = trace.snapshots.filter(snapshot => !snapshot.layoutNode?.parentSnapshotId);
  assert.equal(roots.length, 1);
  assert.equal(Number(roots[0].data.value), 4);
  assert.equal(trace.frames[0].source.recursionActivationId, roots[0].recursionActivationId,
    'the preserved introduction frame renders the live root activation before it is kept');
  assert.notEqual(trace.frames[0].id, roots[0].createdFrameId,
    'the root snapshot is kept by the following processing frame, preserving preview order');
  const rootChildren = trace.snapshots.filter(snapshot => (
    snapshot.recursionParentActivationId === roots[0].recursionActivationId
  ));
  assert.deepEqual([...new Set(rootChildren.map(snapshot => snapshot.layoutNode.siblingIndex))], [0, 1, 2]);
  assert.equal(trace.frames.filter(frame => frame.source?.systemBranchPreview).length, 21);
  assert.equal(trace.snapshots.filter(snapshot => snapshot.arrows?.length).length, 15);
  assert.equal(trace.frames.at(-1).arrows.length, 15,
    'every completed Move keeps its arrow connected to the corresponding answer');

  const variableIds = Object.fromEntries(Object.entries(trace.variables)
    .map(([id, variable]) => [variable.name, id]));
  const stateValues = (frame, name) => (
    Array.from(frame.state[variableIds[name]].data.items, item => Number(item.value))
  );
  const rootPreviews = Array.from(trace.frames).filter(frame => (
    frame.source?.systemBranchPreview
      && frame.source?.recursionParentActivationId === roots[0].recursionActivationId
  )).sort((left, right) => (
    left.source.recursionSiblingIndex - right.source.recursionSiblingIndex
  ));
  assert.equal(rootPreviews.length, 3);
  assert.deepEqual(rootPreviews.map(frame => [
    stateValues(frame, 'Peg_A'), stateValues(frame, 'Peg_B'), stateValues(frame, 'Peg_C')
  ]), [
    [[4], [1, 2, 3], []],
    [[], [1, 2, 3], [4]],
    [[], [], [1, 2, 3, 4]]
  ]);
  assert.ok(rootPreviews.every(frame => frame.state[variableIds.ans].data.items.length === 0),
    'branch previews do not reveal answer rows before the real moves run');
  const handoffFrame = trace.frames[trace.frames.indexOf(rootPreviews[2]) + 1];
  assert.deepEqual([
    stateValues(handoffFrame, 'Peg_A'),
    stateValues(handoffFrame, 'Peg_B'),
    stateValues(handoffFrame, 'Peg_C')
  ], [[], [], [1, 2, 3, 4]], 'handoff holds the final preview position');
  assert.deepEqual(Array.from(handoffFrame.styles, style => style.styleType), ['highlight', 'point'],
    'handoff applies the current-node marker but removes disk coloring');
  const restoredFrame = trace.frames[trace.frames.indexOf(handoffFrame) + 1];
  assert.deepEqual([
    stateValues(restoredFrame, 'Peg_A'),
    stateValues(restoredFrame, 'Peg_B'),
    stateValues(restoredFrame, 'Peg_C')
  ], [[1, 2, 3, 4], [], []], 'the next frame restores the real state and starts recursion');
  const finalState = trace.frames.at(-1).state;
  const values = name => finalState[variableIds[name]].data.items.map(item => Number(item.value));
  assert.deepEqual(values('Peg_A'), []);
  assert.deepEqual(values('Peg_B'), []);
  assert.deepEqual(values('Peg_C'), [1, 2, 3, 4]);

  const hiddenMutationEvents = trace.frames.flatMap(frame => frame.events).filter(event => (
    ['pegs[from].pop_front()', 'pegs[to].push_front(pegs[from].front())', 'ans.push_back(from + " → " + to)']
      .includes(event.source?.text)
  ));
  assert.equal(hiddenMutationEvents.length, 0,
    '@code hide keeps the drawing-state mutations out of the event timeline');
});
