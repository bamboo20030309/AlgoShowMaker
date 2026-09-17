const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { compile, load } = require('./helpers/compile');
const { analyzeSource, instrumentSource } = require('../trace-instrumenter');

test('code snippet body is fully transparent without removing event highlight backgrounds', () => {
  const css = fs.readFileSync(path.join(__dirname, '../public/trace.css'), 'utf8');
  const body = css.match(/\.asm-trace-code-body\.ace-tm\s*\{([^}]+)\}/)[1];
  assert.match(body, /background:\s*transparent\s*;/);
  assert.match(css, /\.asm-trace-code-event-span[^}]+background:/s);
});

test('runtime events retain exact source spans for expression-level code highlighting', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 2;
  vector<int> arr = {3, 1};
  // @frame arr
  for (int i = 0; i < n; i++) {
    if (arr[i] > 0) arr[i]--;
    // @frame arr[i]
    // @style arr[i] point red
  }
  return 0;
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-code-model.js');
  assert.equal(trace.sourceCode, source);
  assert.ok(trace.sourceDeclarations.some(item => item.name === 'n' && item.declarationKind === 'local'));

  const events = trace.frames.flatMap(frame => frame.events);
  const increment = events.find(event => /:i\+\+$/.test(event.signature));
  const comparison = events.find(event => event.type === 'compare' && /arr\[i\]\s*>\s*0/.test(event.signature));
  assert.ok(increment, 'the for increment event should be traced');
  assert.ok(comparison, 'the if comparison event should be traced');
  assert.equal(source.slice(increment.source.from, increment.source.to), 'i++');
  assert.equal(source.slice(comparison.source.from, comparison.source.to), 'arr[i] > 0');

  const frame = trace.frames.find(item => item.events.includes(increment));
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const visible = plan.fragments.flatMap(fragment => fragment.items)
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /for \(int i = 0; i < n; i\+\+\)/);
  assert.doesNotMatch(visible, /#include|using namespace|int main|return 0/);
  assert.doesNotMatch(visible, /@frame|@style|@asm-view/);
  assert.ok(plan.fragments.flatMap(fragment => fragment.items)
    .some(item => item.kind === 'line' && item.number === 11 && item.text.trim() === '}'),
  'the closing brace for the active loop must remain visible');
  const highlightedText = plan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || [])
    .filter(segment => segment.eventIds.includes(increment.id))
    .map(segment => segment.text).join('');
  assert.equal(highlightedText, 'i++');

  load(context, 'vendor/ace/ace.js');
  load(context, 'vendor/ace/mode-c_cpp.js');
  const Mode = context.ace.require('ace/mode/c_cpp').Mode;
  const syntax = context.ASMTraceCodeModel.tokenizeSource(source, new Mode().getTokenizer());
  const forItem = plan.fragments.flatMap(fragment => fragment.items)
    .find(item => item.kind === 'line' && item.text.includes('for (int i'));
  const merged = context.ASMTraceCodeModel.mergeSyntaxSegments(forItem, syntax.get(forItem.number));
  assert.equal(merged.filter(segment => segment.eventIds.includes(increment.id))
    .map(segment => segment.text).join(''), 'i++');
  assert.ok(merged.some(segment => segment.text === 'for' && segment.tokenType === 'keyword.control'));
  assert.ok(merged.some(segment => segment.text === 'int' && segment.tokenType === 'storage.type'));
  assert.ok(merged.some(segment => segment.text === '0' && segment.tokenType === 'constant.numeric'));
  assert.ok(merged.some(segment => segment.text === '++' && segment.tokenType === 'keyword.operator'));
});

test('for-condition operands do not pull indirect input and container declarations into the snippet', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n; cin >> n;
  vector<int> arr(n);
  // @frame arr
  for (int i = 0; i < n; i++) {
    // @frame arr[i]
  }
}`;
  const { trace, context } = await compile(source, '3\n1 2 3\n');
  load(context, 'trace-code-model.js');
  const frame = trace.frames.find(candidate => candidate.events.some(event => (
    event.type === 'compare' && /i\s*<\s*n/.test(event.signature || '')
  )));
  assert.ok(frame, 'the for condition frame should exist');
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const visible = plan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /for \(int i = 0; i < n; i\+\+\)/);
  assert.doesNotMatch(visible, /int n|cin\s*>>\s*n|vector<int>\s+arr/,
    'condition-only identifiers must not expand their setup declarations');
});

test('later bubble-sort swap frames do not repeat the already visible array declaration', async () => {
  const code = fs.readFileSync(path.join(__dirname, 'fixtures', 'bubble.cpp'), 'utf8');
  const { trace, context } = await compile(code, '6\n5 7 2 1 9 4\n');
  load(context, 'trace-code-model.js');
  const frame = trace.frames.find((candidate, index) => index > 0
    && candidate.events.some(event => event.type === 'swap'));
  assert.ok(frame);
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const visible = plan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /swap\(arr\[j\], arr\[j \+ 1\]\)/);
  assert.doesNotMatch(visible, /vector<int>\s+arr\s*\(/,
    'a displayed container is already explained by the canvas and must not be reintroduced');
});

test('drawing directives are removed silently while omitted algorithm code uses ellipsis', () => {
  const source = `int main() {
  int i = 0;
  // @frame arr[i]
  // @style arr[i] point red
  i++;
  int unrelated = 1;
  unrelated += 2;
  unrelated += 3;
  unrelated += 4;
  i--;
  /* @asm-view
  { "studio": {} }
  @asm-view */
}`;
  const from = source.indexOf('i++');
  const to = from + 3;
  const event = {
    id: 'event-increment',
    type: 'write',
    line: 5,
    source: {
      from, to, line: 5, endLine: 5, functionName: 'main',
      contexts: [{ type: 'FunctionDefinition', from: 0, to: source.length, openLine: 1, closeLine: 14 }]
    }
  };
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'frame-1', source: { line: 5 }, events: [event]
  });
  const items = plan.fragments[0].items;
  const visible = items.filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.doesNotMatch(visible, /@frame|@style|@asm-view|studio/);
  assert.ok(items.some(item => item.kind === 'ellipsis'));
});

test('nearby nested control snippets keep every structural closing brace', () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 3;
  vector<int> arr = {3, 1, 2};
  // @frame arr
  for (int i = 0; i < n; i++) {
    if (arr[i] > 0) {
      arr[i]--;
    }
    // @frame arr[i]
  }
  return 0;
}`;
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const decrementFrom = source.indexOf('arr[i]--');
  const functionContext = { type: 'FunctionDefinition', from: source.indexOf('int main'), to: source.length,
    headerFrom: source.indexOf('int main'), headerTo: source.indexOf('{', source.indexOf('int main')),
    openLine: 3, closeLine: 14 };
  const forFrom = source.indexOf('for (');
  const forContext = { type: 'ForStatement', from: forFrom, to: source.lastIndexOf('  }') + 3,
    headerFrom: forFrom, headerTo: source.indexOf('{', forFrom), openLine: 7, closeLine: 12 };
  const ifFrom = source.indexOf('if (');
  const ifContext = { type: 'IfStatement', from: ifFrom, to: source.indexOf('\n    }', ifFrom) + 6,
    headerFrom: ifFrom, headerTo: source.indexOf('{', ifFrom), openLine: 8, closeLine: 10 };
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'frame-1', source: { line: 9 }, events: [{
      id: 'decrement', order: 1, type: 'write', line: 9,
      source: { from: decrementFrom, to: decrementFrom + 'arr[i]--'.length, line: 9, endLine: 9,
        functionName: 'main', contexts: [functionContext, forContext, ifContext] }
    }]
  });
  const visibleLines = plan.fragments[0].items.filter(item => item.kind === 'line');
  assert.ok(visibleLines.some(item => item.number === 10 && item.text.trim() === '}'),
    'the nested if closing brace must remain visible');
  assert.ok(visibleLines.some(item => item.number === 12 && item.text.trim() === '}'),
    'the outer for closing brace must remain visible even beyond the normal six-line target');
});

