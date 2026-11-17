/**
 * 測試模組：slide-library.test
 *
 * 驗證重點：slide library.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Layout = require('../public/library-layout');
const mount = require('../slide-library');

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('library reconciles deleted/new decks and preserves user ordering', () => {
  const source = { folders: [{ id: 'math', title: ' Math ', deckIds: ['b', 'gone'] }], unfiled: ['a'] };
  const result = Layout.reconcile(source, ['new', 'a', 'b']);
  assert.deepEqual(result, { folders: [{ id: 'math', title: 'Math', deckIds: ['b'] }], unfiled: ['a', 'new'] });
  assert.deepEqual(Layout.move(result, 'new', 'math', 'b').folders[0].deckIds, ['new', 'b']);
  assert.deepEqual(source.folders[0].deckIds, ['b', 'gone']);
  assert.throws(() => Layout.validate({ folders: [{ id: 'f', title: 'F', deckIds: ['a'] }], unfiled: ['a'] }));
  assert.throws(() => Layout.validate({ folders: [{ id: '../bad', title: 'F', deckIds: [] }], unfiled: [] }));
  assert.throws(() => Layout.validate({ folders: [{ id: 'x', title: 'X', deckIds: ['a', 'a'] }], unfiled: [] }));
  assert.equal(Layout.assign, undefined, 'decks have a single category; there is no multi-folder assign');
});

// 2026-11-11：每份投影片只屬於一個分類。舊資料可能把同一份投影片放在多個資料夾。
test('a deck belongs to one folder: old multi-folder data keeps the first folder', () => {
  const legacy = { folders: [{ id: 'x', title: 'X', deckIds: ['b', 'a'] }, { id: 'y', title: 'Y', deckIds: ['b', 'c'] }], unfiled: [] };
  const single = Layout.reconcile(legacy, ['a', 'b', 'c']);
  assert.deepEqual(single.folders.map(folder => folder.deckIds), [['b', 'a'], ['c']]);
  assert.deepEqual(single.unfiled, []);
  // Moving into another folder removes it from every other folder.
  assert.deepEqual(Layout.move(single, 'a', 'y', 'c').folders.map(folder => folder.deckIds), [['b'], ['a', 'c']]);
  // Moving to 未分類 removes it from all folders.
  const unfiled = Layout.move(single, 'b', '');
  assert.deepEqual(unfiled.folders.map(folder => folder.deckIds), [['a'], ['c']]);
  assert.deepEqual(unfiled.unfiled, ['b']);
  // Reordering inside a folder and dropping a deck onto itself.
  assert.deepEqual(Layout.move(single, 'a', 'x', 'b').folders[0].deckIds, ['a', 'b']);
  assert.deepEqual(Layout.move(single, 'a', 'x', 'a'), single);
  // Removing a folder sends its decks to 未分類.
  assert.deepEqual(Layout.removeFolder(single, 'x'), { folders: [{ id: 'y', title: 'Y', deckIds: ['c'] }], unfiled: ['b', 'a'] });
});

test('library API persists only the signed-in account setting and rejects foreign decks', async () => {
  const users = { owner: { preferences: { eventSettings: { speed: 2 } } }, other: { preferences: {} } };
  const decks = { owner: [{ deck_uid: 'a' }, { deck_uid: 'b' }], other: [{ deck_uid: 'foreign' }] };
  function query(value) { return { select() { return this; }, sort() { return this; }, lean: async () => value }; }
  const User = {
    findById(id) { return query(users[id]); },
    findOneAndUpdate(filter, update) {
      if (users[filter._id]) users[filter._id].preferences.slideLibrary = update.$set['preferences.slideLibrary'];
      return { select: async () => users[filter._id] ? { _id: filter._id } : null };
    }
  };
  const app = express(); app.use(express.json());
  mount(app, { User, SlideDeck: { find(filter) { return query(decks[filter.user_uid] || []); } }, authenticateToken(req, res, next) { const id = req.headers['x-test-user']; if (!id) return res.status(401).json({ error: 'login' }); req.user = { id }; next(); } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/slide-library`;
  async function request(id, layout) {
    const response = await fetch(base, { method: layout ? 'PUT' : 'GET', headers: { ...(id ? { 'x-test-user': id } : {}), 'Content-Type': 'application/json' }, ...(layout ? { body: JSON.stringify({ layout }) } : {}) });
    return { status: response.status, body: await response.json() };
  }
  try {
    assert.equal((await request(null)).status, 401);
    const layout = { folders: [{ id: 'math', title: '數學', deckIds: ['b', 'a'] }], unfiled: [] };
    assert.equal((await request('owner', layout)).status, 200);
    assert.deepEqual((await request('owner')).body.layout, layout);
    // Decks have a single category (2026-11-11): a deck listed in two folders keeps the first one.
    const multi = { folders: [...layout.folders, { id: 'graph', title: '圖論', deckIds: ['a'] }], unfiled: [] };
    assert.equal((await request('owner', multi)).status, 200);
    assert.deepEqual((await request('owner')).body.layout,
      { folders: [...layout.folders, { id: 'graph', title: '圖論', deckIds: [] }], unfiled: [] });
    assert.equal((await request('owner', layout)).status, 200);
    assert.deepEqual(users.owner.preferences.eventSettings, { speed: 2 });
    assert.deepEqual((await request('other')).body.layout.unfiled, ['foreign']);
    assert.equal((await request('owner', { folders: [], unfiled: ['foreign'] })).status, 400);
    assert.deepEqual((await request('owner')).body.layout, layout);
    assert.equal((await request('owner', { folders: [], unfiled: ['a', 'a'] })).status, 400);
    decks.owner = [{ deck_uid: 'new' }, { deck_uid: 'a' }];
    assert.deepEqual((await request('owner')).body.layout, { folders: [{ id: 'math', title: '數學', deckIds: ['a'] }], unfiled: ['new'] });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
