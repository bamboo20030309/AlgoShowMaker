const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const Layout = require('../public/library-layout');
const mount = require('../slide-library');

test('library reconciles deleted/new decks and preserves user ordering', () => {
  const source = { folders: [{ id: 'math', title: ' Math ', deckIds: ['b', 'gone'] }], unfiled: ['a'] };
  const result = Layout.reconcile(source, ['new', 'a', 'b']);
  assert.deepEqual(result, { folders: [{ id: 'math', title: 'Math', deckIds: ['b'] }], unfiled: ['a', 'new'] });
  assert.deepEqual(Layout.move(result, 'new', 'math', 'b').folders[0].deckIds, ['new', 'b']);
  assert.deepEqual(source.folders[0].deckIds, ['b', 'gone']);
  assert.throws(() => Layout.validate({ folders: [{ id: 'f', title: 'F', deckIds: ['a'] }], unfiled: ['a'] }));
  assert.throws(() => Layout.validate({ folders: [{ id: '../bad', title: 'F', deckIds: [] }], unfiled: [] }));
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
    assert.deepEqual(users.owner.preferences.eventSettings, { speed: 2 });
    assert.deepEqual((await request('other')).body.layout.unfiled, ['foreign']);
    assert.equal((await request('owner', { folders: [], unfiled: ['foreign'] })).status, 400);
    assert.deepEqual((await request('owner')).body.layout, layout);
    assert.equal((await request('owner', { folders: [], unfiled: ['a', 'a'] })).status, 400);
    decks.owner = [{ deck_uid: 'new' }, { deck_uid: 'a' }];
    assert.deepEqual((await request('owner')).body.layout, { folders: [{ id: 'math', title: '數學', deckIds: ['a'] }], unfiled: ['new'] });
  } finally { await new Promise(resolve => server.close(resolve)); }
});