test('code presentation hides line and block comments without altering comment-like strings', () => {
  const source = `int main() {
  // 說明文字不顯示
  const char* url = "https://example.test/a//b"; // 行尾註解不顯示
  /* 多行註解
     也不顯示 */
  int value = 1; /* 內嵌註解 */ value++;
  // @frame value
  return 0;
}`;
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const urlFrom = source.indexOf('const char* url');
  const updateFrom = source.indexOf('value++');
  const functionContext = { type: 'FunctionDefinition', from: 0, to: source.length,
    headerFrom: 0, headerTo: source.indexOf('{'), openLine: 1, closeLine: 9 };
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'frame-comments', source: { line: 7 }, events: [
      { id: 'url', order: 1, type: 'assign', line: 3,
        source: { from: urlFrom, to: source.indexOf(';', urlFrom), line: 3, endLine: 3,
          functionName: 'main', contexts: [functionContext] } },
      { id: 'update', order: 2, type: 'write', line: 6,
        source: { from: updateFrom, to: updateFrom + 'value++'.length, line: 6, endLine: 6,
          functionName: 'main', contexts: [functionContext] } }
    ]
  });
  const visible = plan.fragments.flatMap(fragment => fragment.items)
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.doesNotMatch(visible, /說明文字|行尾註解|多行註解|也不顯示|內嵌註解/);
  assert.match(visible, /"https:\/\/example\.test\/a\/\/b"/);
  assert.match(visible, /int value = 1;\s+value\+\+;/);
});

test('event ranges show the complete non-main function around the enclosing loop', () => {
  const source = `void run(int n) {
  for (int i = 0; i < n; i++) {
    if (i == 0) {
      n++;
    }
    int unrelated = 42;
    if (i > 0) {
      n--;
    }
  }
}`;
  const analysis = analyzeSource(source);
  const instrumented = instrumentSource(source, analysis.variables.map(variable => variable.id));
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const eventFor = (id, expression, order) => {
    const signature = Object.keys(instrumented.eventSources)
      .find(key => key.startsWith('write:') && key.endsWith(expression));
    return { id, order, type: 'write', ...instrumented.eventSources[signature],
      source: instrumented.eventSources[signature] };
  };
  const frame = { id: 'union', events: [eventFor('up', 'n++', 1), eventFor('down', 'n--', 2)] };
  const plan = context.ASMTraceCodeModel.planFrame({
    sourceCode: source,
    sourceStructure: instrumented.sourceStructure,
    sourceDeclarations: instrumented.sourceDeclarations
  }, frame);
  assert.equal(plan.fragments.length, 1);
  const items = plan.fragments[0].items;
  const visible = items.filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /for \(int i = 0; i < n; i\+\+\)/);
  assert.match(visible, /if \(i == 0\)/);
  assert.match(visible, /if \(i > 0\)/);
  assert.match(visible, /int unrelated = 42/,
    'the complete enclosing loop body must stay visible');
  assert.match(visible, /void run/);
  assert.ok(items.some(item => item.kind === 'line' && item.text.trim() === '}'),
    'the complete function must retain its closing brace');
  assert.ok(!items.some((item, index) => item.kind === 'ellipsis'
    && items[index - 1]?.kind === 'ellipsis'));
});

test('eventless first frame derives declarations and input loop from displayed values', () => {
  const source = `int main() {
  int n;
  cin >> n;
  vector<int> arr(n);
  for (int i = 0; i < n; i++) {
    cin >> arr[i];
  }
  // @frame arr
}`;
  const analysis = analyzeSource(source);
  const instrumented = instrumentSource(source, analysis.variables.map(variable => variable.id));
  const arr = analysis.variables.find(variable => variable.name === 'arr');
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const plan = context.ASMTraceCodeModel.planFrame({
    sourceCode: source,
    variables: { [arr.id]: { name: 'arr' } },
    sourceStructure: instrumented.sourceStructure,
    sourceDeclarations: instrumented.sourceDeclarations
  }, {
    id: 'bootstrap', source: { line: 8, function: 'main' },
    state: { [arr.id]: { name: 'arr' } }, events: []
  });
  const visible = plan.fragments.flatMap(fragment => fragment.items)
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /int n;/);
  assert.match(visible, /cin >> n;/);
  assert.match(visible, /vector<int> arr\(n\);/);
  assert.match(visible, /for \(int i = 0; i < n; i\+\+\)/);
  assert.match(visible, /cin >> arr\[i\];/);
  assert.doesNotMatch(visible, /int main|@frame/);
});

