/**
 * 模組：物件轉場規則解析
 *
 * 責任：依 frame 範圍、目標 key 與 runtime alias 選出物件轉場類型、時間與 easing。
 * 資料流：先找最具體的 Studio 規則，再回退文件預設；解析結果交給 tween 排程，不直接操作 DOM。
 * 重要不變條件：規則比對以 from/to frame 與語意物件身分為準，重新命名或 alias 僅可透過明確 runtime identity 銜接。
 * 相容性：舊文件沒有 transitions 時使用既有預設；duration 會限制在安全範圍，無效類型回退為標準轉場。
 */
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

  // ---------------------------------------------------------------------------
  // 區段：轉場預設與規則比對
  // ---------------------------------------------------------------------------
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

  function objectKeyForVariable(frame, variableId) {
    const source = frame?.source || {};
    if (source.objectId && source.primaryVariableId === variableId) return source.objectId;
    return variableId;
  }

  function stateObjectMatch(frame, requestedKey) {
    const key = String(requestedKey || '');
    let best = null;
    Object.entries(frame?.state || {}).forEach(([variableId, entry]) => {
      const objectKey = objectKeyForVariable(frame, variableId);
      if (
        key !== objectKey
        && !key.startsWith(`${objectKey}#`)
        && !key.startsWith(`${objectKey}:`)
      ) return;
      if (!best || objectKey.length > best.objectKey.length) {
        best = { variableId, objectKey, entry };
      }
    });
    return best;
  }

  // ---------------------------------------------------------------------------
  // 區段：跨 frame 身分解析
  // ---------------------------------------------------------------------------
  function runtimeSourceAlias(fromFrame, toFrame, targetKey, sourceKeys) {
    if (!sourceKeys?.has) return '';
    const target = stateObjectMatch(toFrame, targetKey);
    const identity = String(target?.entry?.identity || '');
    if (!target || !identity) return '';
    const suffix = String(targetKey).slice(target.objectKey.length);
    for (const [variableId, entry] of Object.entries(fromFrame?.state || {})) {
      if (String(entry?.identity || '') !== identity) continue;
      const candidate = `${objectKeyForVariable(fromFrame, variableId)}${suffix}`;
      if (sourceKeys.has(candidate)) return candidate;
    }
    return '';
  }

  // ---------------------------------------------------------------------------
  // 區段：最終轉場決議
  // ---------------------------------------------------------------------------
  function resolve(document, fromFrame, toFrame, targetKey, sourceKeys = null) {
    const base = defaults(document);
    const rule = explicitRule(document, fromFrame, toFrame, targetKey);
    const requestedMode = rule?.mode === 'instant' ? 'instant' : base.mode;
    let sourceKey = String(rule?.sourceKey || targetKey || '');
    const fromGeneration = Number(fromFrame?.sceneGeneration);
    const toGeneration = Number(toFrame?.sceneGeneration);
    const crossesKeepBoundary = !rule
      && Number.isFinite(fromGeneration)
      && Number.isFinite(toGeneration)
      && fromGeneration !== toGeneration
      && Boolean(stateObjectMatch(toFrame, targetKey));
    // @keep creates a retained old scene and a new live scene. Do not let an
    // equal variable/object key silently reconnect those generations; the
    // retained copy owns the outgoing motion while the new live object starts
    // at its authored position.
    if (crossesKeepBoundary) sourceKey = '';
    if (!rule && !crossesKeepBoundary && sourceKeys?.has && !sourceKeys.has(sourceKey)) {
      sourceKey = runtimeSourceAlias(fromFrame, toFrame, targetKey, sourceKeys) || sourceKey;
    }
    const sourceExists = sourceKeys?.has ? sourceKeys.has(sourceKey) : true;
    let mode = crossesKeepBoundary ? 'instant' : requestedMode;
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

  // ---------------------------------------------------------------------------
  // 區段：播放計畫時間摘要
  // ---------------------------------------------------------------------------
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
    runtimeSourceAlias,
    resolve,
    timing,
    hasCustomTransition,
    clampDuration
  };
})();
