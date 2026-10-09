const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Storage = require('../public/slides-storage');
function localStore(storage) {
  const context = { window: { sessionStorage: storage }, module: { exports: {} } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/local-camera'), 'utf8'), context);
  return context.module.exports;
}
test('local scopes retain independent values on reload, migrate once, and survive unavailable storage', () => {
  const rows = new Map();
  const storage = { getItem: key => rows.get(key) ?? null, setItem: (key,value) => rows.set(key,value) };
  const first = localStore(storage);
  first.migrate('runtime:a', { panXRatio: .2, zoomFactor: 2 });
  first.write('editor:a', { panYRatio: -.3 });
  first.write('runtime:a', {});
  first.migrate('runtime:a', { zoomFactor: 3 });
  const reload = localStore(storage);
  assert.equal(reload.read('runtime:a').zoomFactor, 1, 'identity is an explicit local override');
  assert.equal(reload.read('editor:a').panYRatio, -.3);
  assert.equal(reload.read('editor:b').panYRatio, 0);
  const blocked = localStore({ getItem() { throw Error(); }, setItem() { throw Error(); } });
  blocked.write('algorithm:studio', { panXRatio: .5 });
  assert.equal(blocked.read('algorithm:studio').panXRatio, .5);
});
test('cloud projection strips old temporary cameras for both inline results and ID-only animations', async () => {
  for (const inline of [true, false]) {
    const camera = { panXRatio: .2, panYRatio: .3, zoomFactor: 2 };
    const animation = { code: 'int main(){}', presentationCamera: camera,
      ...(inline ? { traceDocument: { frames: [{}], studio: { cameraRules: [{ centerX: 321 }], eventSettings: { autoFixedEnabled: false } } } }
        : { traceRef: 'a'.repeat(64), traceView: { studio: { eventSettings: { autoFixedEnabled: false } } } }) };
    const projected = await Storage.project({ groups: [{ slides: [{ animation }] }] });
    assert.equal(projected.deck.groups[0].slides[0].animation.presentationCamera, undefined);
    assert.equal(animation.presentationCamera, camera, 'projection must not mutate the input');
    assert.equal(projected.references[0].view.studio.eventSettings.autoFixedEnabled, false);
    if (inline) assert.equal(projected.references[0].view.studio.cameraRules[0].centerX, 321);
  }
});
