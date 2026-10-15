const { test } = require('node:test');
const assert = require('node:assert/strict');
const { migrateSource, migrateJavaScript } = require('../scripts/migrate-indexed-pointers');
const { findFrameDirectives } = require('../trace-instrumenter');
test('legacy migration preserves complete object blocks, pointer order, nested indices and conditions', () => {
  const old = `int main(){int a[3],b[3]; int i=0,j=1;
// @frame a[i,j] when i >= 0
// @object b[j+1]
// @style a[i] point
}`;
  const migrated = migrateSource(old);
  const [frame] = findFrameDirectives(migrated);
  assert.deepEqual(frame.objects.map(object => object.primaryName), ['a','b']);
  assert.deepEqual(frame.bindings.map(binding => binding.label), ['i','j','j+1']);
  assert.equal(frame.when.expression, 'i >= 0');
  assert.ok(frame.objects.every(object => !object.dataTransform));
  assert.equal(migrateSource(migrated), migrated);
  assert.ok(migrateSource('// @frame a[b[i]]').includes('@pointer b[i] at a'));
});
test('JavaScript string migration preserves interpolated teaching text without executing it', () => {
  const source = 'const sample = ' + JSON.stringify('// @frame a[i]\n// @text "value: ${i}" at a.bottom') + ';';
  const migrated = migrateJavaScript(source);
  assert.match(migrated, /@pointer i at a/);
  assert.ok(migrated.includes('${i}'));
});