test('for conditions emit ordered comparison slices and one whole-condition result', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 2;
  vector<int> arr = {3, 1};
  // @frame arr,n
  for (int i = 0; i < n && n > 0; i++) {
    // @frame arr[i],n
  }
  // @frame arr,n
}`;
  const { trace } = await compile(source);
  const conditions = trace.frames.flatMap(frame => frame.events)
    .filter(event => event.type === 'condition' && event.conditionKind === 'ForStatement');
  assert.ok(conditions.some(event => event.result === true));
  assert.ok(conditions.some(event => event.result === false));
  conditions.forEach(condition => {
    assert.equal(source.slice(condition.source.from, condition.source.to), 'i < n && n > 0');
    const frame = trace.frames.find(candidate => candidate.events.includes(condition));
    const comparisons = frame.events.filter(event => event.type === 'compare'
      && Number(event.order) < Number(condition.order));
    assert.ok(comparisons.some(event => /i\s*<\s*n/.test(event.signature)));
    if (condition.result === true) {
      assert.ok(comparisons.some(event => /n\s*>\s*0/.test(event.signature)));
    }
  });
});

test('compiled terminal for increments and their false condition share the boundary setting', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2};
  // @frame arr
  for (int j = 0; j < 2; j++) {
    // @frame arr[j]
  }
  // @frame arr
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-events.js');
  load(context, 'trace-code-model.js');
  context.ASMTraceEvents.applyEnabledStates(trace);
  const increments = trace.frames.flatMap(frame => frame.events || [])
    .filter(event => /:j\+\+$/.test(event.signature || ''));
  const boundary = increments.filter(event => event.loopBoundary === true);
  const terminalCondition = trace.frames.flatMap(candidate => candidate.events || [])
    .find(event => event.type === 'condition'
      && event.conditionKind === 'ForStatement'
      && event.result === false);
  assert.equal(boundary.length, 1, 'only the increment immediately before the false condition is a boundary event');
  assert.ok(terminalCondition, 'the terminal false condition remains available as runtime metadata');
  assert.ok(increments.some(event => event.loopBoundary !== true), 'ordinary loop increments remain normal events');
  assert.equal(boundary[0].enabled, false);
  assert.equal(boundary[0].loopBoundarySuppressed, true);
  const frame = trace.frames.find(candidate => candidate.events.includes(boundary[0]));
  const terminalRange = terminalCondition.source;
  const relatedConditionEvents = frame.events.filter(event => (
    ['read', 'compare'].includes(event.type)
    && event.loopBoundaryCondition === true
    && Number(event.source?.from) >= Number(terminalRange?.from)
    && Number(event.source?.to) <= Number(terminalRange?.to)
    && Number(event.order) <= Number(terminalCondition.order)
  ));
  assert.ok(relatedConditionEvents.length,
    'the terminal condition should retain its captured compare/read metadata');
  assert.equal(terminalCondition.loopBoundarySuppressed, true);
  assert.ok(relatedConditionEvents.every(event => event.loopBoundarySuppressed === true));
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const hiddenEventIds = new Set(plan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || []).flatMap(segment => segment.eventIds || []));
  assert.equal(plan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || [])
    .some(segment => segment.eventIds.includes(boundary[0].id)), false,
  'a disabled boundary update behaves as if its event did not exist in the code presenter');
  assert.equal(plan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || [])
    .some(segment => segment.eventIds.includes(terminalCondition.id)), false,
  'a disabled boundary also omits the final false condition highlight');
  assert.ok(relatedConditionEvents.every(event => !hiddenEventIds.has(event.id)),
    'the final condition read/compare records are hidden with the boundary');

  trace.studio ||= {};
  trace.studio.eventSettings ||= {};
  trace.studio.eventSettings.autoLoopBoundaryEnabled = true;
  context.ASMTraceEvents.applyEnabledStates(trace);
  assert.equal(boundary[0].enabled, true);
  assert.equal(boundary[0].loopBoundarySuppressed, false);
  assert.equal(terminalCondition.loopBoundarySuppressed, false);
  assert.ok(relatedConditionEvents.every(event => event.loopBoundarySuppressed === false));
  assert.equal(context.ASMTraceEvents.showInspector(boundary[0], trace), true);
  const enabledPlan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const enabledEventIds = new Set(enabledPlan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || []).flatMap(segment => segment.eventIds || []));
  assert.equal(enabledPlan.fragments.flatMap(fragment => fragment.items)
    .flatMap(item => item.segments || [])
    .some(segment => segment.eventIds.includes(terminalCondition.id)), true,
  'showing the loop boundary restores the final red/green condition highlight');
  assert.ok(relatedConditionEvents.some(event => enabledEventIds.has(event.id)),
    'showing the loop boundary restores the condition evaluation highlights');
});

test('for declaration initializers split declaration and assignment before their first comparison', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2, 1};
  // @frame arr
  for (int i = 0; i < 3; i++) {
    // @frame arr[i]
  }
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-events.js');
  context.ASMTraceEvents.applyEnabledStates(trace);
  const events = trace.frames.flatMap(frame => frame.events || []);
  const initializers = events.filter(event => (
    event.type === 'assign' && /:i\s*=\s*0$/.test(event.signature || '')
  ));
  assert.equal(initializers.length, 1, 'the for initializer must execute exactly once');
  const initializer = initializers[0];
  const frame = trace.frames.find(candidate => candidate.events.includes(initializer));
  const comparison = frame.events.find(event => (
    event.type === 'compare' && /:i\s*<\s*3$/.test(event.signature || '')
  ));
  const condition = frame.events.find(event => (
    event.type === 'condition' && /:i\s*<\s*3$/.test(event.signature || '')
  ));
  assert.ok(comparison && condition, 'the first for condition must retain compare and result events');
  assert.ok(initializer.order < comparison.order && comparison.order < condition.order,
    'initializer, comparison and whole-condition result must follow runtime order');
  assert.equal(initializer.enabled, true);
  assert.equal(condition.enabled, false);
  assert.equal(context.ASMTraceEvents.showTag('condition', trace), false);
  assert.equal(context.ASMTraceEvents.showInspector(condition, trace), false);
  assert.equal(initializer.source?.text, 'i = 0');
  const declaration = frame.events.find(event => (
    event.type === 'declare' && /:i$/.test(event.signature || '')
  ));
  assert.equal(declaration?.source?.text, 'int i');
  assert.equal(declaration?.enabled, true,
    'declaration/object entrance is enabled independently from initializer pointer motion');
});

test('nested sorting loops keep initializers and comparisons visible while conditions stay internal', async () => {
  const source = fs.readFileSync(path.join(__dirname, 'fixtures/bubble.cpp'), 'utf8');
  const { trace, context } = await compile(source, '4\n4 3 2 1\n');
  load(context, 'trace-events.js');
  trace.studio.eventSettings = {
    ...(trace.studio.eventSettings || {}),
    timelineTypes: {
      ...(trace.studio.eventSettings?.timelineTypes || {}),
      assign: false,
      compare: false,
      condition: false
    }
  };
  context.ASMTraceEvents.applyEnabledStates(trace);
  const visible = trace.frames.flatMap(frame => frame.events || []).filter(event => (
    context.ASMTraceEvents.showInspector(event, trace) !== false
  ));
  assert.ok(visible.some(event => event.type === 'assign' && /:i\s*=\s*0$/.test(event.signature || '')),
    'the outer for initializer must appear in the event inspector');
  assert.ok(visible.some(event => event.type === 'assign' && /:j\s*=\s*0$/.test(event.signature || '')),
    'the inner for initializer must appear in the event inspector');
  assert.ok(visible.some(event => event.type === 'compare' && /:i\s*</.test(event.signature || '')),
    'the outer for comparison must appear in the event inspector');
  assert.ok(visible.some(event => event.type === 'compare' && /:j\s*</.test(event.signature || '')),
    'the inner for comparison must appear in the event inspector');
  assert.equal(context.ASMTraceEvents.showTag('assign', trace), false,
    'timeline visibility can remain off without removing initializer controls');
  assert.equal(visible.some(event => event.type === 'condition'), false,
    'whole-condition results remain internal instead of creating duplicate controls');
  assert.equal(visible.some(event => event.type === 'read'), false,
    'keeping for controls editable must not flood the inspector with hidden reads');
  assert.equal(visible.some(event => (
    event.type === 'condition' && event.conditionKind === 'IfStatement'
  )), false, 'ordinary hidden condition types continue to follow timeline visibility');
});

test('comparison highlight stays yellow until its condition resolves directly to red or green', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const presenter = presenterContext.window.ASMTraceCodePresenter;
  const comparison = {
    id: 'compare-1', type: 'compare', order: 1,
    source: { from: 10, to: 18 }
  };
  const condition = {
    id: 'condition-1', type: 'condition', order: 2, result: false,
    source: { from: 10, to: 18 }
  };
  const events = new Map([[comparison.id, comparison], [condition.id, condition]]);
  const ids = [comparison.id, condition.id];
  let state = presenter.visualStateForIds(
    ids, events, new Set([comparison.id]), new Set(), comparison.id
  );
  assert.equal(state.active, true);
  state = presenter.visualStateForIds(
    ids, events, new Set([comparison.id]), new Set([comparison.id]), ''
  );
  assert.equal(state.pending, true, 'the compare-to-condition gap must remain yellow');
  assert.equal(state.complete, false, 'the gap must never fall back to gray');
  state = presenter.visualStateForIds(
    ids, events, new Set(ids), new Set([comparison.id]), condition.id
  );
  assert.equal(state.pending, true);
  assert.equal(state.active, false, 'the whole condition must not restart the yellow pulse');
  state = presenter.visualStateForIds(
    ids, events, new Set(ids), new Set(ids), ''
  );
  assert.equal(state.pending, false);
  assert.equal(state.complete, false);
  assert.equal(state.conditionResult, false);
  condition.result = true;
  state = presenter.visualStateForIds(ids, events, new Set(ids), new Set(ids), '');
  assert.equal(state.conditionResult, true);
});

test('a disabled comparison leaves its code visible without any event highlight', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const presenter = presenterContext.window.ASMTraceCodePresenter;
  const comparison = {
    id: 'compare-disabled', type: 'compare', order: 1, enabled: false,
    source: { from: 10, to: 18 }
  };
  const condition = {
    id: 'condition-disabled-compare', type: 'condition', order: 2, result: false,
    source: { from: 10, to: 18 }
  };
  const events = new Map([[comparison.id, comparison], [condition.id, condition]]);
  const ids = [comparison.id, condition.id];
  const disabled = presenter.visualStateForIds(
    ids, events, new Set(ids), new Set(ids), comparison.id
  );
  assert.equal(disabled.active, false);
  assert.equal(disabled.pending, false);
  assert.equal(disabled.complete, false);
  assert.equal(disabled.conditionResult, undefined);

  comparison.enabled = true;
  const enabled = presenter.visualStateForIds(
    ids, events, new Set(ids), new Set(ids), ''
  );
  assert.equal(enabled.conditionResult, false,
    'turning the comparison back on restores its final condition color');
});

test('a condition cannot color code when a comparison slice is disabled or absent', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const presenter = presenterContext.window.ASMTraceCodePresenter;
  const first = {
    id: 'if-first', type: 'compare', order: 1, enabled: true,
    source: { from: 10, to: 15 }
  };
  const second = {
    id: 'if-second', type: 'compare', order: 2, enabled: false,
    source: { from: 19, to: 24 }
  };
  const condition = {
    id: 'if-condition', type: 'condition', conditionKind: 'IfStatement',
    order: 3, result: true, source: { from: 10, to: 24 }
  };
  const events = new Map([first, second, condition].map(event => [event.id, event]));
  const completed = new Set(events.keys());
  let state = presenter.visualStateForIds([condition.id], events, completed, completed, '');
  assert.equal(state.conditionResult, undefined,
    'an unchecked comparison must not color the whole if condition');
  first.result = true;
  state = presenter.visualStateForIds([first.id, condition.id], events, completed, completed, '');
  assert.equal(state.conditionResult, true, 'a checked comparison slice retains its true result');
  first.result = false;
  state = presenter.visualStateForIds([first.id, condition.id], events, completed, completed, '');
  assert.equal(state.conditionResult, false, 'a checked comparison slice retains its false result');
  state = presenter.visualStateForIds([second.id, condition.id], events, completed, completed, '');
  assert.equal(state.conditionResult, undefined, 'unchecked slices remain uncolored');
  state = presenter.visualStateForIds([first.id, condition.id], events, new Set(), new Set(), '');
  assert.equal(state.conditionResult, undefined, 'a result cannot appear before its comparison completes');
  second.enabled = true;
  state = presenter.visualStateForIds([condition.id], events, completed, completed, '');
  assert.equal(state.conditionResult, true);
  state = presenter.visualStateForIds([condition.id],
    new Map([[condition.id, condition]]), completed, completed, '');
  assert.equal(state.conditionResult, undefined,
    'internal condition metadata alone must not create a code highlight');
});

test('for condition result has no color unless every comparison slice is checked', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const presenter = presenterContext.window.ASMTraceCodePresenter;
  const first = {
    id: 'for-compare-first', type: 'compare', order: 1, enabled: true,
    source: { from: 10, to: 15 }
  };
  const second = {
    id: 'for-compare-second', type: 'compare', order: 2, enabled: false,
    source: { from: 19, to: 24 }
  };
  const condition = {
    id: 'for-condition', type: 'condition', conditionKind: 'ForStatement',
    order: 3, result: false, source: { from: 10, to: 24 }
  };
  const ids = [first.id, second.id, condition.id];
  const completed = new Set(ids);
  const events = new Map(ids.map(id => [id, { [first.id]: first,
    [second.id]: second, [condition.id]: condition }[id]]));
  let state = presenter.visualStateForIds(ids, events, completed, completed, '');
  assert.equal(state.conditionResult, undefined,
    'one checked slice must not color the entire unselected for condition');
  second.enabled = true;
  state = presenter.visualStateForIds(ids, events, completed, completed, '');
  assert.equal(state.conditionResult, false);
  first.enabled = false;
  second.enabled = false;
  state = presenter.visualStateForIds(ids, events, completed, completed, '');
  assert.equal(state.conditionResult, undefined);
  state = presenter.visualStateForIds([condition.id],
    new Map([[condition.id, condition]]), completed, completed, '');
  assert.equal(state.conditionResult, undefined,
    'a for condition without a checked comparison must not fall back to coloring itself');
});

test('saved code font size follows the 1600x900 canvas viewport in every surface', () => {
  const presenterContext = { window: { addEventListener() {}, innerHeight: 900 } };
  presenterContext.window.window = presenterContext.window;
  presenterContext.window.document = { documentElement: { clientHeight: 900 } };
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const presenter = presenterContext.window.ASMTraceCodePresenter;
  assert.equal(presenter.normalizeFontSize(undefined), 20);
  assert.equal(presenter.normalizeFontSize(14), 14);
  assert.equal(presenter.normalizeFontSize(4), 8);
  assert.equal(presenter.normalizeFontSize(80), 32);
  assert.equal(presenter.scaledFontSize(18, 900), 18);
  assert.equal(presenter.scaledFontSize(18, 450), 9);
  assert.equal(presenter.scaledFontSize(18, 1125), 22.5);
  assert.equal(presenter.scaledFontSize(18, 900, 800), 9,
    'a narrow Studio canvas must scale the code panel to the available width');
  assert.equal(presenter.scaledFontSize(18, 450, 1600), 9,
    'a short slide viewport must scale the code panel to the available height');
});

test('code presentation uses the complete active function and keeps indentation', () => {
  const source = `void partition(vector<int>& arr, int n) {
  int pivot = arr[n - 1];
  int unrelated = 42;
  for (int i = 0; i < n; i++) {
    arr[i] += pivot;
    unrelated++;
  }
  unrelated += 100;
}`;
  const lineStart = source.indexOf('arr[i] += pivot');
  const forStart = source.indexOf('for (');
  const forEnd = source.indexOf('\n  }', forStart) + 4;
  const functionContext = {
    type: 'FunctionDefinition', from: 0, to: source.length, openLine: 1, closeLine: 9
  };
  const forContext = {
    type: 'ForStatement', from: forStart, to: forEnd, headerFrom: forStart,
    headerTo: source.indexOf('{', forStart), openLine: 4, closeLine: 7
  };
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const event = {
    id: 'write-arr', type: 'write', line: 5,
    source: {
      from: lineStart, to: lineStart + 'arr[i] += pivot'.length, line: 5, endLine: 5,
      functionName: 'partition', text: 'arr[i] += pivot', contexts: [functionContext, forContext]
    }
  };
  const document = {
    sourceCode: source,
    sourceDeclarations: [
      { name: 'pivot', from: source.indexOf('int pivot'), to: source.indexOf(';', source.indexOf('int pivot')) + 1,
        line: 2, functionName: 'partition', declarationKind: 'local' },
      { name: 'unrelated', from: source.indexOf('int unrelated'), to: source.indexOf(';', source.indexOf('int unrelated')) + 1,
        line: 3, functionName: 'partition', declarationKind: 'local' }
    ]
  };
  const plan = context.ASMTraceCodeModel.planFrame(document, {
    id: 'frame-subtree', source: { line: 5 }, events: [event]
  });
  const compactLines = plan.fragments[0].items.filter(item => item.kind === 'line');
  const expandedLines = plan.fragments[0].expandedItems.filter(item => item.kind === 'line');
  assert.ok(compactLines.some(item => item.number === 2 && item.text.includes('pivot')),
    'a referenced declaration outside the subtree should remain visible');
  assert.ok(compactLines.some(item => item.number === 3),
    'the complete function keeps declarations even when the active event does not reference them');
  assert.ok(expandedLines.some(item => item.number === 4 && item.text.includes('for')));
  assert.ok(expandedLines.some(item => item.number === 7 && item.text.trim() === '}'));
  assert.ok(expandedLines.some(item => item.number === 8),
    'the function body remains complete after the active loop');
  assert.equal(Math.min(...compactLines.map(item => item.text.match(/^\s*/)?.[0].length || 0)), 0,
    'common indentation should be removed from the left edge of the fragment');
  const activeLine = compactLines.find(item => item.number === 5);
  assert.match(activeLine?.text || '', /^ {4}arr\[i\]/,
    'indentation inside the selected loop remains relative to the full function');
  assert.match(plan.subtreeKey, /^FunctionDefinition:/);
});

test('unchanged snippet layout keeps a stable identity across frames', () => {
  const source = `void step() {
  int i = 0;
  while (i < 3) {
    i++;
  }
}`;
  const from = source.indexOf('i++');
  const context = { window: {} };
  context.window = context;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const sourceInfo = {
    from, to: from + 3, line: 4, endLine: 4, functionName: 'step', text: 'i++',
    contexts: [
      { type: 'FunctionDefinition', from: 0, to: source.length, openLine: 1, closeLine: 6 },
      { type: 'WhileStatement', from: source.indexOf('while'), to: source.lastIndexOf('}') - 1,
        headerFrom: source.indexOf('while'), headerTo: source.indexOf('{', source.indexOf('while')),
        openLine: 3, closeLine: 5 }
    ]
  };
  const document = { sourceCode: source, sourceDeclarations: [] };
  const first = context.ASMTraceCodeModel.planFrame(document, {
    id: 'frame-a', events: [{ id: 'event-a', type: 'write', line: 4, source: sourceInfo }]
  });
  const second = context.ASMTraceCodeModel.planFrame(document, {
    id: 'frame-b', events: [{ id: 'event-b', type: 'write', line: 4, source: sourceInfo }]
  });
  assert.equal(first.layoutKey, second.layoutKey);
  assert.equal(first.subtreeKey, second.subtreeKey);
  first.fragments.forEach(fragment => {
    assert.ok(!(fragment.items || []).some((item, index, items) => (
      item.kind === 'ellipsis' && items[index - 1]?.kind === 'ellipsis'
    )));
  });
});

test('same-subtree transitions expand only lines that either adjacent frame displays', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  const vm = require('node:vm');
  const fs = require('node:fs');
  const path = require('node:path');
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const line = number => ({ kind: 'line', number, text: `line ${number}`, segments: [] });
  const catalogue = [1, 2, 3, 4, 5].map(line);
  const previous = {
    fragments: [{ subtreeKey: 'IfStatement:0:100', items: [line(1), line(3)], expandedItems: catalogue }]
  };
  const next = {
    fragments: [{ subtreeKey: 'IfStatement:0:100', items: [line(3), line(5)], expandedItems: catalogue }]
  };
  const transition = presenterContext.window.ASMTraceCodePresenter.transitionPlan(previous, next);
  const fragment = transition.fragments[0];
  assert.deepEqual(
    [...fragment.expandedItems.filter(item => item.kind === 'line').map(item => item.number)],
    [1, 3, 5],
    'lines hidden in both frames must stay collapsed during the jump'
  );
  assert.deepEqual([...fragment.transitionEnteringLines], [5]);
  assert.deepEqual([...fragment.transitionLeavingLines], [1]);
});

test('cross-subtree code jumps scroll one source document without flying old and new pages', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  const line = number => ({ kind: 'line', number, text: `line ${number}`, segments: [] });
  const previous = {
    fragments: [{ functionName: 'first', subtreeKey: 'FunctionDefinition:0:100',
      focusLine: 2, items: [line(1), line(2)] }]
  };
  const next = {
    fragments: [{ functionName: 'second', subtreeKey: 'FunctionDefinition:100:200',
      focusLine: 12, items: [line(11), line(12)] }]
  };
  const transition = presenterContext.window.ASMTraceCodePresenter.transitionPlan(previous, next);
  assert.equal(transition.fragments.length, 2);
  assert.deepEqual([...transition.fragments.map(fragment => fragment.functionName)], ['first', 'second']);
  assert.deepEqual([...transition.fragments[0].transitionLeavingLines], [1, 2]);
  assert.deepEqual([...transition.fragments[1].transitionEnteringLines], [11, 12]);
  const code = fs.readFileSync(path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8');
  const css = fs.readFileSync(path.join(__dirname, '../public/trace.css'), 'utf8');
  assert.match(code, /if \(showExpandedTransition\(nextPage, nextPlan, syntaxLines, previous, nextFocusLine\)\) return/);
  assert.doesNotMatch(code, /previous\.classList\.add\('is-leaving'/);
  assert.doesNotMatch(css, /\.asm-trace-code-page\.is-leaving/);
});

test('code jumps actually move the expanded page to the next focus line', () => {
  const { JSDOM } = require('jsdom');
  const dom = new JSDOM('<!doctype html><div id="canvasWrapper"><svg id="arraySvg"></svg></div>', {
    url: 'http://localhost/', runScripts: 'outside-only'
  });
  const { window } = dom;
  const wrapper = window.document.getElementById('canvasWrapper');
  Object.defineProperty(wrapper, 'clientWidth', { configurable: true, get: () => 1000 });
  Object.defineProperty(wrapper, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() { return this.classList.contains('asm-trace-code-panel') ? 100 : 0; }
  });
  Object.defineProperty(window.HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      if (!this.classList.contains('asm-trace-code-panel')) return 0;
      return this.querySelector('.asm-trace-code-page.is-transition-expanded') ? 200 : 50;
    }
  });
  const frames = [];
  const timers = [];
  window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  window.setTimeout = callback => { timers.push(callback); return timers.length; };
  window.clearTimeout = () => {};
  window.matchMedia = () => ({ matches: false });
  const line = number => ({ kind: 'line', number, text: `line ${number}`, segments: [] });
  const first = { id: 'first', events: [] };
  const second = { id: 'second', events: [] };
  const third = { id: 'third', events: [] };
  const fragment = (functionName, firstLine, secondLine, focusLine) => ({
    functionName, subtreeKey: `FunctionDefinition:${functionName}`,
    focusLine, items: [line(firstLine), line(secondLine)]
  });
  const plans = {
    first: { sourceCode: 'test', layoutKey: 'L1,L2', focusLine: 2,
      fragments: [fragment('first', 1, 2, 2)] },
    second: { sourceCode: 'test', layoutKey: 'L11,L12', focusLine: 12,
      fragments: [fragment('second', 11, 12, 12)] },
    third: { sourceCode: 'test', layoutKey: 'L11,L12', focusLine: 11,
      fragments: [fragment('second', 11, 12, 11)] }
  };
  window.ASMTraceCodeModel = {
    planFrame: (_trace, frame) => plans[frame.id],
    tokenizeSource: () => new Map(),
    mergeSyntaxSegments: item => [{ text: item.text, eventIds: [] }]
  };
  const transformY = element => Number(/translateY\((-?[\d.]+)px\)/.exec(
    element.style.transform || ''
  )?.[1] || 0);
  const rect = top => ({ top, bottom: top + 20, left: 0, right: 200,
    width: 200, height: 20, x: 0, y: top });
  window.HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('asm-trace-code-body')) return rect(100);
    if (this.classList.contains('asm-trace-code-page')) return rect(100 + transformY(this));
    if (this.classList.contains('asm-trace-code-line')) {
      const page = this.closest('.asm-trace-code-page');
      const before = [...page.querySelectorAll('.asm-trace-code-line')].slice(0,
        [...page.querySelectorAll('.asm-trace-code-line')].indexOf(this));
      const height = item => item.classList.contains('is-transition-entering')
        && !page.classList.contains('is-transition-scrolling') ? 0 : 20;
      return rect(100 + transformY(page) + before.reduce((sum, item) => sum + height(item), 0));
    }
    return rect(100);
  };
  window.eval(fs.readFileSync(path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'));
  const presenter = window.ASMTraceCodePresenter;
  const trace = { studio: { codePanelPosition: { x: 0.052, y: 0.3671 } }, sourceCode: 'test' };
  presenter.renderFrame(trace, first);
  const panel = window.document.getElementById('traceCodePanel');
  const stableTop = panel.style.top;
  const body = window.document.querySelector('.asm-trace-code-body');
  assert.equal(presenter.transitionDelay(trace, second), 500);
  presenter.renderFrame(trace, second);
  const expanded = body.querySelector('.asm-trace-code-page.is-transition-expanded');
  assert.ok(expanded && body.classList.contains('is-code-scrolling'));
  const expandedStart = transformY(expanded);
  frames.splice(0).forEach(callback => callback());
  assert.equal(panel.style.top, stableTop,
    'temporary code expansion must not move the authored panel position');
  assert.notEqual(transformY(expanded), expandedStart,
    'the target line must produce a measurable nonzero scroll distance');
  const targetY = expanded.querySelector('[data-source-line="12"]').getBoundingClientRect().top;
  timers.at(-1)();
  assert.equal(panel.style.top, stableTop,
    'collapsing the snippet must keep the panel at its original height');
  assert.equal(body.querySelector('[data-source-line="12"]').getBoundingClientRect().top, targetY,
    'collapsing the old source must not move the destination line again');
  assert.equal(presenter.transitionDelay(trace, third), 500,
    'an offscreen focus line must scroll even when the layout key is unchanged');
  presenter.renderFrame(trace, third);
  assert.equal(panel.style.top, stableTop,
    'later frame changes must not re-normalize position from fragment height');
  const sameLayoutPage = body.querySelector('.asm-trace-code-page.is-transition-expanded');
  const sameLayoutStart = transformY(sameLayoutPage);
  frames.splice(0).forEach(callback => callback());
  assert.notEqual(transformY(sameLayoutPage), sameLayoutStart);
  dom.window.close();
});

test('a single omitted algorithm line stays visible instead of becoming an ellipsis', () => {
  const source = `void step(int &value) {
  int helper = 1;
  value++;
}`;
  const from = source.indexOf('value++');
  const context = { window: {} };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-model.js'), 'utf8'
  ), context);
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'step', from: 0, to: source.length,
    headerFrom: 0, headerTo: source.indexOf('{'), openLine: 1, closeLine: 4,
    structuralLines: [1, 4]
  };
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'single-gap', events: [{
      id: 'value-write', type: 'write', line: 3,
      source: {
        from, to: from + 'value++'.length, line: 3, endLine: 3,
        functionName: 'step', contexts: [functionContext]
      }
    }]
  });
  const items = plan.fragments[0].items;
  assert.ok(items.some(item => item.kind === 'line' && /helper/.test(item.text)),
    'the only omitted executable line should remain readable');
  assert.ok(!items.some(item => item.kind === 'ellipsis'));
});

test('call-only recursive context retains just the call without caller braces or declarations', () => {
  const source = 'void walk(int i) {\n  int unused = 1;\n  if (i > 0) {\n    walk(i - 1);\n  }\n}';
  const context = { window: {} };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/trace-code-model.js'), 'utf8'), context);
  const from = source.indexOf('walk(i - 1)');
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'call-only', events: [{ id: 'call', type: 'call', source: {
      functionName: 'walk', from, to: from + 'walk(i - 1)'.length, line: 4, endLine: 4
    } }]
  });
  assert.equal(plan.fragments.length, 1);
  for (const key of ['items', 'expandedItems']) {
    assert.equal(plan.fragments[0][key].length, 1);
    assert.equal(plan.fragments[0][key][0].text.trim(), 'walk(i - 1);');
  }
});

test('recursive snippets retain the function header, recursive call and closing brace', () => {
  const source = `void walk(vector<int>& arr, int i) {
  if (i >= 0) {
    arr[i]++;
    int a = 1;
    int b = 2;
    int c = 3;
    int d = 4;
  }
  walk(arr, i - 1);
}`;
  const eventFrom = source.indexOf('arr[i]++');
  const ifFrom = source.indexOf('if (');
  const ifTo = source.indexOf('\n  }', ifFrom) + 4;
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'walk', from: 0, to: source.length,
    headerFrom: 0, headerTo: source.indexOf('{'), openLine: 1, closeLine: 10,
    structuralLines: [1, 10]
  };
  const ifContext = {
    type: 'IfStatement', functionName: 'walk', from: ifFrom, to: ifTo,
    headerFrom: ifFrom, headerTo: source.indexOf('{', ifFrom), openLine: 2, closeLine: 8,
    structuralLines: [2, 8]
  };
  const context = { window: {} };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-model.js'), 'utf8'
  ), context);
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'recursive-frame', events: [{
      id: 'recursive-write', type: 'write', line: 3,
      source: {
        from: eventFrom, to: eventFrom + 'arr[i]++'.length,
        line: 3, endLine: 3, functionName: 'walk',
        contexts: [functionContext, ifContext]
      }
    }]
  });
  const visible = plan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line');
  assert.ok(visible.some(item => /^void walk/.test(item.text)));
  assert.ok(visible.some(item => /walk\(arr, i - 1\);/.test(item.text)));
  assert.ok(visible.some(item => item.number === 10 && item.text.trim() === '}'));
  ['int a = 1;', 'int b = 2;', 'int c = 3;', 'int d = 4;'].forEach(statement => {
    assert.ok(visible.some(item => item.text.includes(statement)),
      `the complete recursive function must retain ${statement}`);
  });
  assert.ok(!plan.fragments.flatMap(fragment => fragment.items || [])
    .some(item => item.kind === 'ellipsis'));
  assert.match(plan.subtreeKey, /^FunctionDefinition:/,
    'recursive frames should scroll within one stable function subtree');
});

test('a non-main function displays its complete body for every active frame', () => {
  const source = `void update(vector<int>& arr, int i) {
  int before = arr[i];
  if (before > 0) {
    arr[i] = before - 1;
  }
  int after = arr[i];
  arr[i] = after + 2;
}`;
  const eventFrom = source.indexOf('arr[i] = before - 1');
  const functionContext = {
    type: 'FunctionDefinition', functionName: 'update', from: 0, to: source.length,
    headerFrom: 0, headerTo: source.indexOf('{'), openLine: 1, closeLine: 8,
    structuralLines: [1, 8]
  };
  const ifFrom = source.indexOf('if (');
  const ifContext = {
    type: 'IfStatement', functionName: 'update', from: ifFrom,
    to: source.indexOf('\n  }', ifFrom) + 4,
    headerFrom: ifFrom, headerTo: source.indexOf('{', ifFrom), openLine: 3, closeLine: 5,
    structuralLines: [3, 5]
  };
  const context = { window: {} };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-model.js'), 'utf8'
  ), context);
  const plan = context.ASMTraceCodeModel.planFrame({ sourceCode: source }, {
    id: 'complete-function-frame', events: [{
      id: 'function-write', type: 'write', line: 4,
      source: {
        from: eventFrom, to: eventFrom + 'arr[i] = before - 1'.length,
        line: 4, endLine: 4, functionName: 'update',
        contexts: [functionContext, ifContext]
      }
    }]
  });
  const items = plan.fragments.flatMap(fragment => fragment.items || []);
  const visibleLines = items.filter(item => item.kind === 'line');
  assert.deepEqual([...visibleLines.map(item => item.number)], [1, 2, 3, 4, 5, 6, 7, 8]);
  assert.ok(!items.some(item => item.kind === 'ellipsis'));
  assert.match(plan.subtreeKey, /^FunctionDefinition:/);
});

test('code transitions use one continuous wheel-like scroll interval', () => {
  const presenterContext = { window: { addEventListener() {} } };
  presenterContext.window.window = presenterContext.window;
  vm.createContext(presenterContext.window);
  vm.runInContext(fs.readFileSync(
    path.join(__dirname, '../public/trace-code-presenter.js'), 'utf8'
  ), presenterContext.window);
  assert.equal(presenterContext.window.ASMTraceCodePresenter.scrollDuration, 460);
  const css = fs.readFileSync(path.join(__dirname, '../public/trace.css'), 'utf8');
  assert.match(css,
    /\.asm-trace-code-page\.is-transition-scrolling\s*\{[^}]*transform 460ms cubic-bezier\(0\.25, 0\.1, 0\.25, 1\)/s);
  assert.match(css,
    /is-transition-scrolling \.asm-trace-code-line\.is-transition-leaving\s*\{[^}]*max-height:\s*1\.58em;[^}]*opacity:\s*0/s);
  assert.doesNotMatch(css, /translateY\((?:-)?30px\)/,
    'cross-subtree changes must scroll by measured content distance instead of a short fade nudge');
});

test('a condition event keeps its controlled body visible even when the branch is skipped', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int value = 0;
  // @frame value
  if (value > 0) {
    value++;
    value += 2;
  }
  // @frame value
  if (value < 0) {
    value++;
    value += 2;
    value += 3;
    value += 4;
  }
  // @frame value
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-code-model.js');
  const frame = trace.frames.find(candidate => candidate.events.some(event => (
    event.type === 'condition' && event.result === false
  )));
  assert.ok(frame, 'the false condition frame should exist');
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const visible = plan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /if \(value > 0\)/);
  assert.match(visible, /value\+\+;/);
  assert.match(visible, /value \+= 2;/);
  assert.ok(plan.fragments.flatMap(fragment => fragment.items || [])
    .some(item => item.kind === 'line' && item.text.trim() === '}'));

  const longFrame = trace.frames.find(candidate => candidate.events.some(event => (
    event.type === 'condition' && /value\s*<\s*0/.test(event.signature || '')
  )));
  assert.ok(longFrame, 'the second false condition frame should exist');
  const longPlan = context.ASMTraceCodeModel.planFrame(trace, longFrame);
  const longVisible = longPlan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(longVisible, /if \(value < 0\)/);
  assert.doesNotMatch(longVisible, /value \+= 3;|value \+= 4;/,
    'condition bodies over three executable lines should remain collapsed');
});

test('legacy false branches recover their short body and every enclosing for header', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 4;
  vector<int> arr = {1, 2, 3, 4};
  // @frame arr
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        swap(arr[j], arr[j + 1]);
      }
      // @frame arr[j,j+1]
    }
  }
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-code-model.js');
  const frame = trace.frames.find(candidate => candidate.events.some(event => (
    event.type === 'condition' && event.result === false
      && /arr\[j\]\s*>\s*arr\[j\s*\+\s*1\]/.test(event.signature || '')
  )));
  assert.ok(frame, 'the false nested if frame should exist');
  const legacyFrame = {
    ...frame,
    events: frame.events.map(event => ({ ...event, source: undefined }))
  };
  const plan = context.ASMTraceCodeModel.planFrame({ ...trace, sourceStructure: [] }, legacyFrame);
  const visible = plan.fragments.flatMap(fragment => fragment.items || [])
    .filter(item => item.kind === 'line').map(item => item.text).join('\n');
  assert.match(visible, /for \(int i = 0; i < n - 1; i\+\+\)/,
    'the outer loop must remain visible');
  assert.match(visible, /for \(int j = 0; j < n - i - 1; j\+\+\)/,
    'the direct loop must remain visible');
  assert.match(visible, /if \(arr\[j\] > arr\[j \+ 1\]\)/,
    'the false condition must remain visible');
  assert.match(visible, /swap\(arr\[j\], arr\[j \+ 1\]\);/,
    'a short false branch must retain its controlled statement');
});

test('repeated runtime events share one source line and one ellipsis gap', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int main() {
  int n = 4;
  vector<int> arr = {4, 3, 2, 1};
  // @frame arr
  for (int i = 0; i < n - 1; i++) {
    for (int j = 0; j < n - i - 1; j++) {
      if (arr[j] > arr[j + 1]) {
        swap(arr[j], arr[j + 1]);
      }
      // @frame arr[j,j+1]
    }
  }
}`;
  const { trace, context } = await compile(source);
  load(context, 'trace-code-model.js');
  const assertCompactPlan = (document, frame, label) => {
    const plan = context.ASMTraceCodeModel.planFrame(document, frame);
    const items = plan.fragments.flatMap(fragment => fragment.items || []);
    const visibleLines = items.filter(item => item.kind === 'line').map(item => item.number);
    assert.equal(new Set(visibleLines).size, visibleLines.length,
      `${label} frame ${frame.id} must not repeat a source line`);
    items.forEach((item, index) => {
      assert.ok(!(item.kind === 'ellipsis' && items[index - 1]?.kind === 'ellipsis'),
        `${label} frame ${frame.id} must merge adjacent ellipses`);
    });
  };
  trace.frames.forEach(frame => {
    assertCompactPlan(trace, frame, 'current');
    assertCompactPlan({ ...trace, sourceStructure: [] }, {
      ...frame,
      events: frame.events.map(event => ({
        ...event,
        source: event.source ? { ...event.source, contexts: [] } : event.source
      }))
    }, 'legacy');
  });
});

