(function () {
  const mode = new URLSearchParams(window.location.search).get('asmEmbed');
  if (!mode) return;

  document.body.classList.add(`asm-embed-${mode}`);
  let currentAnimation = {
    mode: 'legacy',
    code: '',
    input: '',
    scriptContent: '',
    sliceMode: 'auto',
    watches: [],
    skins: {},
    rules: [],
    traceDocument: null
  };

  function snapshotAnimation() {
    const input = document.getElementById('inputArea');
    const traceSettings = window.ASMTraceEditor?.snapshot?.() || {};
    return {
      mode: traceSettings.mode || currentAnimation.mode || 'legacy',
      code: typeof aceEditor !== 'undefined' ? aceEditor.getValue() : currentAnimation.code,
      input: input ? input.value : currentAnimation.input,
      scriptContent: currentAnimation.scriptContent,
      sliceMode: traceSettings.sliceMode || currentAnimation.sliceMode || 'auto',
      watches: traceSettings.watches || currentAnimation.watches || [],
      skins: traceSettings.skins || currentAnimation.skins || {},
      rules: traceSettings.rules || currentAnimation.rules || [],
      traceDocument: traceSettings.traceDocument || currentAnimation.traceDocument || null
    };
  }

  function applyAnimation(animation = {}) {
    currentAnimation = {
      mode: animation.mode === 'trace' ? 'trace' : 'legacy',
      code: typeof animation.code === 'string' ? animation.code : '',
      input: typeof animation.input === 'string' ? animation.input : '',
      scriptContent: typeof animation.scriptContent === 'string' ? animation.scriptContent : '',
      sliceMode: animation.sliceMode === 'manual' ? 'manual' : animation.sliceMode === 'full' ? 'full' : 'auto',
      watches: Array.isArray(animation.watches) ? animation.watches : [],
      skins: animation.skins && typeof animation.skins === 'object' ? animation.skins : {},
      rules: Array.isArray(animation.rules) ? animation.rules : [],
      traceDocument: animation.traceDocument && typeof animation.traceDocument === 'object' ? animation.traceDocument : null
    };
    if (animation.code && typeof aceEditor !== 'undefined') {
      window.__asmEmbeddedAnimationPayload = animation;
      aceEditor.setValue(animation.code, -1);
      if (typeof foldDrawBlocks === 'function') setTimeout(foldDrawBlocks, 0);
    }
    const input = document.getElementById('inputArea');
    if (input && typeof animation.input === 'string') input.value = animation.input;
    window.ASMTraceEditor?.loadAnimation?.(currentAnimation);
    if (!window.ASMTraceEditor && currentAnimation.mode === 'trace' && currentAnimation.traceDocument && typeof window.asmApplyTraceDocument === 'function') {
      window.asmApplyTraceDocument({
        ...currentAnimation.traceDocument,
        skins: currentAnimation.skins,
        rules: currentAnimation.rules
      });
    } else if (animation.scriptContent && typeof window.asmApplyAnimationScript === 'function') {
      window.asmApplyAnimationScript(animation.scriptContent);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'asm-load-animation') {
      applyAnimation(event.data.animation);
      return;
    }
    if (event.data.type === 'asm-request-save-animation' && mode === 'editor' && window.parent !== window) {
      window.parent.postMessage({
        type: 'asm-save-animation',
        animation: snapshotAnimation()
      }, window.location.origin);
    }
  });

  window.addEventListener('asm:compiled-animation', event => {
    if (mode !== 'editor' || window.parent === window) return;
    currentAnimation = {
      mode: event.detail?.mode === 'trace' ? 'trace' : 'legacy',
      code: typeof event.detail?.code === 'string' ? event.detail.code : '',
      input: typeof event.detail?.input === 'string' ? event.detail.input : '',
      scriptContent: typeof event.detail?.scriptContent === 'string' ? event.detail.scriptContent : '',
      sliceMode: event.detail?.sliceMode === 'manual' ? 'manual' : event.detail?.sliceMode === 'full' ? 'full' : 'auto',
      watches: Array.isArray(event.detail?.watches) ? event.detail.watches : [],
      skins: event.detail?.skins && typeof event.detail.skins === 'object' ? event.detail.skins : {},
      rules: Array.isArray(event.detail?.rules) ? event.detail.rules : [],
      traceDocument: event.detail?.traceDocument && typeof event.detail.traceDocument === 'object' ? event.detail.traceDocument : null
    };
    window.parent.postMessage({
      type: 'asm-animation-compiled',
      animation: currentAnimation
    }, window.location.origin);
  });

  window.addEventListener('load', () => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'asm-embed-ready', mode }, window.location.origin);
  });
})();
