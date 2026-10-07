const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../server.js'), 'utf8');
function route(start, end, model) {
  let callback;
  vm.runInNewContext(source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))), {
    app: { get: (path, auth, handler) => { assert.equal(typeof auth, 'function'); callback = handler; } },
    authenticateToken() {}, SlideDeck: model, console,
    User: { findById() { return { select() { return this; }, lean: async () => ({preferences:{slideLibrary:{folders:[{id:'sort',title:'排序',deckIds:['one']}],unfiled:[]}}}) }; } },
    SlideLibraryLayout: require('../public/library-layout')
  });
  return callback;
}
function response() {
  return { statusCode: 200, headers: {}, status(code) { this.statusCode = code; return this; },
    set(key, value) { this.headers[key] = value; return this; }, json(data) { this.body = data; return this; } };
}
test('card list includes thumbnail, categories and layout without reading full decks', async () => {
  const handler = route("app.get('/api/slides',", "app.post('/api/slides',", {
    find(query) {
      assert.equal(query.user_uid, 'owner');
      return { select(fields) { assert.ok(!fields.split(' ').includes('deck')); return this; }, sort() { return this; }, lean: async () => [{ deck_uid: 'one', title:'範例', slide_count:12, cover_thumbnail: 'image', updated_at: 'revision' }] };
    }
  });
  const lazy = response(); await handler({ user: { id: 'owner' }, get: () => 'lazy' }, lazy);
  assert.equal(lazy.body.slides[0].cover_thumbnail, 'image'); assert.equal(lazy.body.slides[0].has_thumbnail, true);
  assert.equal(lazy.body.slides[0].slide_count,12);
  assert.equal(lazy.body.slides[0].categories[0].title,'排序');
  assert.equal(lazy.body.slides[0].deck,undefined);
  assert.equal(lazy.body.layout.folders[0].id,'sort');
  const legacy = response(); await handler({ user: { id: 'owner' }, get: () => undefined }, legacy);
  assert.equal(legacy.body.slides[0].cover_thumbnail, 'image');
});
test('thumbnail endpoint restricts lookup to authenticated owner and returns revision without full deck', async () => {
  let found = true;
  const handler = route("app.get('/api/slides/:deck_uid/thumbnail',", "app.get('/api/slides/:deck_uid',", {
    findOne(query) {
      assert.equal(query.user_uid, 'owner'); assert.equal(query.deck_uid, 'one');
      return { select(projection) { assert.equal(projection, 'cover_thumbnail updated_at'); return this; },
        lean: async () => found ? { cover_thumbnail: 'image', updated_at: 'revision' } : null };
    }
  });
  const request = { user: { id: 'owner' }, params: { deck_uid: 'one' } }, res = response();
  await handler(request, res); assert.equal(res.body.thumbnail, 'image'); assert.equal(res.body.updated_at, 'revision');
  assert.equal(res.body.deck, undefined); assert.equal(res.headers['Cache-Control'], 'private, no-store');
  found = false; const absent = response(); await handler(request, absent); assert.equal(absent.statusCode, 404);
});
