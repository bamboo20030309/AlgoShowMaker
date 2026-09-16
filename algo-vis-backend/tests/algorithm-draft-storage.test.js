const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const front = fs.readFileSync(path.join(__dirname, '../public/front.js'), 'utf8');
const draftCode = front.split('// 保留目前正在編輯的程式碼，避免重新整理後被預設範例覆蓋。')[1]
  .split('window.asmGetSourceCode =')[0];

function storage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key),
    keys: () => [...values.keys()]
  };
}

function page(local, session, pathname = '/algorithm.html', search = '') {
  const editorState = { code: '', input: '', cursor: { row: 0, column: 0 }, scrollTop: 0 };
  const inputArea = { get value() { return editorState.input; }, set value(value) { editorState.input = value; } };
  const aceEditor = {
    getValue: () => editorState.code,
    setValue: value => { editorState.code = value; },
    getCursorPosition: () => editorState.cursor,
    moveCursorTo: (row, column) => { editorState.cursor = { row, column }; },
    clearSelection() {},
    session: {
      on() {},
      getScrollTop: () => editorState.scrollTop,
      setScrollTop: value => { editorState.scrollTop = value; }
    }
  };
  const window = {
    location: { pathname, search },
    addEventListener() {}
  };
  const context = vm.createContext({
    aceEditor, window, localStorage: local, sessionStorage: session,
    document: { getElementById: () => inputArea, addEventListener() {}, visibilityState: 'visible' },
    URLSearchParams, Date, console,
    setTimeout: () => 1, clearTimeout() {}
  });
  vm.runInContext(draftCode, context);
  return { editorState, draft: window.ASMAlgorithmDraft };
}

test('two algorithm pages keep separate code and input across reloads', () => {
  const local = storage();
  const firstSession = storage();
  const secondSession = storage();
  const first = page(local, firstSession);
  const second = page(local, secondSession);
  first.editorState.code = 'int first = 1;';
  first.editorState.input = '1\n';
  first.draft.save();
  second.editorState.code = 'int second = 2;';
  second.editorState.input = '2\n';
  second.draft.save();
  assert.equal(page(local, firstSession).editorState.code, 'int first = 1;');
  assert.equal(page(local, firstSession).editorState.input, '1\n');
  assert.equal(page(local, secondSession).editorState.code, 'int second = 2;');
  assert.equal(page(local, secondSession).editorState.input, '2\n');
  assert.equal(local.keys().some(key => key.includes(':page:')), false);
});

test('path and embed mode have separate page-session drafts', () => {
  const local = storage();
  const session = storage();
  const standalone = page(local, session);
  standalone.editorState.code = 'standalone';
  standalone.draft.save();
  const embedded = page(local, session, '/algorithm.html', '?asmEmbed=editor');
  embedded.editorState.code = 'embedded';
  embedded.draft.save();
  const anotherPath = page(local, session, '/another.html');
  anotherPath.editorState.code = 'another';
  anotherPath.draft.save();
  assert.equal(page(local, session).editorState.code, 'standalone');
  assert.equal(page(local, session, '/algorithm.html', '?asmEmbed=editor').editorState.code, 'embedded');
  assert.equal(page(local, session, '/another.html').editorState.code, 'another');
});

test('the old shared local draft migrates once without deleting the old copy', () => {
  const local = storage();
  const firstSession = storage();
  const secondSession = storage();
  const old = JSON.stringify({ version: 2, code: 'legacy', input: '7\n', updatedAt: 1000 });
  local.setItem('asm_algorithm_draft_v2:standalone', old);
  assert.equal(page(local, firstSession).editorState.code, 'legacy');
  assert.equal(page(local, secondSession).editorState.code, '');
  assert.equal(local.getItem('asm_algorithm_draft_v2:standalone'), old);
  assert.equal(page(local, firstSession).editorState.input, '7\n');
  local.setItem('asm_algorithm_draft_v2:standalone', JSON.stringify({
    version: 2, code: 'newer old tab', input: '8\n', updatedAt: 1001
  }));
  assert.equal(page(local, secondSession).editorState.code, 'newer old tab');
});
