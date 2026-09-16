(function () {
  const mode = new URLSearchParams(window.location.search).get('asmEmbed');
  if (!mode) return;

  document.body.classList.add(`asm-embed-${mode}`);
  const normalize = window.ASMAlgorithmAnimation.normalize;
  let currentAnimation = normalize();
  let runtimeVisible = mode !== 'runtime';
  let runtimeGeometryRequest = 0;

  function settleAnimationVisuals() {
    // Event tweens use temporary SVG layers (moving values, comparison cards,
    // arrows and resize ghosts). A save/load may happen while one is active,
    // so settle and remove those layers before taking or applying a snapshot.
    window.ASMTraceFrameTween?.cancel?.();
    window.resetArrows?.();
  }

  function notifyAnimationApplied() {
    if (window.parent === window) return;
    const notify = () => window.parent.postMessage({
      type: 'asm-animation-applied',
      mode
    }, window.location.origin);
    if (typeof window.requestAnimationFrame !== 'function') {
      setTimeout(notify, 0);
      return;
    }
    // Let the initial canvas render and Trace Studio layout settle before the
    // parent reveals the editor iframe. This prevents partially built scenes
    // and thumbnail layers from flashing while the modal opens.
    window.requestAnimationFrame(() => window.requestAnimationFrame(notify));
  }

  function prepareRuntimeGeometry() {
    if (mode !== 'runtime' || !runtimeVisible || !currentAnimation.traceDocument?.frames?.length) {
      return Promise.resolve(false);
    }
    const request = ++runtimeGeometryRequest;
    return new Promise(resolve => {
      const run = () => Promise.resolve(window.ASMTracePlayer?.rebaseCurrentFrame?.({
        confirmVisible: true
      })).then(ready => {
        if (request !== runtimeGeometryRequest || !ready) return resolve(false);
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'asm-animation-geometry-ready',
            mode
          }, window.location.origin);
        }
        resolve(true);
      }).catch(error => {
        console.error('Algorithm slide geometry preparation failed', error);
        resolve(false);
      });
      if (typeof window.requestAnimationFrame !== 'function') {
        setTimeout(run, 0);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    });
  }

  function snapshotAnimation() {
    window.ASMTraceStudio?.flushSourceSettings?.();
    const input = document.getElementById('inputArea');
    const traceSettings = window.ASMTraceEditor?.snapshot?.() || {};
    // TraceEditor.snapshot() already returns a compact, detached trace and
    // postMessage performs the cross-frame structured clone. Avoid cloning the
    // same large frame list once more inside the editor before sending it.
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

  function refreshOutdatedEditorTrace(animation) {
    if (mode !== 'editor' || !animation.traceDocument?.frames?.length) return null;
    const status = window.ASMTraceProvenance?.status?.(
      animation.traceDocument,
      animation.code,
      animation.input
    );
    if (status?.kind !== 'outdated') return null;
    const runButton = document.getElementById('runBtn');
    if (!runButton || runButton.classList.contains('loading')) return null;
    window.__asmMigrateTraceSettingsOnNextRun = true;
    return new Promise(resolve => {
      const finish = () => resolve(true);
      window.addEventListener('asm:compile-finished', finish, { once: true });
      runButton.click();
    });
  }

  function applyAnimation(animation = {}) {
    settleAnimationVisuals();
    currentAnimation = normalize(animation);
    if (typeof aceEditor !== 'undefined') {
      window.__asmEmbeddedAnimationPayload = currentAnimation;
      aceEditor.setValue(currentAnimation.code, -1);
      if (typeof foldDrawBlocks === 'function') setTimeout(foldDrawBlocks, 0);
    }
    const input = document.getElementById('inputArea');
    if (input) input.value = currentAnimation.input;
    window.ASMTraceEditor?.loadAnimation?.(currentAnimation);
    if (currentAnimation.traceDocument?.frames?.length) {
      if (!window.ASMTraceEditor) window.asmApplyTraceDocument?.(currentAnimation.traceDocument);
      return refreshOutdatedEditorTrace(currentAnimation);
    }
    if (currentAnimation.scriptContent && typeof window.asmApplyAnimationScript === 'function') {
      window.asmApplyAnimationScript(currentAnimation.scriptContent);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'asm-load-animation') {
      const refresh = applyAnimation(event.data.animation);
      const applied = refresh && typeof refresh.finally === 'function'
        ? refresh.finally(notifyAnimationApplied)
        : (notifyAnimationApplied(), Promise.resolve());
      if (mode === 'runtime' && runtimeVisible) Promise.resolve(applied).then(prepareRuntimeGeometry);
      return;
    }
    if (event.data.type === 'asm-runtime-visibility' && mode === 'runtime') {
      runtimeVisible = event.data.visible === true;
      if (!runtimeVisible) {
        runtimeGeometryRequest += 1;
        return;
      }
      prepareRuntimeGeometry();
      return;
    }
    if (event.data.type === 'asm-request-save-animation' && mode === 'editor' && window.parent !== window) {
      settleAnimationVisuals();
      window.parent.postMessage({
        type: 'asm-save-animation',
        animation: snapshotAnimation()
      }, window.location.origin);
    }
    if (event.data.type === 'asm-request-export-animation-snapshot' && mode === 'editor' && window.parent !== window) {
      window.parent.postMessage({
        type: 'asm-export-animation-snapshot',
        requestId: event.data.requestId,
        animation: snapshotAnimation()
      }, window.location.origin);
    }
  });

  window.addEventListener('asm:compiled-animation', event => {
    if (mode !== 'editor' || window.parent === window) return;
    currentAnimation = normalize(event.detail || {});
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
