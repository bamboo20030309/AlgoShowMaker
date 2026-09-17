// Opt-in live MongoDB check. Only a uniquely named disposable database is touched.
require('dotenv').config({ quiet: true });
const assert = require('node:assert/strict');
const mongoose = require('mongoose');
const express = require('express');
const { randomUUID } = require('node:crypto');
const { register } = require('../cloud-content');
const Cloud = require('../public/slides-cloud');
const Storage = require('../public/slides-storage');

async function main() {
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required');
  const dbName = 'asm_cloud_regression_' + randomUUID().replace(/-/g, '');
  const connection = await mongoose.createConnection(process.env.MONGO_URI, { dbName }).asPromise();
  let server;
  try {
    const schema = new mongoose.Schema({ deck_uid: String, user_uid: String, deck: mongoose.Schema.Types.Mixed,
      cloud_snapshot: String, resource_keys: [String], updated_at: Date,
      share_mode: String, share_edit_token: String }, { strict: false });
    const Deck = connection.model('SlideDeck', schema);
    await Deck.create({ deck_uid: 'owned', user_uid: 'owner', deck: { groups: [] }, updated_at: new Date(1),
      share_mode: 'edit', share_edit_token: 'edit-link' });
    const app = express();
    app.use(express.json({ limit: '8mb' }));
    const content = register(app, { Schema: mongoose.Schema, model: connection.model.bind(connection) },
      Deck, (req, res, next) => {
        if (!req.headers['x-test-user']) return res.status(401).json({ error: 'unauthorized' });
        req.user = { id: req.headers['x-test-user'] }; next();
      }, value => value, value => value || '');
    await connection.model('SlideResourceChunk').init();
    server = await new Promise(resolve => { const listening = app.listen(0, '127.0.0.1', () => resolve(listening)); });
    const base = 'http://127.0.0.1:' + server.address().port;
    const first = { groups: [{ slides: [{ animation: { code: 'cpp', input: '',
      traceDocument: { frames: [{ state: { arr: ['x'.repeat(9 * 1024 * 1024)] } }], studio: { zoom: 2 } } } }] }] };
    const options = { endpoint: base + '/api/slides/owned', headers: { 'Content-Type': 'application/json', 'x-test-user': 'owner' },
      fetch, storage: Storage, title: 'large test' };
    await Cloud.save(first, options);
    let stored = await Deck.findOne({ deck_uid: 'owned' }).lean();
    assert.deepEqual((await content.restore(stored)).deck, first);
    assert.ok(JSON.stringify(stored).length < 10000);
    const oldKeys = stored.resource_keys;
    const Chunk = connection.model('SlideResourceChunk');
    const oldCount = await Chunk.countDocuments();
    await Cloud.save(first, options);
    assert.equal(await Chunk.countDocuments(), oldCount);
    for (const [user, expected] of [['intruder', 403], ['', 401]]) {
      const response = await fetch(options.endpoint + '/resources/' + oldKeys[0],
        { headers: user ? { 'x-test-user': user } : {} });
      assert.equal(response.status, expected);
    }
    assert.equal((await fetch(base + '/api/shared-slides/not-edit/resources/' + oldKeys[0])).status, 403);
    const second = structuredClone(first);
    second.groups[0].slides[0].animation.traceDocument.frames[0].state.arr = [42];
    await Cloud.save(second, { ...options, endpoint: base + '/api/shared-slides/edit-link',
      headers: { 'Content-Type': 'application/json' } });
    stored = await Deck.findOne({ deck_uid: 'owned' }).lean();
    assert.deepEqual((await content.restore(stored)).deck, second);
    assert.equal(await Chunk.countDocuments({ key: { $in: oldKeys.filter(key => !stored.resource_keys.includes(key)) } }), 0);
    const before = stored.cloud_snapshot;
    const failed = await fetch(options.endpoint + '/content', { method: 'PUT', headers: options.headers,
      body: JSON.stringify({ snapshot: 'f'.repeat(64), title: 'invalid' }) });
    assert.equal(failed.status, 400);
    assert.equal((await Deck.findOne({ deck_uid: 'owned' }).lean()).cloud_snapshot, before);
    console.log('PASS live Mongo: >8 MB save, dedup, exact restore, replacement GC, owner/share denial, failed commit safety');
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    // The name is generated above, never provided by the caller.
    if (!/^asm_cloud_regression_[a-f0-9]{32}$/.test(connection.name)) throw new Error('Unsafe test database name');
    await connection.dropDatabase();
    await connection.close();
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
