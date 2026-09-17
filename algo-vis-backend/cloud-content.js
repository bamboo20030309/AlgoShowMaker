const { createHash } = require('node:crypto');
const SlideStorage = require('./public/slides-storage');
const CHUNK_CHARS = 256 * 1024;
const MAX_BYTES = 128 * 1024 * 1024;
const MAX_DECK_BYTES = 512 * 1024 * 1024;
const hash = text => createHash('sha256').update(text).digest('hex');
const fault = (message, status = 400) => Object.assign(new Error(message), { status });
const validKey = key => /^[a-f0-9]{64}$/.test(key);

function createStore(repo) {
  const locks = new Map();
  async function exclusive(id, action) {
    const previous = locks.get(id) || Promise.resolve();
    const task = previous.catch(() => {}).then(action);
    locks.set(id, task);
    try { return await task; }
    finally { if (locks.get(id) === task) locks.delete(id); }
  }
  async function read(id, key) {
    if (!validKey(key)) throw fault('資源 ID 無效');
    const parts = await repo.parts(id, key);
    if (!parts.length || parts.length !== parts[0].total
      || parts.some((part, index) => part.part !== index || part.total !== parts[0].total)) {
      throw fault('動畫或素材尚未完整上傳，請重試');
    }
    const text = parts.map(part => part.data).join('');
    if (Buffer.byteLength(text) > MAX_BYTES || hash(text) !== key) throw fault('資源雜湊或容量驗證失敗');
    return text;
  }
  async function put(id, key, part, total, data) {
    if (!validKey(key) || !Number.isInteger(part) || !Number.isInteger(total)
      || total < 1 || total > 512 || part < 0 || part >= total
      || typeof data !== 'string' || data.length > CHUNK_CHARS + 1) throw fault('上傳分塊格式無效');
    await exclusive(id, async () => {
      const old = (await repo.parts(id, key)).find(value => value.part === part);
      if (old && (old.data !== data || old.total !== total)) throw fault('同一資源的分塊內容衝突', 409);
      const usage = await repo.usage(id);
      if (!old && usage + Buffer.byteLength(data) > MAX_DECK_BYTES * 2) throw fault('投影片暫存上傳容量已達上限', 413);
      await repo.put(id, key, part, total, data);
    });
  }
  async function snapshot(id, key) {
    let record;
    try { record = JSON.parse(await read(id, key)); }
    catch (error) { throw error.status ? error : fault('儲存快照格式無效'); }
    if (record.version !== 1 || !record.deck || !Array.isArray(record.references)
      || !Array.isArray(record.asset_keys)) throw fault('儲存快照格式無效');
    const keys = [...new Set([key, ...record.references.map(ref => ref.key), ...record.asset_keys])];
    const traces = {}, assets = {};
    let bytes = Buffer.byteLength(JSON.stringify(record));
    for (const resource of keys.slice(1)) {
      const text = await read(id, resource);
      bytes += Buffer.byteLength(text);
      if (bytes > MAX_DECK_BYTES) throw fault('投影片總容量超過 512 MB', 413);
      let value;
      try { value = JSON.parse(text); } catch { throw fault('動畫或素材格式無效'); }
      if (record.asset_keys.includes(resource)) {
        if (typeof value !== 'string' || !value.startsWith('data:')) throw fault('素材格式無效');
        assets[resource] = value;
      } else traces[resource] = value;
    }
    const complete = await SlideStorage.merge({ deck: record.deck, references: record.references, traces });
    function restore(value) {
      if (!value || typeof value !== 'object') return value;
      if (!Array.isArray(value) && Object.keys(value).length === 1 && Object.hasOwn(value, '$asmAsset')) {
        if (!Object.hasOwn(assets, value.$asmAsset)) throw fault('缺少已儲存的素材');
        return assets[value.$asmAsset];
      }
      for (const name of Object.keys(value)) value[name] = restore(value[name]);
      return value;
    }
    return { record, keys, traces, deck: restore(SlideStorage.hydrate(complete)) };
  }
  async function commit(id, query, key, metadata) {
    return exclusive(id, async () => {
      const old = await repo.deck(query);
      if (!old) throw fault('找不到投影片或已無編輯權限', 403);
      const next = await snapshot(id, key);
      // Pin before switching the durable reference. A failed commit never removes old data.
      await repo.pin(id, next.keys);
      const saved = await repo.commit({ ...query, updated_at: old.updated_at }, {
        ...metadata, cloud_snapshot: key, resource_keys: next.keys,
        deck: { groups: [] }, trace_references: [], trace_results: {},
        slide_count: (next.record.deck.groups || []).reduce((sum, group) => sum + (group.slides || []).length, 0),
        updated_at: new Date()
      });
      if (!saved) throw fault('投影片已由其他頁面更新，請重新儲存', 409);
      const unused = (old.resource_keys || []).filter(value => !next.keys.includes(value));
      try { await repo.remove(id, unused); }
      catch (error) { console.error('Deferred unused slide resource cleanup:', error.message); }
      return saved;
    });
  }
  // Reconcile interrupted uploads / crashes; current durable references always win.
  async function sweep() {
    const cutoff = new Date(Date.now() - 48 * 3600 * 1000);
    for (const id of await repo.staleDecks(cutoff)) await exclusive(id, async () => {
      const deck = await repo.deck({ deck_uid: id });
      await repo.sweep(id, deck?.resource_keys || [], cutoff);
    });
  }
  async function currentSnapshot(id) {
    return exclusive(id, async () => {
      const current = await repo.deck({ deck_uid: id });
      if (!current?.cloud_snapshot) throw fault('投影片已刪除或儲存狀態已改變', 409);
      return snapshot(id, current.cloud_snapshot);
    });
  }
  return { read, put, snapshot, currentSnapshot, commit, sweep };
}

