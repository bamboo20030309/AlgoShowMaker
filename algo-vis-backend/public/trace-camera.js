/**
 * 模組：Trace 鏡頭規則
 *
 * 責任：依目前 frame、Studio 規則與焦點物件計算 viewport 的平移、縮放與轉場時間。
 * 資料流：先選出作用中的 camera rule，再由 renderer 提供的內容邊界與焦點座標推導 transform，最後交由播放器決定是否動畫化。
 * 重要不變條件：同一 frame 的規則解析必須具決定性；沒有可用 bounds 或 focus 時仍要維持安全的預設鏡頭。
 * 相容性：舊文件未保存 cameraRules 時視為無自訂鏡頭，duration 與 transition 的缺值沿用既有預設。
 */
(function () {
  // ---------------------------------------------------------------------------
  // 區段：規則條件與優先序
  // ---------------------------------------------------------------------------
  function cameraConditionMatches(trace, frame, condition) {
    if (!condition) return true;
    if (condition.expression && window.ASMTraceRules?.expressionMatches) {
      return window.ASMTraceRules.expressionMatches(trace, frame, condition) !== false;
    }
    return window.ASMTraceRules?.conditionMatches?.(frame, condition) !== false;
  }

  function ruleForFrame(trace, frame) {
    const matchingStudioRules = (trace?.studio?.cameraRules || []).filter(rule => {
      const hasFrameScope = Boolean(rule.frameIds?.length || rule.allFrames
        || rule.directiveNames || rule.frameSelectors || rule.sourceSelectors || rule.sourceFrameSelectors);
      const frameIds = rule.frameIds?.length
        ? rule.frameIds
        : window.ASMTraceViewSource?.frameIdsForDescriptor?.(rule, trace?.frames || []);
      if (hasFrameScope && !frameIds?.includes(frame.id)) return false;
      return cameraConditionMatches(trace, frame, rule.condition);
    });
    const frameOverride = matchingStudioRules.filter(rule => (
      rule.allFrames !== true
      && Boolean(rule.frameIds?.length || rule.directiveNames
        || rule.frameSelectors || rule.sourceSelectors || rule.sourceFrameSelectors)
    )).at(-1);
    if (frameOverride) return frameOverride;
    if (frame?.camera && cameraConditionMatches(trace, frame, frame.camera.condition)) {
      return frame.camera;
    }
    return matchingStudioRules.at(-1) || null;
  }
  function duration(value) {
    const cssRate = Number(getComputedStyle(window.document.documentElement)
      .getPropertyValue('--asm-animation-playback-rate'));
    const rate = Math.max(0.25, Math.min(4, Number(window.asmGetAnimationPlaybackRate?.()) || cssRate || 1));
    return Math.max(1, (Number(value) || 520) / rate);
  }
  // ---------------------------------------------------------------------------
  // 區段：鏡頭轉場解析
  // ---------------------------------------------------------------------------
  function transitionFor(trace, frame, previousFrame = null) {
    return previousFrame
      ? window.ASMTraceTransitions?.resolve?.(trace, previousFrame, frame, '$camera', new Set(['$camera']))
      : null;
  }
  function transitionDuration(trace, frame, previousFrame = null, animate = Boolean(previousFrame)) {
    if (!frame || !previousFrame || !animate) return 0;
    const transition = transitionFor(trace, frame, previousFrame);
    if (transition?.mode === 'instant') return 0;
    return Math.max(0, Number(transition?.duration) || 520);
  }
  // ---------------------------------------------------------------------------
  // 區段：viewport 幾何套用
  // ---------------------------------------------------------------------------
  function apply(trace, frame, previousFrame = null, animate = Boolean(previousFrame)) {
    if (!frame) return;
    const rule = ruleForFrame(trace, frame);
    const transition = transitionFor(trace, frame, previousFrame);
    const moving = animate && transition?.mode !== 'instant';
    const ms = duration(transition?.duration);
    const renderer = window.ASMTraceRenderers;
    const zoom = Number(rule?.zoom) || 0.92;
    if (rule?.manualFrame && Number.isFinite(Number(rule.centerX)) && Number.isFinite(Number(rule.centerY))) {
      const key = renderer?.cameraObjectKey?.(rule.binding?.targetKey);
      const anchor = key ? renderer?.currentAnchorForKey?.(key, rule.binding.targetAnchor || 'center', true) : null;
      window.setCamera?.(
        anchor ? anchor.x + (Number(rule.binding.dx) || 0) : Number(rule.centerX),
        anchor ? anchor.y + (Number(rule.binding.dy) || 0) : Number(rule.centerY),
        zoom, moving, ms);
      return;
    }
    if (frame.keepLastFocus && (!rule || (rule.autoCapture !== false && !rule.target))) {
      const target = renderer?.fitCurrentObjectsCamera?.(zoom, moving, ms,
        Number(rule?.offsetX) || 0, Number(rule?.offsetY) || 0, true);
      if (target) return target;
    }
    const focus = rule?.target ? renderer?.currentAnchor?.(rule.target) : null;
    const bounds = focus ? renderer?.currentBounds?.() : null;
    const dx = (Number(rule?.offsetX) || 0) + (focus && bounds ? focus.x - bounds.centerX : 0);
    const dy = (Number(rule?.offsetY) || 0) + (focus && bounds ? focus.y - bounds.centerY : 0);
    if (rule?.autoCapture === false && (!rule.target || focus)) {
      const view = window.getCameraViewport?.(zoom);
      window.setCamera?.((focus?.x ?? view?.centerX ?? 0) + (Number(rule.offsetX) || 0),
        (focus?.y ?? view?.centerY ?? 0) + (Number(rule.offsetY) || 0), zoom, moving, ms);
      return;
    }
    return renderer?.fitCurrentObjectsCamera?.(zoom, moving, ms, dx, dy, true)
      || window.setAutoCamera?.(zoom, moving, dx, dy, ms);
  }
  window.ASMTraceCamera = { apply, ruleForFrame, transitionDuration };
})();
