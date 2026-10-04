const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives, findLayoutDirectives, findKeepDirectives } = require('../trace-instrumenter');

test('all semantic positioning directives accept the same layout selectors and capture level dependencies', () => {
  const selectors = ['root', 'current', 'nodes[1]', 'leaves[0]', 'children[1]', 'level(depth)[0]', 'side(right)[0]', 'box'];
  for (const selector of selectors) {
    const source = `// @layout recursion as tree
// @layout linear as notes at tree.${selector}.bottom
void f(){int a[3];int x=1,depth=1;
// @frame a at tree.${selector}.bottom
// @object x at tree.${selector}.right
// @place x.top-left at tree.${selector}.bottom-left
// @text "note" at tree.${selector}.bottom
// @camera focus tree.${selector}
// @keep x at tree.${selector}.bottom
}`;
    const [frame] = findFrameDirectives(source);
    assert.ok(frame.objects.every(object => object.objectBinding.targetName.startsWith('tree.')), selector);
    assert.ok(frame.texts[0].binding.targetName.startsWith('tree.'), selector);
    assert.ok(frame.camera.target.objectKey.startsWith('tree.'), selector);
    assert.ok(findLayoutDirectives(source)[1].binding.targetName.startsWith('tree.'), selector);
    assert.ok(findKeepDirectives(source)[0].binding.targetName.startsWith('tree.'), selector);
    if (selector.startsWith('level')) assert.ok(frame.variables.some(v => v.name === 'depth'));
  }
  assert.throws(() => findFrameDirectives('void f(){int a[2];\n// @frame a at tree.side(wrong).bottom\n}'), /節點選取無效/);
});
