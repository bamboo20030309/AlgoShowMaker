/**
 * 測試模組：view-source-compaction.test
 *
 * 驗證重點：view source compaction.test 相關功能的公開行為、回歸條件與錯誤邊界。
 * 執行環境：Node.js 單元／契約測試；聚焦可重複的行為邊界。
 * 檔案結構：先準備 fixture、替代物與共用 helper，再以具名案例驗證使用者可觀察結果。
 * 維護原則：功能規格改變時同步更新案例理由；不得只放寬斷言來掩蓋失敗。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const viewSource = require('../public/trace-view-source.js');
const { instrumentSource } = require('../trace-instrumenter.js');

function fixture() {
  return {
    variables: {
      arr: { id: 'arr', name: 'arr', kind: 'sequence', functionName: 'main' },
      i: { id: 'i', name: 'i', kind: 'scalar', functionName: 'main' }
    },
    frames: [
      { id: 'frame-0', source: { statementId: 'manual-frame:main:1:0', functionName: 'main', directiveKey: 'manual-frame:first:0' }, state: { arr: {}, i: {} } },
      { id: 'frame-1', source: { statementId: 'manual-frame:main:2:1', functionName: 'main', directiveKey: 'manual-frame:second:0' }, state: { arr: {}, i: {} } }
    ],
    skins: {
      arr: { renderer: 'original-array', options: { showIndex: false, gap: 0 } },
      i: { renderer: 'original-cell', options: { showIndex: false, gap: 0 } },
      'main:arr@old-offset': { renderer: 'original-array', options: { showIndex: true, gap: 0 } }
    },
    rules: [],
    studio: {
      codePanelPosition: { x: 0.36, y: 0.18 },
      codePanelFontSize: 18,
      positions: {
        'frame-0': { arr: { x: 10, y: 20 } },
        'deleted-frame': { arr: { x: 900, y: 900 } }
      },
      bindings: {}, visibility: {}, objectStyles: {}, eventStates: {},
      eventInstructionStates: {
        'assign:main:10:i++': false,
        'assign:main:11:i++': true,
        'fixed:main:arr@123:0': false,
        'fixed:main:arr@456:0': true
      },
      objects: [], arrows: [], transitions: [],
      cameraRules: [{
        id: 'camera-main', name: '鏡頭範圍', condition: null,
        zoom: 1.5, offsetX: 0, offsetY: 0, target: null,
        autoCapture: true, manualFrame: false,
        binding: { targetKey: 'arr', targetAnchor: 'center', dx: 0, dy: 0 },
        frameIds: ['frame-0', 'deleted-frame']
      }]
    },
    asmView: { skins: { stale: {} } }
  };
}

// -----------------------------------------------------------------------------
// 測試案例：下列具名案例各自描述一項可觀察契約。
// -----------------------------------------------------------------------------
test('save-time view normalization removes stale/default data without mutating the live trace', () => {
  const trace = fixture();
  const before = JSON.stringify(trace);
  const settings = viewSource.fromTrace(trace);

  assert.equal(JSON.stringify(trace), before, 'normalization must work on a detached copy');
  assert.deepEqual(settings.skins, { arr: { options: { showIndex: false } } });
  assert.deepEqual(settings.studio.eventInstructionStates, {
    'assign:main:i++': true
  });
  assert.equal(settings.studio.objects, undefined);
  assert.equal(settings.studio.arrows, undefined);
  assert.equal(settings.studio.transitions, undefined);
  assert.deepEqual(settings.studio.codePanelPosition, { x: 0.36, y: 0.18 });
  assert.equal(settings.studio.codePanelFontSize, 18);
  // 動畫完全由指令驅動（2026-11-14）：拖曳位置與 Studio 鏡頭不再寫回程式碼。
  assert.equal(settings.studio.frameMaps?.positions, undefined);
  assert.equal(settings.studio.cameraRules, undefined);
});

test('matrix label, zero-width gridline and disabled outerframe settings survive save and reopen', () => {
  const trace = {
    variables: { grid: { id: 'grid', name: 'grid', kind: 'matrix', functionName: 'main' } },
    frames: [{ id: 'frame-0', source: { functionName: 'main', directiveKey: 'manual-frame:grid:0' }, state: { grid: {} } }],
    skins: { grid: { renderer: 'original-matrix', options: {
      gridlines: 0, outerframe: false, markerLayout: 'inner',
      rowLabels: { mode: 'custom', values: ['', 'B'] },
      columnLabels: { mode: 'none', values: [] },
      innerLabels: { mode: 'index', values: [] }
    } } },
    rules: [], studio: {}
  };
  const settings = viewSource.fromTrace(trace);
  assert.deepEqual(settings.skins.grid.options, trace.skins.grid.options);

  const reopened = { ...trace, skins: {}, studio: {} };
  viewSource.applyToTrace(reopened, JSON.parse(JSON.stringify(settings)));
  assert.deepEqual(reopened.skins.grid.options, trace.skins.grid.options);

  const legacy = { ...trace, skins: { grid: { renderer: 'original-matrix', options: {} } }, studio: {} };
  const legacySettings = viewSource.fromTrace(legacy);
  const legacyReopened = { ...legacy, skins: {}, studio: {} };
  viewSource.applyToTrace(legacyReopened, legacySettings);
  assert.deepEqual(legacyReopened.skins.grid?.options || {}, {});
});

test('file view settings keep automatic fixed marks and loop boundary events only', () => {
  const trace = fixture();
  trace.studio.eventSettings = {
    gapMs: 840,
    autoFixedEnabled: false,
    autoLoopBoundaryEnabled: true,
    defaultEnabled: { assign: false },
    timelineTypes: { compare: true }
  };
  const settings = viewSource.fromTrace(trace);
  assert.deepEqual(settings.studio.eventSettings, {
    autoFixedEnabled: false,
    autoLoopBoundaryEnabled: true
  });

  const loaded = fixture();
  loaded.studio = {};
  viewSource.applyToTrace(loaded, settings);
  assert.deepEqual(loaded.studio.eventSettings, {
    autoFixedEnabled: false,
    autoLoopBoundaryEnabled: true
  });
});

test('camera selectors survive frame placement and presentation modifier changes', () => {
  const source = modifiers => instrumentSource(`
#include <vector>
int main() {
  int n = 1;
  std::vector<int> arr = {1};
  // @frame arr ${modifiers}
}`);
  const original = source('render heap with range(0,n)');
  const placed = source('render heap with range(0,n) at canvas.bottom offset(0,40)');
  assert.equal(original.frameDirectives[0].sourceKey, placed.frameDirectives[0].sourceKey,
    'placement-only edits keep the primary frame identity');
  assert.ok(original.frameDirectives[0].sourceKeyAliases.some(key => (
    placed.frameDirectives[0].sourceKeyAliases.includes(key)
  )), 'the new frame keeps a compatibility alias for the old full-text hash');

  const restyled = source('render stack with range(0,n) when n > 0 at canvas.bottom offset(0,40)');
  const savedSelector = viewSource.sourceSelector({
    source: {
      functionName: 'main',
      directiveKey: placed.frameDirectives[0].sourceKey,
      logicalDirectiveKey: placed.frameDirectives[0].logicalSourceKey
    }
  });
  assert.notEqual(placed.frameDirectives[0].sourceKey, restyled.frameDirectives[0].sourceKey);
  assert.equal(viewSource.sourceMatches({
    source: {
      functionName: 'main',
      directiveKey: restyled.frameDirectives[0].sourceKey,
      logicalDirectiveKey: restyled.frameDirectives[0].logicalSourceKey,
      directiveKeyAliases: restyled.frameDirectives[0].sourceKeyAliases
    }
  }, savedSelector), true, 'the logical fallback survives render, range and when edits');
});

test('skins follow shifted variable declarations while manual Studio data is dropped', () => {
  const original = {
    variables: {
      'heapify:arr@100': { id: 'heapify:arr@100', name: 'arr', kind: 'sequence', functionName: 'heapify' },
      'heapify:i@120': { id: 'heapify:i@120', name: 'i', kind: 'scalar', functionName: 'heapify' }
    },
    frames: [{
      id: 'old-frame',
      source: { functionName: 'heapify', directiveKey: 'manual-frame:heap:0' },
      state: { 'heapify:arr@100': {}, 'heapify:i@120': {} }
    }],
    skins: { 'heapify:arr@100': { renderer: 'original-stack' } },
    rules: [{ id: 'style', match: { frameIds: ['old-frame'] }, actions: [{ variableId: 'heapify:arr@100' }] }],
    studio: {
      positions: { 'old-frame': { 'heapify:arr@100#1': { x: 30, y: 40 } } },
      bindings: { 'old-frame': { 'heapify:i@120': { targetKey: 'heapify:arr@100', targetAnchor: 'top' } } },
      visibility: { 'old-frame': { 'heapify:i@120:label': 'hidden' } },
      objectStyles: { 'old-frame': { 'heapify:arr@100:index': { fill: '#fff' } } },
      objects: [{ id: 'marker', type: 'variable-marker', sourceVariableId: 'heapify:i@120', frameIds: ['old-frame'] }],
      arrows: [{ id: 'arrow', from: { variableId: 'heapify:i@120' }, to: { variableId: 'heapify:arr@100' }, frameIds: ['old-frame'] }],
      eventStates: { 'old-frame': { compare: false } }
    }
  };
  const settings = viewSource.fromTrace(original);
  assert.equal(settings.variableReferences['heapify:arr@100'].name, 'arr');

  const recompiled = {
    variables: {
      'heapify:arr@300': { id: 'heapify:arr@300', name: 'arr', kind: 'sequence', functionName: 'heapify' },
      'heapify:i@340': { id: 'heapify:i@340', name: 'i', kind: 'scalar', functionName: 'heapify' }
    },
    frames: [{
      id: 'new-frame',
      source: { functionName: 'heapify', directiveKey: 'manual-frame:heap:0' },
      state: { 'heapify:arr@300': {}, 'heapify:i@340': {} }
    }],
    skins: {}, rules: [], studio: {}
  };
  viewSource.applyToTrace(recompiled, settings);
  assert.equal(recompiled.skins['heapify:arr@300'].renderer, 'original-stack');
  assert.deepEqual(recompiled.rules, []);
  for (const key of ['positions', 'bindings', 'visibility', 'objectStyles', 'objects', 'arrows']) {
    assert.equal(recompiled.studio[key], undefined, key);
  }
  assert.deepEqual(recompiled.studio.eventStates['new-frame'], { compare: false }, 'per-frame event states still follow the frame');
});
test('manual frame source keys ignore line shifts and unrelated frame directives', () => {
  const first = instrumentSource(`
#include <vector>
int main() {
  std::vector<int> arr = {1};
  // @frame arr
}`);
  const shifted = instrumentSource(`
#include <vector>
int main() {
  std::vector<int> arr = {1};
  // unrelated source edit
  // @frame arr render heap
  // @frame arr
}`);
  assert.equal(first.frameDirectives[0].sourceKey, shifted.frameDirectives[1].sourceKey);
});

test('stable frame selectors use the runtime source function field', () => {
  const frame = {
    id: 'frame-runtime',
    source: {
      function: 'heapify',
      statementId: 'manual-frame:heapify:42:3',
      directiveKey: 'manual-frame:heap:0'
    }
  };
  const selector = viewSource.sourceSelector(frame);
  assert.deepEqual(selector, {
    kind: 'manual-frame', functionName: 'heapify', directiveKey: 'manual-frame:heap:0'
  });
  assert.equal(viewSource.sourceMatches(frame, selector), true);
  assert.equal(viewSource.sourceMatches(frame, {
    kind: 'manual-frame', functionName: 'heapify', directiveIndex: 3
  }), true, 'legacy directive-index selectors must still load');
});

test('old verbose settings still load, while the next saved trace snapshot is compact and detached', () => {
  const trace = fixture();
  const oldSettings = {
    version: 1,
    rules: [],
    skins: {
      arr: { renderer: 'original-array', options: { showIndex: false, gap: 0 } },
      'main:arr@old-offset': { renderer: 'original-array', options: { showIndex: true, gap: 0 } }
    },
    studio: {
      eventInstructionStates: { 'assign:main:99:i++': false },
      cameraRules: [{ id: 'old-camera', zoom: 2, frameIds: ['frame-0'] }]
    }
  };
  const loaded = fixture();
  loaded.studio = {};
  viewSource.applyToTrace(loaded, oldSettings);
  assert.equal(loaded.skins['main:arr@old-offset'].renderer, 'original-array');
  assert.equal(loaded.studio.cameraRules, undefined, 'old Studio camera rules are ignored');
  assert.equal(loaded.studio.eventInstructionStates['assign:main:99:i++'], false);

  const compact = viewSource.compactTraceForSave(trace);
  assert.equal(compact.asmView, undefined);
  assert.equal(compact.viewSettingsApplied, true);
  assert.deepEqual(compact.skins, { arr: { options: { showIndex: false } } });
  assert.equal(compact.studio.positions, undefined, 'manual positions are not saved');
  assert.deepEqual(compact.studio.eventInstructionStates, {
    'assign:main:i++': true
  });
  assert.deepEqual(compact.studio.codePanelPosition, { x: 0.36, y: 0.18 });
  assert.equal(compact.studio.codePanelFontSize, 18);
  compact.studio.codePanelPosition.x = 0.99;
  assert.equal(trace.studio.codePanelPosition.x, 0.36, 'saved trace must not share mutable state');
});

test('per-frame code snippet overrides survive compact source settings and reload', () => {
  const trace = fixture();
  trace.studio.codeSnippetOverrides = {
    'frame-0': { lineStates: { 'event:assign:main:i++#0': false } }
  };
  const settings = viewSource.fromTrace(trace);
  assert.deepEqual(settings.studio.frameMaps.codeSnippetOverrides, [{
    sourceSelectors: [{ kind: 'manual-frame', functionName: 'main', directiveKey: 'manual-frame:first:0' }],
    value: { lineStates: { 'event:assign:main:i++#0': false } }
  }]);

  const reloaded = fixture();
  reloaded.studio = {};
  viewSource.applyToTrace(reloaded, settings);
  assert.deepEqual(reloaded.studio.codeSnippetOverrides, {
    'frame-0': { lineStates: { 'event:assign:main:i++#0': false } }
  });

  const oldTrace = fixture();
  delete oldTrace.studio.codeSnippetOverrides;
  const oldSettings = viewSource.fromTrace(oldTrace);
  assert.equal(oldSettings.studio.frameMaps?.codeSnippetOverrides, undefined);
});

test('source directive code snippet choices survive source settings and shifted frame ids', () => {
  const trace = fixture();
  trace.studio.codeSnippetSourceOverrides = [{
    sourceSelector: viewSource.sourceSelector(trace.frames[0]),
    lineStates: { 'source:main:value++;#0': false }
  }];
  const settings = viewSource.fromTrace(trace);
  assert.deepEqual(settings.studio.codeSnippetSourceOverrides, [{
    sourceSelector: { kind: 'manual-frame', functionName: 'main', directiveKey: 'manual-frame:first:0' },
    lineStates: { 'source:main:value++;#0': false }
  }]);

  const reloaded = fixture();
  reloaded.frames[0].id = 'new-frame-id';
  reloaded.studio = {};
  viewSource.applyToTrace(reloaded, settings);
  assert.deepEqual(reloaded.studio.codeSnippetSourceOverrides, settings.studio.codeSnippetSourceOverrides);
  assert.equal(viewSource.sourceMatches(
    reloaded.frames[0],
    reloaded.studio.codeSnippetSourceOverrides[0].sourceSelector
  ), true);
});
