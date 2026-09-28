const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadModel() {
  const context = vm.createContext({ console, Map, Set });
  context.window = context;
  context.ASMTraceEvents = {
    instructionKey(event) { return event?.signature || ''; }
  };
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  return context.ASMTraceCodeModel;
}

function fixture() {
  const sourceCode = `int main() {
  int value = 1;
  if (value > 0) {
    value++;
  }
}`;
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'main', from: 0, to: sourceCode.length,
    headerFrom: 0, headerTo: sourceCode.indexOf('{'), openLine: 1, closeLine: 6
  };
  const ifFrom = sourceCode.indexOf('if (');
  const ifContext = {
    type: 'IfStatement', functionName: 'main', from: ifFrom,
    to: sourceCode.indexOf('\n  }', ifFrom) + 4,
    headerFrom: ifFrom, headerTo: sourceCode.indexOf('{', ifFrom), openLine: 3, closeLine: 5,
    structuralLines: [3, 5]
  };
  const from = sourceCode.indexOf('value++');
  const event = {
    id: 'event-write', type: 'write', signature: 'write:main:4:value++', enabled: true,
    source: {
      functionName: 'main', from, to: from + 'value++'.length,
      line: 4, endLine: 4, text: 'value++', contexts: [functionContext, ifContext]
    }
  };
  const frame = {
    id: 'frame-1', source: { functionName: 'main', line: 4 }, events: [event], state: {}
  };
  return {
    document: { sourceCode, sourceStructure: [functionContext, ifContext], frames: [frame], studio: {} },
    frame
  };
}

test('snippet editor starts from the automatic code plan and marks exact animated expressions', () => {
  const model = loadModel();
  const { document, frame } = fixture();
  const automatic = model.automaticPlanFrame(document, frame);
  const editor = model.snippetEditorPlan(document, frame, automatic);
  const rows = editor.fragments.flatMap(fragment => fragment.rows);
  const eventRow = rows.find(row => row.text.includes('value++'));

  assert.equal(rows.length, document.sourceCode.split('\n').length,
    'the editor should keep every source line visible');
  assert.ok(rows.some(row => !row.included),
    'source lines outside the automatic snippet should remain visible but unchecked');
  assert.ok(eventRow);
  assert.equal(eventRow.autoIncluded, true);
  assert.equal(eventRow.included, true);
  assert.deepEqual(Array.from(eventRow.eventIds), ['event-write']);
  assert.equal(eventRow.segments.filter(segment => segment.eventIds.length)
    .map(segment => segment.text).join(''), 'value++');
  assert.deepEqual(
    rows.filter(row => row.included).map(row => row.number),
    automatic.fragments.flatMap(fragment => fragment.items)
      .filter(item => item.kind === 'line').map(item => item.number)
  );
});

test('per-frame snippet overrides hide one line without changing an old trace that lacks the field', () => {
  const model = loadModel();
  const { document, frame } = fixture();
  const oldLayout = model.planFrame(document, frame).layoutKey;
  const editor = model.snippetEditorPlan(document, frame);
  const eventRow = editor.fragments.flatMap(fragment => fragment.rows)
    .find(row => row.text.includes('value++'));

  document.studio.codeSnippetOverrides = {
    [frame.id]: { lineStates: { [eventRow.anchor]: false } }
  };
  const customized = model.planFrame(document, frame);
  const visible = customized.fragments.flatMap(fragment => fragment.items)
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.doesNotMatch(visible, /value\+\+/);

  delete document.studio.codeSnippetOverrides;
  assert.equal(model.planFrame(document, frame).layoutKey, oldLayout);
});
