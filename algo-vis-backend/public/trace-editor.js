(function () {
  let mode = 'trace';
  let sliceMode = 'auto';
  let variables = [];
  let frameDirectives = [];
  let analyzedCode = '';
  let currentTrace = null;
  let studioButton = null;
  const embedMode = new URLSearchParams(window.location.search).get('asmEmbed');

  function defaultRenderer(variable) {
    if (variable.kind === 'matrix') return 'original-matrix';
    if (variable.kind === 'stack') return 'original-stack';
    if (variable.kind === 'queue') return 'original-queue';
    if (['sequence', 'set', 'map'].includes(variable.kind)) return 'original-array';
    if (['scalar', 'string'].includes(variable.kind)) return 'original-cell';
    if (variable.kind === 'node-graph') return 'graph';
    if (variable.kind === 'coordinate-system') return 'coordinate-system';
    return 'object';
  }

  function originalRendererName(renderer, variable) {
    const legacy = {
      array: 'original-array',
      sequence: 'original-array',
      matrix: 'original-matrix',
      scalar: 'original-cell',
      string: 'original-cell',
      stack: 'original-stack',
      queue: 'original-queue'
    };
    return legacy[renderer] || renderer || defaultRenderer(variable || {});
  }

  function sourceCode() {
    if (typeof aceEditor !== 'undefined' && aceEditor?.getValue) return aceEditor.getValue();
    const editor = document.getElementById('editor');
    return window.ace?.edit && editor ? window.ace.edit(editor).getValue() : '';
  }

  function updateStudioButton() {
    if (!studioButton) return;
    studioButton.disabled = !currentTrace?.frames?.length;
  }

  async function analyze(code = sourceCode()) {
    const response = await fetch('/trace/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '無法分析 C++ 程式碼');

    variables = Array.isArray(data.variables) ? data.variables : [];
    frameDirectives = Array.isArray(data.frameDirectives) ? data.frameDirectives : [];
    sliceMode = frameDirectives.length ? 'manual' : 'auto';
    analyzedCode = code;
    return variables;
  }

  function selectedVariables() {
    if (!frameDirectives.length) return variables;
    const directiveIds = new Set(frameDirectives.flatMap(item => item.variableIds || []));
    return variables.filter(variable => directiveIds.has(variable.id));
  }

  async function getCompileConfig(code) {
    if (code !== analyzedCode) await analyze(code);

    const watches = selectedVariables();
    const skins = Object.fromEntries(watches.map(variable => [variable.id, {
      renderer: defaultRenderer(variable),
      options: { showIndex: true, gap: 0 }
    }]));

    return {
      enabled: true,
      sliceMode,
      watches: watches.map(variable => variable.id),
      skins,
      rules: currentTrace?.rules || []
    };
  }

  function applyTraceDocument(trace) {
    const skins = Object.fromEntries(Object.entries(trace.skins || {}).map(([variableId, skin]) => [variableId, {
      ...skin,
      renderer: originalRendererName(skin?.renderer, trace.variables?.[variableId])
    }]));

    const incomingStudio = trace.studio && Object.keys(trace.studio).length
      ? trace.studio
      : currentTrace?.studio || {};
    currentTrace = window.ASMTraceModel.normalizeTraceDocument({ ...trace, skins, studio: incomingStudio });
    currentTrace = window.asmApplyTraceDocument(currentTrace);
    mode = 'trace';
    sliceMode = currentTrace.sliceMode === 'manual' ? 'manual' : 'auto';
    updateStudioButton();
    setTimeout(() => {
      if (embedMode === 'runtime') {
        window.ASMTraceStudio?.close?.();
        return;
      }
      window.ASMTraceStudio?.open(currentTrace);
    }, 0);
    return currentTrace;
  }

  function loadAnimation(animation = {}) {
    mode = animation.mode === 'trace' || animation.traceDocument ? 'trace' : 'manual';
    sliceMode = animation.sliceMode === 'manual' ? 'manual' : animation.sliceMode === 'full' ? 'full' : 'auto';
    if (animation.traceDocument?.frames?.length) {
      applyTraceDocument({
        ...animation.traceDocument,
        sliceMode: animation.sliceMode || animation.traceDocument.sliceMode,
        skins: animation.skins || animation.traceDocument.skins,
        rules: animation.rules || animation.traceDocument.rules
      });
    } else {
      currentTrace = null;
      updateStudioButton();
    }
  }

  function snapshot() {
    const traceVariables = currentTrace?.variables || {};
    const watches = Object.entries(traceVariables).map(([id, variable]) => ({
      id,
      name: variable.name,
      cppType: variable.cppType,
      kind: variable.kind
    }));
    return {
      mode,
      sliceMode,
      watches,
      skins: currentTrace?.skins || {},
      rules: currentTrace?.rules || [],
      traceDocument: currentTrace
    };
  }

  function buildUi() {
    studioButton = document.getElementById('editAnimationBtn');
    if (!studioButton || studioButton.dataset.traceBound) return;
    studioButton.dataset.traceBound = '1';
    studioButton.addEventListener('click', () => {
      if (currentTrace) window.ASMTraceStudio?.open(currentTrace);
    });
    updateStudioButton();
  }

  document.addEventListener('DOMContentLoaded', buildUi);

  window.ASMTraceEditor = {
    isEnabled: () => true,
    setMode: () => { mode = 'trace'; },
    analyze,
    ensureAnalysis: analyze,
    getCompileConfig,
    applyTraceDocument,
    loadAnimation,
    snapshot
  };
})();
