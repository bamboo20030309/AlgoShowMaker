(function () {
  const DEFAULTS = Object.freeze({
    mode: 'auto',
    duration: 520,
    easing: 'smooth'
  });

  const MODES = Object.freeze(['auto', 'instant']);
  const EASINGS = Object.freeze({
    smooth: { calcMode: 'spline', keySplines: '0.22 1 0.36 1' },
    snappy: { calcMode: 'spline', keySplines: '0.2 0.8 0.2 1' },
    linear: { calcMode: 'linear', keySplines: '' }
  });

  function clampDuration(value, fallback = DEFAULTS.duration) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(5000, number)) : fallback;
  }

  function defaults() {
    return { ...DEFAULTS };
  }

  function rules(document) {
    return Array.isArray(document?.studio?.transitions) ? document.studio.transitions : [];
  }

  function frameMatches(rule, fromFrame, toFrame) {
    if (!rule || !toFrame) return false;
    if (rule.fromFrameId && rule.fromFrameId !== fromFrame?.id) return false;
    if (rule.toFrameId && rule.toFrameId !== toFrame.id) return false;
    if (Array.isArray(rule.frameIds) && rule.frameIds.length && !rule.frameIds.includes(toFrame.id)) return false;
    return true;
  }

  function explicitRule(document, fromFrame, toFrame, targetKey) {
    return rules(document).filter(rule => (
      rule?.objectKey === targetKey && frameMatches(rule, fromFrame, toFrame)
    )).at(-1) || null;
  }

  function resolve(document, fromFrame, toFrame, targetKey, sourceKeys = null) {
    const base = defaults(document);
    const rule = explicitRule(document, fromFrame, toFrame, targetKey);
    const requestedMode = rule?.mode === 'instant' ? 'instant' : base.mode;
    const sourceKey = String(rule?.sourceKey || targetKey || '');
    const sourceExists = sourceKeys?.has ? sourceKeys.has(sourceKey) : true;
    let mode = requestedMode;
    if (mode === 'auto') mode = sourceExists ? 'move' : 'lift';
    return {
      id: rule?.id || '',
      explicit: Boolean(rule),
      requestedMode,
      mode,
      sourceKey,
      targetKey,
      duration: clampDuration(rule?.duration, base.duration),
      easing: EASINGS[rule?.easing] ? rule.easing : base.easing,
      sourceExists
    };
  }

  function timing(plan) {
    const easing = EASINGS[plan?.easing] || EASINGS.smooth;
    return {
      dur: `${clampDuration(plan?.duration)}ms`,
      calcMode: easing.calcMode,
      keySplines: easing.keySplines
    };
  }

  function hasCustomTransition(document, frameId, objectKey = '') {
    return rules(document).some(rule => (
      (!objectKey || rule.objectKey === objectKey)
      && (rule.toFrameId === frameId || rule.frameIds?.includes?.(frameId))
    ));
  }

  window.ASMTraceTransitions = {
    DEFAULTS,
    MODES,
    EASINGS,
    defaults,
    rules,
    explicitRule,
    resolve,
    timing,
    hasCustomTransition,
    clampDuration
  };
})();
