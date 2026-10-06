/**
 * 模組：Trace 指標狀態模型
 *
 * 責任：將一維、二維與 layout 目標正規化為相同的 pointer state，集中處理同目標避讓，
 * 並用固定的 enter／exit／move／retarget／reflow／stay 六種差異描述前後狀態。
 * 相容性：目前仍輸出舊 renderer 可直接繪製的 object descriptor；legacy 模式保留到使用者驗證完成。
 */
(function () {
  const TRANSITIONS = Object.freeze({
    ENTER: 'enter',
    EXIT: 'exit',
    MOVE: 'move',
    RETARGET: 'retarget',
    REFLOW: 'reflow',
    STAY: 'stay'
  });
  // Canonical-only validation mode: keep the legacy implementation in its
  // original modules for comparison, but do not let runtime rendering silently
  // switch back to it while the new pointer model is being evaluated.
  const CANONICAL_ONLY = true;

  function rounded(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
  }

  function placementKey(placement) {
    if (!placement) return '';
    return [placement.x, placement.y, placement.width, placement.height]
      .map(rounded).join(':');
  }

  function pointerId(intent = {}) {
    return String(intent.pointerId
      || intent.sourceVisualContinuityKey
      || intent.sourceAliasContinuityKey
      || intent.id
      || [intent.sourceSnapshotOwner, intent.sourceVariableId, intent.targetVariableId,
        intent.markerSortOrder].filter(value => value !== '' && value != null).join(':'));
  }

  function pointerInstanceId(intent = {}, roleId = pointerId(intent)) {
    const lifetime = String(
      intent.sourceRuntimeIdentity
      || intent.runtimeIdentity
      || intent.lifetimeIdentity
      || ''
    );
    return lifetime ? `${roleId}@${lifetime}` : roleId;
  }

  function laneFor(intent = {}) {
    if (intent.lane) return String(intent.lane);
    if (intent.shape === 'arrow-left' || intent.target?.axis === 'row') return 'left';
    if (intent.target?.anchor === 'bottom') return 'bottom';
    if (intent.target?.anchor === 'right') return 'right';
    return 'top';
  }

  function normalizeTarget(target = {}, lane = 'top') {
    const anchor = String(target.anchor || (lane === 'left' ? 'left' : lane === 'right'
      ? 'right' : lane === 'bottom' ? 'bottom' : 'top'));
    return {
      ...target,
      anchor,
      axis: target.axis ? String(target.axis) : ''
    };
  }

  function normalize(intent = {}, context = {}) {
    const lane = laneFor(intent);
    const target = normalizeTarget(intent.target, lane);
    const targetPlacement = intent.targetPlacement
      || context.resolvePlacement?.(target, intent)
      || null;
    const unresolved = Boolean(intent.unresolvedIndex || !targetPlacement);
    const resolvedKey = unresolved ? '' : String(
      intent.targetKey || context.resolveTargetKey?.(target, intent) || placementKey(targetPlacement)
    );
    const unresolvedAxis = String(target.axis || lane || 'top');
    const targetKey = unresolved
      ? `unresolved:${intent.targetObjectKey || intent.targetVariableId || resolvedKey}:${unresolvedAxis}`
      : resolvedKey;
    const roleId = pointerId(intent);
    return {
      ...intent,
      pointerId: roleId,
      pointerInstanceId: pointerInstanceId(intent, roleId),
      lane,
      status: unresolved ? 'unresolved' : 'resolved',
      target,
      pointerTarget: normalizeTarget(intent.pointerTarget || target, lane),
      targetKey,
      targetPlacement,
      labelWidth: Math.max(1, Number(intent.labelWidth) || 18),
      markerSortOrder: Number.isFinite(Number(intent.markerSortOrder))
        ? Number(intent.markerSortOrder) : 0,
      offsetX: Number(intent.offsetX) || 0,
      pointerTargetOffsetX: Number(intent.pointerTargetOffsetX) || 0
    };
  }

  function sortPointers(left, right) {
    return Number(left.markerSortOrder) - Number(right.markerSortOrder)
      || String(left.pointerId).localeCompare(String(right.pointerId));
  }

  function unresolvedRelativeLayout(group, targetPlacement, baseCellWidth, gap) {
    if (group.length < 2 || !targetPlacement) return null;
    const relative = group.map(item => ({
      item,
      base: String(item.relativeMarkerBase || ''),
      offset: Number(item.relativeMarkerOffset)
    }));
    const base = relative[0]?.base;
    if (!base || relative.some(entry => entry.base !== base || !Number.isInteger(entry.offset))) {
      return null;
    }
    const slots = new Map();
    relative.forEach(entry => {
      if (!slots.has(entry.offset)) slots.set(entry.offset, []);
      slots.get(entry.offset).push(entry.item);
    });
    const centers = new Map();
    slots.forEach((items, offset) => {
      const ordered = [...items].sort(sortPointers);
      const slotWidth = ordered.reduce((total, item) => total + item.labelWidth, 0)
        + Math.max(0, ordered.length - 1) * gap;
      let cursor = offset * baseCellWidth - slotWidth / 2;
      ordered.forEach(item => {
        centers.set(item, cursor + item.labelWidth / 2);
        cursor += item.labelWidth + gap;
      });
    });
    const rightEdge = Math.max(...relative.map(({ item }) => centers.get(item) + item.labelWidth / 2));
    const targetCenter = targetPlacement.x + targetPlacement.width / 2;
    const shift = targetPlacement.x - gap - rightEdge;
    return {
      markerPlacement: targetPlacement,
      offsets: new Map(relative.map(({ item }) => [
        item, centers.get(item) + shift - targetCenter
      ]))
    };
  }

  function layout(intents = [], context = {}) {
    const gap = Math.max(0, Number(context.gap) || 8);
    const groups = new Map();
    intents.map(intent => normalize(intent, context)).forEach(state => {
      const groupKey = `${state.lane}:${state.targetKey}`;
      if (!groups.has(groupKey)) groups.set(groupKey, []);
      groups.get(groupKey).push(state);
    });
    const states = [];
    groups.forEach(group => {
      const ordered = [...group].sort(sortPointers);
      const totalWidth = ordered.reduce((total, item) => total + item.labelWidth, 0)
        + Math.max(0, ordered.length - 1) * gap;
      const targetPlacement = ordered[0].targetPlacement
        || context.placementForKey?.(`${ordered[0].targetObjectKey}#${ordered[0].indexValue}`)
        || null;
      const targetWidth = Math.max(0, Number(targetPlacement?.width) || 0);
      const baseCellWidth = Math.max(1, Number(ordered[0].baseCellWidth) || 40);
      const unresolved = ordered[0].status === 'unresolved';
      const relativeLayout = unresolved
        ? unresolvedRelativeLayout(ordered, targetPlacement, baseCellWidth, gap)
        : null;
      const markerPlacement = relativeLayout?.markerPlacement || (unresolved && targetPlacement ? (() => {
        if (ordered[0].lane === 'left' || !ordered[0].target?.axis) {
          return {
            ...targetPlacement,
            x: targetPlacement.x - gap - totalWidth / 2 - targetPlacement.width / 2
          };
        }
        if (ordered[0].lane === 'right') {
          return {
            ...targetPlacement,
            x: targetPlacement.x + targetPlacement.width + gap
              + totalWidth / 2 - targetPlacement.width / 2
          };
        }
        const verticalDirection = ordered[0].lane === 'bottom' ? 1 : -1;
        return {
          ...targetPlacement,
          y: targetPlacement.y + verticalDirection * (targetPlacement.height + gap)
        };
      })() : null);
      const keepArrowsVertical = targetWidth > baseCellWidth + 0.5;
      let cursor = -totalWidth / 2;
      ordered.forEach((state, slot) => {
        const offsetX = relativeLayout?.offsets.get(state) ?? (cursor + state.labelWidth / 2);
        states.push({
          ...state,
          slot,
          groupSize: ordered.length,
          offsetX,
          pointerTargetOffsetX: relativeLayout ? offsetX : keepArrowsVertical ? offsetX : 0,
          markerPlacement
        });
        cursor += state.labelWidth + gap;
      });
    });
    return states;
  }

  function toRendererObject(state = {}) {
    const object = { ...state };
    delete object.targetVariableId;
    delete object.targetObjectKey;
    delete object.targetRuntimeIdentity;
    delete object.targetPlacement;
    delete object.indexValue;
    delete object.unresolvedIndex;
    delete object.labelWidth;
    delete object.label;
    delete object.markerSortExpression;
    delete object.relativeMarkerBase;
    delete object.relativeMarkerOffset;
    if (state.status === 'unresolved') {
      object.markerUnresolved = true;
      object.markerPlacement = state.markerPlacement;
      delete object.target;
      delete object.pointerTarget;
    }
    return object;
  }

  function samePosition(left, right) {
    if (!left || !right) return false;
    return ['x', 'y', 'width', 'height'].every(key => (
      Math.abs((Number(left[key]) || 0) - (Number(right[key]) || 0)) <= 0.1
    ));
  }

  function diff(previous, current) {
    if (!previous && current) return TRANSITIONS.ENTER;
    if (previous && !current) return TRANSITIONS.EXIT;
    if (!previous && !current) return TRANSITIONS.STAY;
    if (previous.targetKey !== current.targetKey || previous.lane !== current.lane
      || previous.status !== current.status) return TRANSITIONS.RETARGET;
    if (previous.slot !== current.slot || previous.groupSize !== current.groupSize
      || Math.abs((Number(previous.offsetX) || 0) - (Number(current.offsetX) || 0)) > 0.1) {
      return TRANSITIONS.REFLOW;
    }
    if (!samePosition(previous.targetPlacement, current.targetPlacement)) return TRANSITIONS.MOVE;
    return TRANSITIONS.STAY;
  }

  function stateFromElement(element, placement = null) {
    if (!element) return null;
    return {
      pointerId: String(element.dataset?.tracePointerId || ''),
      pointerInstanceId: String(element.dataset?.tracePointerInstanceId
        || element.dataset?.tracePointerId || ''),
      targetKey: String(element.dataset?.tracePointerTargetKey
        || element.dataset?.traceBindingTarget || ''),
      lane: String(element.dataset?.tracePointerLane || 'top'),
      status: String(element.dataset?.tracePointerStatus
        || (element.dataset?.traceMarkerUnresolved === '1' ? 'unresolved' : 'resolved')),
      slot: Number(element.dataset?.tracePointerSlot) || 0,
      groupSize: Number(element.dataset?.tracePointerGroupSize) || 1,
      offsetX: Number(element.dataset?.tracePointerOffsetX) || 0,
      targetPlacement: placement
    };
  }

  function transitionPlan(previousEntries = [], currentEntries = [], options = {}) {
    const previous = previousEntries.filter(entry => entry?.state?.pointerInstanceId);
    const current = currentEntries.filter(entry => entry?.state?.pointerInstanceId);
    const previousByInstance = new Map();
    previous.forEach(entry => {
      const instanceId = String(entry.state.pointerInstanceId);
      if (!previousByInstance.has(instanceId)) previousByInstance.set(instanceId, []);
      previousByInstance.get(instanceId).push(entry);
    });
    const consumedPrevious = new Set();
    const planned = [];
    const roleContinuation = typeof options.roleContinuation === 'function'
      ? options.roleContinuation : () => null;

    current.forEach(currentEntry => {
      const instanceId = String(currentEntry.state.pointerInstanceId);
      const exact = (previousByInstance.get(instanceId) || [])
        .find(entry => !consumedPrevious.has(entry));
      let previousEntry = exact || null;
      if (!previousEntry) {
        const suggested = roleContinuation(currentEntry, previous, consumedPrevious);
        if (suggested && !consumedPrevious.has(suggested)) previousEntry = suggested;
      }
      if (previousEntry) consumedPrevious.add(previousEntry);
      planned.push({
        type: diff(previousEntry?.state || null, currentEntry.state),
        pointerId: currentEntry.state.pointerId,
        pointerInstanceId: currentEntry.state.pointerInstanceId,
        previous: previousEntry,
        current: currentEntry
      });
    });
    previous.forEach(previousEntry => {
      if (consumedPrevious.has(previousEntry)) return;
      planned.push({
        type: TRANSITIONS.EXIT,
        pointerId: previousEntry.state.pointerId,
        pointerInstanceId: previousEntry.state.pointerInstanceId,
        previous: previousEntry,
        current: null
      });
    });
    return planned;
  }

  window.ASMTracePointerModel = Object.freeze({
    build: 'pointer-4',
    transitions: TRANSITIONS,
    canonicalOnly: () => CANONICAL_ONLY,
    enabled: () => true,
    pointerId,
    pointerInstanceId,
    normalize,
    layout,
    toRendererObject,
    diff,
    stateFromElement,
    transitionPlan
  });
})();
