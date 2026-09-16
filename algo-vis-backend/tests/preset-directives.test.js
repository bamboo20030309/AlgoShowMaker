const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findFrameDirectives, instrumentSource } = require('../trace-instrumenter');
const { compile } = require('./helpers/compile');

const source = `#include <bits/stdc++.h>
using namespace std;
// @preset sieve_view
// @object isprime with range(1,n), columns(10), labels(index)
// @object prime with columns(10), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,60)
// @style isprime[i] highlight AV_red
// @endpreset
int main() {
  int n = 6;
  vector<int> isprime(n+1,1);
  vector<int> prime = {2};
  for (int i=1; i<=2; i++) {
    // @frame use sieve_view
    // @style isprime[i] point
  }
  return 0;
}`;

const layeredSource = source.replace('// @endpreset\nint main()', `// @endpreset
// @preset compact_view
// @object prime with columns(3), labels(value)
// @place prime.top-left at isprime.bottom-left offset(0,80)
// @style isprime[i] highlight AV_green
// @endpreset
int main()`).replace('@frame use sieve_view', '@frame use sieve_view, compact_view');

const completeDrawingPresetSource = `#include <bits/stdc++.h>
using namespace std;
// @preset complete_view
// @object arr[i] with range(0,n-1), columns(4), labels(index)
// @segment arr[0:i] as active_range
// @style arr[i] highlight AV_green
// @place arr.top at canvas.top offset(0,80)
// @text "目前索引 \${i}" as current_note at arr.bottom
// @arrow from arr[i] to arr[0] as "guide" color AV_red width 3
// @camera focus arr[i] zoom(1.6) offset(0,20)
// @endpreset
int main() {
  int n = 4;
  vector<int> arr = {4, 3, 2, 1};
  for (int i=0; i<2; i++) {
    // @frame use complete_view
  }
  return 0;
}`;