test('one frame shows a recursive function source only once across scope exit and swap clusters', async () => {
  const source = `#include <bits/stdc++.h>
using namespace std;
int n;
void quick_sort(vector<int>& arr, int low, int high) {
  if (low >= high) return;
  int pivot = arr[high];
  int i = low;
  // @frame arr[i],pivot
  // @segment arr[low:high]
  for (int j=low; j<high; j++) {
    if (arr[j] < pivot) {
      if (i != j) swap(arr[i], arr[j]);
      i++;
    }
    // @frame arr[i,j],pivot
    // @segment arr[low:high]
  }
  if (i != high) swap(arr[i], arr[high]);
  // @frame arr[i,high],pivot
  // @segment arr[low:high]
  quick_sort(arr, low, i - 1);
  quick_sort(arr, i + 1, high);
}
int main() {
  cin>>n;
  vector<int> arr(n);
  for (int i=0; i<n; i++) cin>>arr[i];
  // @frame arr
  quick_sort(arr, 0, n - 1);
  // @frame arr
  return 0;
}`;
  const { trace, context } = await compile(source, '6\n5 7 2 1 9 4\n');
  load(context, 'trace-code-model.js');
  const frame = trace.frames[17];
  assert.ok(frame, 'the Quick Sort fixture must reach frame 18');
  const scopeExit = frame.events.find(event => event.type === 'scope-exit');
  const swap = frame.events.find(event => event.type === 'swap');
  assert.ok(scopeExit && swap, 'frame 18 must contain both separated runtime clusters');
  assert.ok(Number(scopeExit.order) < Number(swap.order));
  const plan = context.ASMTraceCodeModel.planFrame(trace, frame);
  const functionFragments = plan.fragments.filter(fragment => fragment.functionName === 'quick_sort');
  assert.equal(functionFragments.length, 1,
    'separate control clusters must not repeat the complete quick_sort source');
  const fragment = functionFragments[0];
  assert.ok(!fragment.eventIds.includes(scopeExit.id), 'exit animations do not take code space');
  assert.ok(fragment.eventIds.includes(swap.id));
  const lines = fragment.items.filter(item => item.kind === 'line');
  assert.equal(new Set(lines.map(item => item.number)).size, lines.length);
  assert.ok(!lines.some(item => item.segments.some(segment => segment.eventIds.includes(scopeExit.id))));
  assert.ok(lines.some(item => item.segments.some(segment => segment.eventIds.includes(swap.id))));
  assert.ok(frame.events.every((event, index) => index === 0
    || Number(frame.events[index - 1].order) <= Number(event.order)));
});
