(function () {
  let document = null;
  let currentFrame = 0;
  let cameraTimer = null;

  function animationDuration(duration) {
    const cssRate = Number(getComputedStyle(window.document.documentElement)
      .getPropertyValue('--asm-animation-playback-rate'));
    const rate = Math.max(0.25, Math.min(4, Number(window.asmGetAnimationPlaybackRate?.()) || cssRate || 1));
    return Math.max(1, (Number(duration) || 520) / rate);
  }

  function frameCount() {
    return document?.frames?.length || 0;
  }

  function cameraRuleForFrame(frame) {
    return (document?.studio?.cameraRules || []).filter(rule => {
      if (Array.isArray(rule.frameIds) && rule.frameIds.length && !rule.frameIds.includes(frame.id)) return false;
      return window.ASMTraceRules?.conditionMatches?.(frame, rule.condition) !== false;
    }).at(-1) || null;
  }

  function applyPlaybackCamera(frame, previousFrame = null) {
    clearTimeout(cameraTimer);
    if (!frame || window.document.body.classList.contains('asm-trace-studio-open')) return;
    cameraTimer = setTimeout(() => {
      if (document?.frames?.[currentFrame]?.id !== frame.id) return;
      const rule = cameraRuleForFrame(frame);
      const cameraTransition = previousFrame
        ? window.ASMTraceTransitions?.resolve?.(document, previousFrame, frame, '$camera', new Set(['$camera']))
        : null;
      const animate = Boolean(previousFrame) && cameraTransition?.mode !== 'instant';
      const duration = animationDuration(cameraTransition?.duration);

      if (rule?.manualFrame && Number.isFinite(Number(rule.centerX)) && Number.isFinite(Number(rule.centerY))) {
        const cameraTargetKey = window.ASMTraceRenderers?.cameraObjectKey?.(rule.binding?.targetKey);
        const anchor = cameraTargetKey
          ? window.ASMTraceRenderers?.currentAnchorForKey?.(
            cameraTargetKey,
            rule.binding.targetAnchor || 'center',
            true
          )
          : null;
        window.setCamera?.(
          anchor ? anchor.x + (Number(rule.binding.dx) || 0) : Number(rule.centerX),
          anchor ? anchor.y + (Number(rule.binding.dy) || 0) : Number(rule.centerY),
          Number(rule.zoom) || 0.92,
          animate,
          duration
        );
        return;
      }

      if (frame.keepLastFocus && (!rule || (rule.autoCapture !== false && !rule.target))) {
        const fitted = window.ASMTraceRenderers?.fitCurrentObjectsCamera?.(
          Number(rule?.zoom) || 0.92,
          animate,
          duration,
          Number(rule?.offsetX) || 0,
          Number(rule?.offsetY) || 0,
          true
        );
        if (fitted) return;
      }

      const focus = rule?.target ? window.ASMTraceRenderers?.currentAnchor?.(rule.target) : null;
      const bounds = focus ? window.ASMTraceRenderers?.currentBounds?.() : null;
      const followX = focus && bounds ? focus.x - bounds.centerX : 0;
      const followY = focus && bounds ? focus.y - bounds.centerY : 0;
      if (rule && rule.autoCapture === false) {
        const currentView = window.getCameraViewport?.(Number(rule.zoom) || 0.92);
        window.setCamera?.(
          (focus?.x ?? currentView?.centerX ?? 0) + (Number(rule.offsetX) || 0),
          (focus?.y ?? currentView?.centerY ?? 0) + (Number(rule.offsetY) || 0),
          Number(rule.zoom) || 0.92,
          animate,
          duration
        );
        return;
      }
      const fitted = window.ASMTraceRenderers?.fitCurrentObjectsCamera?.(
        Number(rule?.zoom) || 0.92,
        animate,
        duration,
        (Number(rule?.offsetX) || 0) + followX,
        (Number(rule?.offsetY) || 0) + followY,
        true
      );
      if (fitted) return;
      window.setAutoCamera?.(
        Number(rule?.zoom) || 0.92,
        animate,
        (Number(rule?.offsetX) || 0) + followX,
        (Number(rule?.offsetY) || 0) + followY,
        duration
      );
    }, 0);
  }

  function render(index, options = {}) {
    if (!document || !frameCount()) return Promise.resolve();
    const next = Math.max(0, Math.min(frameCount() - 1, index));
    const requestedFrom = Number.isInteger(options.fromIndex) ? options.fromIndex : currentFrame;
    const fromIndex = Math.max(0, Math.min(frameCount() - 1, requestedFrom));
    const direction = Math.sign(next - fromIndex);
    const previous = (options.forceTransition || next !== fromIndex) ? document.frames[fromIndex] : null;
    currentFrame = next;
    const frame = document.frames[currentFrame];
    const transition = window.ASMTraceRenderers.renderFrame(document, frame, previous || null, {
      ...options,
      fromIndex,
      toIndex: currentFrame,
      direction
    });
    window.dispatchEvent(new CustomEvent('asm:trace-frame', {
      detail: {
        document,
        frame,
        previousFrame: previous || null,
        index: currentFrame,
        fromIndex,
        direction
      }
    }));
    applyPlaybackCamera(frame, previous || null);
    if (typeof window.syncCurrentFrameFromCodeScript === 'function') window.syncCurrentFrameFromCodeScript();
    if (typeof window.clearAllEditorHighlights === 'function') window.clearAllEditorHighlights();
    if (typeof window.addEditorHighlight === 'function' && Number(frame.source?.line) > 0) {
      window.addEditorHighlight(Number(frame.source.line));
    }
    return transition;
  }

  function nextKey(direction) {
    const next = currentFrame + direction;
    if (next >= 0 && next < frameCount()) return render(next);
    return Promise.resolve();
  }

  function installCodeScript() {
    window.CodeScript = {
      next() { return nextKey(1); },
      prev() { return nextKey(-1); },
      next_key_frame() { return nextKey(1); },
      prev_key_frame() { return nextKey(-1); },
      reset() { return render(0); },
      goto(index) { return render(index === -1 ? frameCount() - 1 : index); },
      get_frame_count() { return frameCount(); },
      get_current_frame_index() { return currentFrame; },
      get_current_line() { return Number(document?.frames?.[currentFrame]?.source?.line) || 0; },
      get_key_frames() { return Array.from({ length: frameCount() }, (_, index) => index); },
      get_stop_frames() { return []; },
      is_stop_frame() { return false; },
      is_fast_frame() { return false; },
      is_faston_frame() { return false; },
      is_skip_frame() { return false; },
      has_next_key() { return currentFrame < frameCount() - 1; },
      has_prev_key() { return currentFrame > 0; }
    };
  }

  function apply(source) {
    clearTimeout(cameraTimer);
    document = window.ASMTraceModel.normalizeTraceDocument(source);
    currentFrame = 0;
    installCodeScript();
    if (frameCount()) render(0);
    if (typeof window.initFrameInfoFromCodeScript === 'function') window.initFrameInfoFromCodeScript();
    if (typeof window.syncCurrentFrameFromCodeScript === 'function') window.syncCurrentFrameFromCodeScript();
    return document;
  }

  function setRules(rules) {
    if (!document) return;
    document.rules = Array.isArray(rules) ? window.ASMTraceModel.clone(rules) : [];
    render(currentFrame);
  }

  function setSkins(skins) {
    if (!document) return;
    document.skins = skins && typeof skins === 'object' ? window.ASMTraceModel.clone(skins) : {};
    render(currentFrame);
  }

  function previewTransition(index = currentFrame) {
    const target = Math.max(0, Math.min(frameCount() - 1, Number(index) || 0));
    const source = Math.max(0, target - 1);
    if (source === target) {
      render(target);
      return;
    }
    window.ASMTraceRenderers.renderFrame(document, document.frames[source], null, { animatePositions: false });
    requestAnimationFrame(() => render(target, { fromIndex: source, forceTransition: true }));
  }

  window.asmApplyTraceDocument = apply;
  window.ASMTracePlayer = {
    apply,
    render,
    previewTransition,
    setRules,
    setSkins,
    isActive: () => Boolean(document?.frames?.length),
    getDocument: () => document,
    getCurrentFrame: () => currentFrame
  };
})();