test('a named view expands at the use site and captures runtime dependencies', () => {
  const frames = findFrameDirectives(source);
  assert.equal(frames.length, 1, 'the preset definition does not create a frame');
  const [frame] = frames;
  assert.equal(frame.presetName, 'sieve_view');
  assert.deepEqual(frame.objects.map(object => object.primaryName), ['isprime', 'prime']);
  assert.equal(frame.objects[0].rendererOptions.range.startExpression, '1');
  assert.equal(frame.objects[0].rendererOptions.range.endExpression, 'n');
  assert.equal(frame.placeBindings.length, 1);
  assert.equal(frame.placeBindings[0].offsetY, 60);
  assert.deepEqual(frame.styles.map(style => style.styleType), ['highlight', 'point']);
  assert.ok(frame.variables.some(variable => variable.name === 'i'));
  assert.ok(frame.variables.some(variable => variable.name === 'n'));
  const [conditional] = findFrameDirectives(source.replace(
    '@frame use sieve_view', '@frame use sieve_view when i <= n'
  ));
  assert.equal(conditional.when.expression, 'i <= n');
  const instrumented = instrumentSource(source);
  assert.equal(instrumented.frameDirectives.length, 1);
  assert.equal(instrumented.code.match(/::asm_trace::capture\(/g)?.length, 1);
});

test('a local object, place and style replace only the matching preset entries', () => {
  const edited = source.replace('// @style isprime[i] point', `// @object prime with columns(3)
    // @place prime.top-left at isprime.bottom-left offset(0,80)
    // @style isprime[i] highlight AV_green`);
  const [frame] = findFrameDirectives(edited);
  assert.equal(frame.objects.length, 2);
  assert.equal(frame.objects[0].rendererOptions.columns.expression, '10');
  assert.equal(frame.objects[1].rendererOptions.columns.expression, '3');
  assert.deepEqual(frame.placeBindings.map(binding => binding.offsetY), [80]);
  assert.deepEqual(frame.styles.map(style => style.color), ['AV_green']);
});

test('multiple presets merge left to right and local directives override the combined view', () => {
  const [frame] = findFrameDirectives(layeredSource);
  assert.deepEqual(frame.presetNames, ['sieve_view', 'compact_view']);
  assert.equal(frame.presetName, 'sieve_view');
  assert.deepEqual(frame.objects.map(object => object.primaryName), ['isprime', 'prime']);
  assert.equal(frame.objects[0].rendererOptions.columns.expression, '10');
  assert.equal(frame.objects[1].rendererOptions.columns.expression, '3');
  assert.deepEqual(frame.placeBindings.map(binding => binding.offsetY), [80]);
  assert.deepEqual(frame.styles.map(style => style.color), ['AV_green', '']);

  const [reversed] = findFrameDirectives(layeredSource.replace(
    'use sieve_view, compact_view', 'use compact_view,sieve_view'));
  assert.equal(reversed.objects[1].rendererOptions.columns.expression, '10');
  assert.deepEqual(reversed.placeBindings.map(binding => binding.offsetY), [60]);
  assert.deepEqual(reversed.styles.map(style => style.color), ['AV_red', '']);

  const [local] = findFrameDirectives(layeredSource.replace('// @style isprime[i] point',
    `// @object prime with columns(5)
    // @place prime.top-left at isprime.bottom-left offset(0,100)
    // @style isprime[i] highlight AV_blue`));
  assert.equal(local.objects[1].rendererOptions.columns.expression, '5');
  assert.deepEqual(local.placeBindings.map(binding => binding.offsetY), [100]);
  assert.deepEqual(local.styles.map(style => style.color), ['AV_blue']);
});

test('a style-only preset can layer on a base object preset, including frame when', () => {
  const onlyStyle = source.replace('// @endpreset\nint main()', `// @endpreset
// @preset color_view
// @style isprime[i] highlight AV_green
// @endpreset
int main()`).replace('@frame use sieve_view',
    '@frame use sieve_view, color_view when i <= n');
  const [frame] = findFrameDirectives(onlyStyle);
  assert.deepEqual(frame.presetNames, ['sieve_view', 'color_view']);
  assert.equal(frame.when.expression, 'i <= n');
  assert.equal(frame.styles.find(style => style.styleType === 'highlight').color, 'AV_green');
  assert.deepEqual(frame.objects.map(object => object.primaryName), ['isprime', 'prime']);
  assert.throws(() => findFrameDirectives(onlyStyle.replace(
    'use sieve_view, color_view', 'use color_view')),
  /@frame 至少需要一個緊接的 @object/);
});

test('preset definitions retain every directive without executing control actions', () => {
  const [frame] = findFrameDirectives(source.replace(
    '// @style isprime[i] highlight AV_red', '// @keep last\n// @future-setting anything'
  ));
  assert.deepEqual(frame.presetDirectives.map(item => item.name),
    ['object', 'object', 'place', 'keep', 'future-setting']);
  assert.throws(() => findFrameDirectives(source.replace(
    '@frame use sieve_view', '@frame use missing_view'
  )), /找不到預設：missing_view/);
  assert.throws(() => findFrameDirectives(layeredSource.replace(
    'use sieve_view, compact_view', 'use sieve_view, missing_view'
  )), /找不到預設：missing_view/);
  assert.throws(() => findFrameDirectives(layeredSource.replace(
    'use sieve_view, compact_view', 'use sieve_view,,compact_view'
  )), /@frame use 格式應為/);
  assert.throws(() => findFrameDirectives(layeredSource.replace(
    'use sieve_view, compact_view', 'use sieve_view,sieve_view'
  )), /不可重複套用/);
  assert.throws(() => findFrameDirectives(source.replace(
    '// @endpreset', '// @preset nested\n// @endpreset'
  )), /@preset 不可巢狀/);
  assert.throws(() => findFrameDirectives(source.slice(0, source.indexOf('// @endpreset'))),
    /@preset 缺少 @endpreset/);
});

test('a preset supports every frame-scoped drawing directive', () => {
  const [frame] = findFrameDirectives(completeDrawingPresetSource);
  assert.deepEqual(frame.objects.map(object => object.primaryName), ['arr']);
  assert.equal(frame.placeBindings.length, 1);
  assert.equal(frame.styles.length, 1);
  assert.equal(frame.segments.length, 1);
  assert.equal(frame.segments[0].id, 'active_range');
  assert.equal(frame.texts.length, 1);
  assert.equal(frame.texts[0].id, 'current_note');
  assert.equal(frame.arrows.length, 1);
  assert.equal(frame.arrows[0].id, 'guide');
  assert.equal(frame.arrows[0].style.color, 'AV_red');
  assert.equal(frame.camera.autoCapture, false);
  assert.equal(frame.camera.zoom, 1.6);
  assert.equal(frame.camera.offsetY, 20);
  assert.equal(frame.camera.target.variableId, frame.objects[0].primaryVariableId);
  assert.equal(frame.camera.target.indexExpression, 'i');
  assert.ok(frame.variables.some(variable => variable.name === 'i'));
  assert.ok(frame.variables.some(variable => variable.name === 'n'));
});

test('local named drawing directives replace matching preset entries', () => {
  const edited = completeDrawingPresetSource.replace('// @frame use complete_view', `// @frame use complete_view
    // @segment arr[i:n-1] as active_range
    // @text "已覆寫" as current_note at arr.top
    // @arrow from arr[0] to arr[i] as "guide" color AV_blue width 2`);
  const [frame] = findFrameDirectives(edited);
  assert.equal(frame.segments.length, 1);
  assert.equal(frame.segments[0].startExpression, 'i');
  assert.equal(frame.texts.length, 1);
  assert.equal(frame.texts[0].segments[0].text, '已覆寫');
  assert.equal(frame.arrows.length, 1);
  assert.equal(frame.arrows[0].style.color, 'AV_blue');
});

test('local camera overrides preset camera while multiple presets merge left to right', () => {
  const secondCamera = completeDrawingPresetSource.replace('// @endpreset\nint main()', `// @endpreset
// @preset close_view
// @camera auto zoom(0.8) offset(5,6)
// @endpreset
int main()`).replace('use complete_view', 'use complete_view,close_view');
  const [layered] = findFrameDirectives(secondCamera);
  assert.equal(layered.camera.autoCapture, true);
  assert.equal(layered.camera.zoom, 0.8);
  assert.equal(layered.camera.offsetX, 5);
  const [local] = findFrameDirectives(secondCamera.replace(
    '// @frame use complete_view,close_view',
    '// @frame use complete_view,close_view\n    // @camera focus arr zoom(2)'));
  assert.equal(local.camera.autoCapture, false);
  assert.equal(local.camera.zoom, 2);
  assert.equal(local.camera.target.anchor, 'center');
});

test('compiled complete drawing presets evaluate at each use site', async () => {
  const { trace } = await compile(completeDrawingPresetSource);
  assert.equal(trace.frames.length, 2);
  assert.ok(trace.frames.every(frame => frame.styles.length === 1));
  assert.ok(trace.frames.every(frame => frame.segments.length === 1));
  assert.ok(trace.frames.every(frame => frame.texts.length === 1));
  assert.ok(trace.frames.every(frame => frame.arrows.length === 1));
  assert.ok(trace.frames.every(frame => frame.camera?.zoom === 1.6));
  assert.ok(trace.frames.every(frame => (frame.events || []).every((event, index, events) =>
    Number.isFinite(Number(event.order)) && (index === 0
      || Number(events[index - 1].order) <= Number(event.order)))));
});

test('compiled repeated frames evaluate preset expressions on each execution', async () => {
  const { trace } = await compile(source);
  assert.equal(trace.frames.length, 2);
  assert.ok(trace.frames.every(frame => frame.source?.primaryVariableId
    === trace.frames[0].source?.primaryVariableId));
  assert.ok(trace.frames.every(frame => frame.styles.find(style =>
    style.styleType === 'highlight')?.selector?.indexExpression === 'i'));
  assert.ok(trace.frames.every(frame => frame.objectBindings.find(binding =>
    binding.sourceName === 'prime')?.offsetY === 60));
  assert.ok(trace.frames.every(frame => (frame.events || []).every((event, index, events) =>
    Number.isFinite(Number(event.order)) && (index === 0
      || Number(events[index - 1].order) <= Number(event.order)))));
});

test('compiled multiple presets evaluate conditions and styles on each execution', async () => {
  const { trace } = await compile(layeredSource.replace(
    'use sieve_view, compact_view', 'use sieve_view, compact_view when i <= n'));
  assert.equal(trace.frames.length, 2);
  assert.ok(trace.frames.every(frame => frame.styles.find(style =>
    style.styleType === 'highlight')?.color === 'AV_green'));
  assert.ok(trace.frames.every(frame => frame.objectBindings.find(binding =>
    binding.sourceName === 'prime')?.offsetY === 80));
  assert.ok(trace.frames.every(frame => (frame.events || []).every((event, index, events) =>
    Number.isFinite(Number(event.order)) && (index === 0
      || Number(events[index - 1].order) <= Number(event.order)))));
});
