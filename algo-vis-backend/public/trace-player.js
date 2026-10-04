/**
 * 模組：Trace 播放控制器
 *
 * 責任：管理目前 frame、前後導航、連續播放、時間線與鏡頭同步，並協調 renderer 和 code presenter。
 * 資料流：導覽先停止舊計時器，render 目標 frame 並取得 playback plan，再依 slots 推進事件與完成通知；跳轉或反向時直接建立一致終態。
 * 重要不變條件：同一時間只允許一個有效播放 token；隱藏分頁、快速連點與重播不得讓過期 timer 推進 frame。
 * 相容性：沒有事件排程或轉場設定的舊 trace 仍可逐 frame 播放，速度與自動播放採既有預設。
 */
(function () {
  let document = null;
  let currentFrame = 0;
  let cameraTimer = null;
  let viewportResizeFrame = null;
  let viewportObserver = null;
  let viewportSize = '';
  let viewportGeometryReady = false;
  let runtimeVisibilityConfirmed = false;
  let activePlaybackPlan = null;
  let lastPlaybackPlan = null;
  let viewportRebasePendingAfterPlayback = false;

  // ---------------------------------------------------------------------------
  // 區段：frame 與鏡頭狀態
  // ---------------------------------------------------------------------------
  function frameCount() {
    return document?.frames?.length || 0;
  }

  function applyPlaybackCamera(frame, previousFrame = null, delayMs = 0) {
    clearTimeout(cameraTimer);
    if (!frame || window.document.body.classList.contains('asm-trace-studio-open')) return;
    cameraTimer = setTimeout(() => {
      if (document?.frames?.[currentFrame]?.id !== frame.id) return;
      window.ASMTraceCamera.apply(document, frame, previousFrame);
    }, Math.max(0, Number(delayMs) || 0));
  }

  function refreshViewportCamera() {
    viewportResizeFrame = null;
    if (!document?.frames?.length) return;
    if (window.document.body.classList.contains('asm-trace-studio-open')
      && window.ASMTraceStudio?.refreshViewport) {
      window.ASMTraceStudio.refreshViewport();
      return;
    }
    if (isRuntimeEmbed() && runtimeVisibilityConfirmed) {
      rebaseCurrentFrame().catch(error => console.error('Trace viewport rebase failed', error));
      return;
    }
    window.ASMTraceCamera?.apply?.(document, document.frames[currentFrame], null, false);
  }

  function isRuntimeEmbed() {
    return window.document.body.classList.contains('asm-embed-runtime');
  }

  function rebaseCurrentFrame(options = {}) {
    if (!document?.frames?.length) return Promise.resolve(false);
    if (options.confirmVisible) runtimeVisibilityConfirmed = true;
    // The runtime iframe can report a delayed ResizeObserver update just after
    // it becomes visible. Re-rendering here would cancel a frame tween that
    // the presenter has already started, so defer the geometry rebase until
    // that tween has settled.
    if (activePlaybackPlan) {
      viewportRebasePendingAfterPlayback = true;
      return Promise.resolve(true);
    }
    const canvas = window.document.getElementById('arraySvg');
    const rect = canvas?.getBoundingClientRect?.();
    if (!(Number(rect?.width) > 0) || !(Number(rect?.height) > 0)) return Promise.resolve(false);
    viewportRebasePendingAfterPlayback = false;
    window.ASMTraceFrameTween?.cancel?.();
    const frame = document.frames[currentFrame];
    const transition = window.ASMTraceRenderers.renderFrame(document, frame, null, {
      animateEvents: false,
      animatePositions: false,
      viewportRebase: true
    });
    return Promise.resolve(transition).then(() => {
      viewportGeometryReady = true;
      window.ASMTraceCamera?.apply?.(document, frame, null, false);
      window.dispatchEvent(new CustomEvent('asm:trace-geometry-ready', {
        detail: { document, frame, index: currentFrame }
      }));
      return true;
    });
  }

  function scheduleViewportCameraRefresh() {
    if (viewportResizeFrame != null) return;
    viewportResizeFrame = window.requestAnimationFrame(refreshViewportCamera);
  }

  function observeViewportSize() {
    if (viewportObserver || typeof window.ResizeObserver !== 'function') return;
    const canvas = window.document.getElementById('arraySvg');
    if (!canvas) return;
    viewportObserver = new window.ResizeObserver(entries => {
      const rect = entries.find(entry => entry.target === canvas)?.contentRect;
      const width = Math.round(Number(rect?.width) || 0);
      const height = Math.round(Number(rect?.height) || 0);
      if (!(width > 0) || !(height > 0)) return;
      const nextSize = `${width}x${height}`;
      if (nextSize === viewportSize) return;
      viewportSize = nextSize;
      scheduleViewportCameraRefresh();
    });
    viewportObserver.observe(canvas);
  }

  // ---------------------------------------------------------------------------
  // 區段：Frame 導覽與播放計畫
  // ---------------------------------------------------------------------------
  function render(index, options = {}) {
    if (!document || !frameCount()) return Promise.resolve();
    const next = Math.max(0, Math.min(frameCount() - 1, index));
    const requestedFrom = Number.isInteger(options.fromIndex) ? options.fromIndex : currentFrame;
    const fromIndex = Math.max(0, Math.min(frameCount() - 1, requestedFrom));
    // Navigation performed while the page is hidden abandons the paused
    // transition. Returning to the page must show the latest requested frame,
    // not finish an animation the user could not see.
    const stable = options.stable === true || window.document.hidden === true;
    const direction = stable ? 0 : Math.sign(next - fromIndex);
    const previous = !stable && (options.forceTransition || next !== fromIndex)
      ? document.frames[fromIndex] : null;
    currentFrame = next;
    const frame = document.frames[currentFrame];
    const codeTransitionDelayMs = Math.max(0, Number(
      window.ASMTraceCodePresenter?.transitionDelay?.(document, frame)
    ) || 0);
    const cameraTransitionDurationMs = Math.max(0, Number(
      window.ASMTraceCamera?.transitionDuration?.(document, frame, previous || null)
    ) || 0);
    if (stable) window.ASMTraceFrameTween?.cancel?.();
    const transition = window.ASMTraceRenderers.renderFrame(document, frame, previous || null, {
      ...options,
      ...(stable ? { animateEvents: false, animatePositions: false } : {}),
      fromIndex,
      toIndex: currentFrame,
      direction,
      initialDelayMs: codeTransitionDelayMs,
      cameraTransitionDurationMs
    });
    const playbackPlan = transition?.playbackPlan || null;
    if (playbackPlan) {
      activePlaybackPlan = playbackPlan;
      lastPlaybackPlan = playbackPlan;
      window.dispatchEvent(new CustomEvent('asm:trace-playback-plan', {
        detail: { document, frame, previousFrame: previous || null, plan: playbackPlan }
      }));
    } else {
      activePlaybackPlan = null;
    }
    window.dispatchEvent(new CustomEvent('asm:trace-frame', {
      detail: {
        document,
        frame,
        previousFrame: previous || null,
        index: currentFrame,
        fromIndex,
        direction,
        plan: playbackPlan
      }
    }));
    // The new scene is installed synchronously. Start auto-camera capture in
    // the same tick so persistent objects anchored to a growing layout (and
    // arrows attached to them) never spend the code-highlight delay outside
    // the previous viewport.
    applyPlaybackCamera(frame, previous || null, 0);
    if (typeof window.syncCurrentFrameFromCodeScript === 'function') window.syncCurrentFrameFromCodeScript();
    if (typeof window.clearAllEditorHighlights === 'function') window.clearAllEditorHighlights();
    if (typeof window.addEditorHighlight === 'function' && Number(frame.source?.line) > 0) {
      window.addEditorHighlight(Number(frame.source.line));
    }
    if (!playbackPlan) return transition;
    const trackedTransition = Promise.resolve(transition).finally(() => {
      if (activePlaybackPlan !== playbackPlan) return;
      activePlaybackPlan = null;
      window.dispatchEvent(new CustomEvent('asm:trace-playback-plan-complete', {
        detail: { document, frame, plan: playbackPlan }
      }));
      if (viewportRebasePendingAfterPlayback) scheduleViewportCameraRefresh();
    });
    trackedTransition.playbackPlan = playbackPlan;
    return trackedTransition;
  }

  function renderStable(index, options = {}) {
    return render(index, { ...options, stable: true });
  }

  function nextKey(direction) {
    const next = currentFrame + direction;
    if (next < 0 || next >= frameCount()) return Promise.resolve();
    if (direction > 0 && activePlaybackPlan) {
      const settledFrame = currentFrame;
      // A forward input during playback first commits the current destination
      // frame without animation, then starts the following frame from that
      // stable geometry. This keeps one input equal to one forward step while
      // never waiting for an obsolete animation to finish.
      renderStable(settledFrame, { interruptedPlayback: true });
      return render(settledFrame + 1, { fromIndex: settledFrame });
    }
    return render(next);
  }

  // ---------------------------------------------------------------------------
  // 區段：播放器相容介面
  // ---------------------------------------------------------------------------
  function installCodeScript() {
    window.CodeScript = {
      next() { return nextKey(1); },
      next_stable() { return renderStable(currentFrame + 1); },
      prev() { return renderStable(currentFrame - 1); },
      next_key_frame() { return nextKey(1); },
      next_key_frame_stable() { return renderStable(currentFrame + 1); },
      prev_key_frame() { return renderStable(currentFrame - 1); },
      reset() { return renderStable(0); },
      goto(index) { return renderStable(index === -1 ? frameCount() - 1 : index); },
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

  // ---------------------------------------------------------------------------
  // 區段：文件載入與公開 API
  // ---------------------------------------------------------------------------
  function apply(source) {
    if (!window.__asmApplyingBuiltinDefault) {
      window.ASMDefaultAlgorithm?.cancel?.('external-trace');
    }
    clearTimeout(cameraTimer);
    activePlaybackPlan = null;
    lastPlaybackPlan = null;
    viewportRebasePendingAfterPlayback = false;
    document = window.ASMTraceModel.normalizeTraceDocument(source);
    currentFrame = 0;
    viewportGeometryReady = !isRuntimeEmbed();
    runtimeVisibilityConfirmed = !isRuntimeEmbed();
    observeViewportSize();
    installCodeScript();
    if (frameCount()) render(0, { animateEvents: false, animatePositions: false });
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
    rebaseCurrentFrame,
    renderStable,
    setRules,
    setSkins,
    isActive: () => Boolean(document?.frames?.length),
    getDocument: () => document,
    getCurrentFrame: () => currentFrame,
    isViewportGeometryReady: () => viewportGeometryReady,
    getActivePlaybackPlan: () => activePlaybackPlan,
    getLastPlaybackPlan: () => lastPlaybackPlan
  };
  observeViewportSize();
})();
