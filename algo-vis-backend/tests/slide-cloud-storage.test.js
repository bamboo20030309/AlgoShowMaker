/**
 * 測試模組：slide-cloud-storage.test
 *
 * 驗證重點：slide cloud storage.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const SlideStorage = require('../public/slides-storage');
const compact = source => require('../public/animation-recipe').deck(source);

function routes(previous) {
  const handlers = {}, writes = [], queries = [];
  const app = { get(path, ...args) { handlers['GET ' + path] = args.at(-1); },
    put(path, ...args) { handlers['PUT ' + path] = args.at(-1); } };
  const SlideDeck = {
    findOne(query) {
      queries.push(query);
      return { lean: async () => previous,
        select: async () => previous };
    },
    findOneAndUpdate(query, update) {
      writes.push({ query, update });
      return { select: async () => ({ title: 'saved' }) };
    }
  };
  const source = fs.readFileSync(require.resolve('../server.js'), 'utf8');
  vm.runInNewContext(source.slice(source.indexOf('async function restoreSlideDeck('),
    source.indexOf("app.delete('/api/slides/:deck_uid'")), {
    app, SlideDeck, SlideStorage, authenticateToken() {},
    cleanDeckTitle: value => value, countDeckSlides: deck => deck.groups.flatMap(g => g.slides).length,
    cleanCoverThumbnail: value => value, console: { error() {} }
  });
  async function invoke(path, body = {}, overrides = {}) {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; },
      json(value) { this.body = value; return this; } };
    await handlers[path]({ body, params: { deck_uid: 'owned', share_token: 'edit' },
      user: { id: 'owner' }, ...overrides }, response);
    return response;
  }
  return { invoke, writes, queries };
}

test('lazy owner/shared reads contain recipes; retired result endpoints preserve authorization',async()=>{
  const source={groups:[{slides:[{animation:{code:'int main(){}',traceDocument:{frames:[{}],studio:{enabled:false}}}}]}]},record=await SlideStorage.project(source),key='b'.repeat(64);
  const previous=()=>({deck:structuredClone(record.deck),trace_references:[],trace_results:{},share_view_token:'view',share_edit_token:'edit',share_mode:'edit'});
  for(const path of ['GET /api/slides/:deck_uid','GET /api/shared-slides/:share_token']){
    const response=await routes(previous()).invoke(path,{}, {query:{traceMode:'lazy'}});assert.equal(response.statusCode,200);
    const a=response.body.slide.deck.groups[0].slides[0].animation;assert.equal(a.traceRef,undefined);assert.equal(a.traceDocument,undefined);assert.equal(a.traceView.studio.enabled,false);
  }
  const owned=routes(previous()),path='GET /api/slides/:deck_uid/traces/:key';assert.equal((await owned.invoke(path,{}, {params:{deck_uid:'owned',key}})).statusCode,410);assert.deepEqual(JSON.parse(JSON.stringify(owned.queries[0])),{deck_uid:'owned',user_uid:'owner'});
  const shared='GET /api/shared-slides/:share_token/traces/:key';assert.equal((await routes(previous()).invoke(shared,{}, {params:{share_token:'view',key}})).statusCode,410);assert.equal((await routes({...previous(),share_mode:'off'}).invoke(shared,{}, {params:{share_token:'view',key}})).statusCode,404);assert.equal((await routes(previous()).invoke(shared,{}, {params:{share_token:'other',key}})).statusCode,404);
});

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('owner and shared saves retain durable results without rewriting unchanged traces', async () => {
  const original = { groups: [{ slides: [{ animation: { code: 'code', input: '',
    traceDocument: { frames: [{ state: { arr: [1] } }], studio: { zoom: 2 } } } }] }] };
  const stored = await SlideStorage.project(original);
  const previous = { deck: stored.deck, trace_references: stored.references,
    trace_results: stored.traces, updated_at: new Date(1) };
  const edited = JSON.parse(JSON.stringify(original));
  edited.groups[0].slides[0].animation.traceDocument.studio.zoom = 3;
  const projected = await SlideStorage.project(edited);
  for (const path of ['PUT /api/slides/:deck_uid', 'PUT /api/shared-slides/:share_token']) {
    const harness = routes(previous);
    const response = await harness.invoke(path, { deck: projected.deck,
      trace_storage: { references: projected.references, traces: {} } });
    assert.equal(response.statusCode, 200);
    const { query, update } = harness.writes[0];
    assert.equal(query.updated_at, previous.updated_at);
    assert.equal(query.user_uid || query.share_edit_token, path.includes('shared') ? 'edit' : 'owner');
    assert.equal(Object.keys(update.$set).some(key => key.startsWith('trace_results')), false);
    const restored = SlideStorage.hydrate({ deck: update.$set.deck,
      references: update.$set.trace_references, traces: previous.trace_results });
    assert.deepEqual(restored, compact(edited));
  }
});

test('legacy result IDs no longer gate a valid source save',async()=>{
 const source={groups:[{slides:[{animation:{code:'int main(){}',traceRef:'a'.repeat(64)}}]}]},harness=routes({deck:{groups:[]},updated_at:new Date(1)});
 const response=await harness.invoke('PUT /api/slides/:deck_uid',{deck:source});assert.equal(response.statusCode,200);assert.equal(harness.writes[0].update.$set.deck.groups[0].slides[0].animation.traceRef,undefined);
});

test('cloud reads restore complete results for owner and authorized shared viewer', async () => {
  const deck = { groups: [{ slides: [{ animation: { code: 'int main(){}', traceDocument: { frames: [],
    studio: { events: { declare: true } } } } }] }] };
  const record = await SlideStorage.project(deck);
  for (const path of ['GET /api/slides/:deck_uid', 'GET /api/shared-slides/:share_token']) {
    const harness = routes({ deck: record.deck, trace_references: record.references,
      trace_results: record.traces, share_edit_token: 'edit', share_mode: 'edit' });
    const response = await harness.invoke(path);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body.slide.deck, compact(deck));
    assert.deepEqual(Array.from(response.body.slide.trace_keys), Object.keys(record.traces));
  }
});

test('public HTTP uses the archive SHA-256 fallback for durable trace references', async () => {
  const context = vm.createContext({ TextEncoder, TextDecoder, Uint8Array, Uint32Array,
    ArrayBuffer, DataView, console, ASMTraceViewSource: require('../public/trace-view-source') });
  vm.runInContext(fs.readFileSync(require.resolve('../public/animation-recipe.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/asmdeck.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(require.resolve('../public/slides-storage.js'), 'utf8'), context);
  const source = { groups: [{ slides: [{ animation: { code: 'int main(){}', traceDocument: { frames: [] } } }] }] };
  const browser = await context.ASMSlideStorage.project(source);
  const node = await SlideStorage.project(source);
  assert.deepEqual(Object.keys(browser.traces), Object.keys(node.traces));
});
