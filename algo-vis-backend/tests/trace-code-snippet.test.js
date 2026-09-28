const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const viewSource = require('../public/trace-view-source.js');

function loadModel() {
  const context = vm.createContext({ console, Map, Set });
  context.window = context;
  context.ASMTraceEvents = {
    instructionKey(event) { return event?.signature || ''; }
  };
  context.ASMTraceViewSource = viewSource;
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  return context.ASMTraceCodeModel;
}

function fixture() {
  const sourceCode = `int main() {
  // editor-only explanation

  int value = 1;
  if (value > 0) {
    value++;
  }
}`;
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'main', from: 0, to: sourceCode.length,
    headerFrom: 0, headerTo: sourceCode.indexOf('{'), openLine: 1, closeLine: 8
  };
  const ifFrom = sourceCode.indexOf('if (');
  const ifContext = {
    type: 'IfStatement', functionName: 'main', from: ifFrom,
    to: sourceCode.indexOf('\n  }', ifFrom) + 4,
    headerFrom: ifFrom, headerTo: sourceCode.indexOf('{', ifFrom), openLine: 5, closeLine: 7,
    structuralLines: [5, 7]
  };
  const from = sourceCode.indexOf('value++');
  const event = {
    id: 'event-write', type: 'write', signature: 'write:main:4:value++', enabled: true,
    source: {
      functionName: 'main', from, to: from + 'value++'.length,
      line: 6, endLine: 6, text: 'value++', contexts: [functionContext, ifContext]
    }
  };
  const frame = {
    id: 'frame-1', source: { functionName: 'main', line: 6 }, events: [event], state: {}
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

  assert.equal(rows.length, document.sourceCode.split('\n').length - 2,
    'the editor should omit comment-only and blank source lines');
  assert.equal(rows.some(row => !row.text.trim() || row.text.trim().startsWith('//')), false);
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

test('manual snippet choices apply to every frame from the same source directive', () => {
  const model = loadModel();
  const { document, frame } = fixture();
  frame.source = { ...frame.source, functionName: 'main', directiveKey: 'manual-frame:lcs-build:0' };
  const repeated = JSON.parse(JSON.stringify(frame));
  repeated.id = 'frame-2';
  repeated.events[0].id = 'event-write-2';
  const other = JSON.parse(JSON.stringify(frame));
  other.id = 'frame-other';
  other.source.directiveKey = 'manual-frame:lcs-finish:0';
  other.events[0].id = 'event-write-other';
  document.frames = [frame, repeated, other];

  const rows = model.snippetEditorPlan(document, frame).fragments.flatMap(fragment => fragment.rows);
  assert.ok(rows.every(row => typeof row.autoIncluded === 'boolean' && typeof row.included === 'boolean'),
    'automatic filtering must always resolve each row to true or false');
  const eventRow = rows.find(row => row.text.includes('value++'));
  const automaticOffRow = rows.find(row => !row.autoIncluded && row.text.trim());
  assert.ok(eventRow && automaticOffRow);
  document.studio.codeSnippetSourceOverrides = [{
    sourceSelector: viewSource.sourceSelector(frame),
    lineStates: {
      [eventRow.sourceAnchor]: false,
      [automaticOffRow.sourceAnchor]: true
    }
  }];

  [frame, repeated].forEach(candidate => {
    const sharedRows = model.snippetEditorPlan(document, candidate)
      .fragments.flatMap(fragment => fragment.rows);
    assert.equal(sharedRows.find(row => row.sourceAnchor === eventRow.sourceAnchor).included, false);
    assert.equal(sharedRows.find(row => row.sourceAnchor === automaticOffRow.sourceAnchor).included, true);
  });
  const otherRows = model.snippetEditorPlan(document, other).fragments.flatMap(fragment => fragment.rows);
  assert.equal(otherRows.find(row => row.sourceAnchor === eventRow.sourceAnchor).included, true,
    'a different source directive must keep its automatic result');
});

test('snippet ellipses ignore blank and comment-only gaps but preserve hidden code gaps', () => {
  const model = loadModel();
  const sourceCode = `int main() {
  int first = 1;

  // explanation only
  int second = 2;
  int hidden = 3;
  int third = 4;
}`;
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'main', from: 0, to: sourceCode.length,
    headerFrom: 0, headerTo: sourceCode.indexOf('{'), openLine: 1, closeLine: 8
  };
  const from = sourceCode.indexOf('int second');
  const frame = {
    id: 'frame-gap',
    source: { functionName: 'main', line: 5, directiveKey: 'manual-frame:gap:0' },
    events: [{
      id: 'event-gap', type: 'write', signature: 'write:main:5:second', enabled: true,
      source: {
        functionName: 'main', from, to: from + 'int second = 2;'.length,
        line: 5, endLine: 5, text: 'int second = 2;', contexts: [functionContext]
      }
    }],
    state: {}
  };
  const document = {
    sourceCode, sourceStructure: [functionContext], frames: [frame], studio: {}
  };
  const rows = model.snippetEditorPlan(document, frame).fragments.flatMap(fragment => fragment.rows);
  const includedLines = new Set([2, 5, 7]);
  document.studio.codeSnippetSourceOverrides = [{
    sourceSelector: viewSource.sourceSelector(frame),
    lineStates: Object.fromEntries(rows.map(row => [row.sourceAnchor, includedLines.has(row.number)]))
  }];

  const items = model.planFrame(document, frame).fragments.flatMap(fragment => fragment.items);
  assert.deepEqual(Array.from(items, item => item.kind === 'line' ? `line:${item.number}` : item.kind), [
    'line:2',
    'line:5',
    'ellipsis',
    'line:7'
  ]);
});