function register(app, mongoose, SlideDeck, authenticateToken, cleanDeckTitle, cleanCoverThumbnail) {
  const schema = new mongoose.Schema({
    deck_uid: String, key: String, part: Number, total: Number, data: String,
    touched_at: { type: Date, default: Date.now }
  });
  schema.index({ deck_uid: 1, key: 1, part: 1 }, { unique: true });
  const Chunk = mongoose.model('SlideResourceChunk', schema);
  const store = createStore({
    parts: (id, key) => Chunk.find({ deck_uid: id, key }).sort({ part: 1 }).lean(),
    usage: async id => (await Chunk.aggregate([{ $match: { deck_uid: id } },
      { $group: { _id: null, size: { $sum: { $strLenBytes: '$data' } } } }]))[0]?.size || 0,
    put: (id, key, part, total, data) => Chunk.updateOne({ deck_uid: id, key, part },
      { $setOnInsert: { total, data }, $set: { touched_at: new Date() } }, { upsert: true }),
    pin: (id, keys) => Chunk.updateMany({ deck_uid: id, key: { $in: keys } }, { $set: { touched_at: new Date() } }),
    deck: query => SlideDeck.findOne(query).lean(),
    commit: (query, updates) => SlideDeck.findOneAndUpdate(query, { $set: updates }, { new: true, runValidators: true })
      .select('deck_uid title slide_count updated_at'),
    remove: (id, keys) => Chunk.deleteMany({ deck_uid: id, key: { $in: keys } }),
    staleDecks: cutoff => Chunk.distinct('deck_uid', { touched_at: { $lt: cutoff } }),
    sweep: (id, keys, cutoff) => Chunk.deleteMany({ deck_uid: id, key: { $nin: keys }, touched_at: { $lt: cutoff } })
  });
  const protect = handler => async (req, res) => {
    try {
      const query = req.params.deck_uid
        ? { deck_uid: req.params.deck_uid, user_uid: req.user.id }
        : { share_edit_token: req.params.share_token, share_mode: 'edit' };
      const deck = await SlideDeck.findOne(query).select('deck_uid').lean();
      if (!deck) throw fault('找不到投影片或已無編輯權限', 403);
      await handler(req, res, deck.deck_uid, query);
    } catch (error) {
      res.status(error.status || 500).json({ error: error.status ? error.message : '雲端資源儲存失敗，請重試' });
    }
  };
  for (const [base, middleware] of [['/api/slides/:deck_uid', [authenticateToken]], ['/api/shared-slides/:share_token', []]]) {
    app.get(base + '/resources/:key', ...middleware, protect(async (req, res, id) => {
      if (!validKey(req.params.key)) throw fault('資源 ID 無效');
      const parts = await Chunk.find({ deck_uid: id, key: req.params.key }).select('part total').lean();
      res.json({ parts: parts.map(part => part.part), total: parts[0]?.total });
    }));
    app.put(base + '/resources/:key/:part', ...middleware, protect(async (req, res, id) => {
      await store.put(id, req.params.key, Number(req.params.part), req.body.total, req.body.data);
      res.json({ success: true });
    }));
    app.put(base + '/content', ...middleware, protect(async (req, res, id, query) => {
      const slide = await store.commit(id, query, req.body.snapshot, {
        title: cleanDeckTitle(req.body.title), cover_thumbnail: cleanCoverThumbnail(req.body.cover_thumbnail)
      });
      res.json({ success: true, slide });
    }));
  }
  const timer = setInterval(() => store.sweep().catch(error => console.error('Slide resource cleanup:', error.message)), 3600 * 1000);
  timer.unref();
  return { restore: async slide => store.currentSnapshot(slide.deck_uid),
    remove: id => Chunk.deleteMany({ deck_uid: id }) };
}
module.exports = { createStore, register, hash, CHUNK_CHARS };
