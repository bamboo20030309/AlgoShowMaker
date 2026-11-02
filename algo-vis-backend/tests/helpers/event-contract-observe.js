'use strict';
const { locateCase, verifyEvent } = require('./event-contract-oracle');
const own = (value, key) => Object.prototype.hasOwnProperty.call(value || {}, key);
const compact = value => String(value || '').replace(/\s+/g, '').replace(/;$/, '');
const primitive = data => {
  if (data == null) return data;
  if (typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(primitive);
  if (Array.isArray(data.items)) return data.items.map(primitive);
  if (own(data, 'value')) return primitive(data.value);
  return undefined;
};
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
const aliases = { sequence: 'sequence-operation', assignment: 'assign' };
const isType = (event, types) => types.some(type => (aliases[type] || type) === event.type);
const targetOf = event => (event?.targets || []).find(target => target.role === 'target') || event?.targets?.[0];
const sourcesOf = event => (event?.targets || []).filter(target => String(target.role || '').startsWith('source'));

// Observations come from Trace records only. Expected values are read solely by
// the final strict comparator. This module never invokes the product planner.
function observeCase({ trace, item, manifest, compileOutput }) {
  const located = locateCase(manifest, item);
  const frames = trace.frames || [];
  const all = [];
  const seen = new Set();
  frames.forEach((frame, frameIndex) => (frame.events || []).forEach(event => {
    const key = event.id ? event.id + '|' + (event.recursionActivationId || '') : null;
    if (key && seen.has(key)) return;
    if (key) seen.add(key);
    all.push({ event, frameIndex });
  }));
  all.sort((a, b) => Number(a.event.order) - Number(b.event.order));
  const atLine = all.filter(record => Number(record.event.line ?? record.event.source?.line) === located.sourceLine);
  const relevant = atLine.filter(record => isType(record.event, item.eventTypes || []));
  const record = relevant.find(record => ['assign', 'write', 'sequence-operation', 'swap', 'compare'].includes(record.event.type))
    || relevant[0] || (item.assertionKind === 'layout' ? atLine.find(record => record.event.type === 'assign') : null);
  const actual = {};
  const unsupported = [];
  const addUnsupported = (path, reason) => unsupported.push({ path, reason });
  const variableName = id => trace.variables?.[id]?.name || '';
  const expression = target => compact(target?.expression || variableName(target?.variableId));
  const activation = event => event?.function || event?.recursionFunction || event?.source?.functionName;
  let frameIndex = record?.frameIndex ?? -1;
  const event = record?.event;
  const before = new Map();

  function setState(frame) {
    for (const [id, entry] of Object.entries(frame?.state || {})) before.set(id, primitive(entry.data));
  }
  for (let i = 0; i < frameIndex; i++) setState(frames[i]);
  // Reapply preceding mutations within this capture. This is independent state
  // reconstruction; no replay-plan checkpoints or renderer identities are used.
  if (record) for (const prior of all.filter(candidate => candidate.frameIndex === frameIndex
    && Number(candidate.event.order) < Number(event.order))) {
    const target = targetOf(prior.event);
    if (!target?.variableId || !own(prior.event.payload, 'after')) continue;
    const next = primitive(prior.event.payload.after);
    if (Number.isInteger(target.resolvedIndex)) {
      const array = before.get(target.variableId);
      if (Array.isArray(array)) { const copy = array.slice(); copy[target.resolvedIndex] = next; before.set(target.variableId, copy); }
    } else before.set(target.variableId, next);
  }
  const beforeNamed = () => Object.fromEntries([...before].map(([id, value]) => [variableName(id), value]).filter(([name]) => name));
  const frame = frames[frameIndex];
  const preceding = frameIndex > 0 ? frames[frameIndex - 1] : null;
  const plainState = frame => Object.fromEntries(Object.entries(frame?.state || {})
    .map(([id, entry]) => [variableName(id) || entry.name, primitive(entry.data)]));

  function valueFor(target, after = false) {
    if (!target) return undefined;
    let value = after ? primitive(frame?.state?.[target.variableId]?.data) : before.get(target.variableId);
    if (value === undefined && !after) value = primitive(frame?.state?.[target.variableId]?.data);
    const indices = Array.isArray(target.resolvedIndices) ? target.resolvedIndices
      : Number.isInteger(target.resolvedIndex) ? [target.resolvedIndex]
        : /^\d+$/.test(target.indexExpression || '') ? [Number(target.indexExpression)] : [];
    for (const index of indices) value = Array.isArray(value) ? value[index] : undefined;
    return value;
  }
  function visible(target, reference = preceding || frame) {
    if (!target?.variableId || !reference?.state) return false;
    return own(reference.state, target.variableId) && !(reference.captureOnlyVariableIds || []).includes(target.variableId);
  }
  function snapshotValue(snapshot) {
    if (snapshot.data !== undefined) return primitive(snapshot.data);
    if (Array.isArray(snapshot.values)) return primitive(snapshot.values);
    const id = snapshot.sourceVariableId;
    const entry = snapshot.values?.[id] ?? snapshot.state?.[id];
    if (entry !== undefined) return primitive(entry?.data ?? entry);
    return undefined;
  }
  function sourceObservation(source, index, owner = event) {
    const output = { expression: expression(source) };
    const p = owner.payload || {};
    let data;
    if (own(source, 'value')) data = source.value;
    else if (source.role === 'source-left' && own(p, 'left')) data = p.left;
    else if (source.role === 'source-right' && own(p, 'right')) data = p.right;
    else if (sourcesOf(owner).length === 1 && own(p, 'source') && p.source !== null) data = p.source;
    else if (source.role === owner.selectedSourceRole && own(p, 'source')) data = p.source;
    const literal = source.literal === true || (!source.variableId && /^[-+]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(output.expression));
    let value = data === undefined ? valueFor(source) : primitive(data);
    if (value === undefined && literal) value = Number(source.literalValue ?? output.expression);
    if (value !== undefined) output.value = value;
    if (literal) output.literal = true;
    if (source.variableId) output.visible = visible(source);
    return output;
  }

  if (item.assertionKind === 'control') {
    addUnsupported('control', 'Requires an actual browser control interaction; Trace alone cannot prove it.');
  } else if (item.assertionKind === 'layout') {
    if (!record) addUnsupported('event', 'No operation at the CASE source line.');
    else {
      const snapshots = (trace.snapshots || []).filter(snapshot => (frame.snapshotIds || []).includes(snapshot.id));
      if (snapshots.length === 1) actual.snapshot = snapshotValue(snapshots[0]);
      if (snapshots.length > 1) actual.snapshots = snapshots.map(snapshotValue);
      const target = targetOf(event);
      if (target?.variableId) actual.liveAfter = primitive(frame.state?.[target.variableId]?.data);
    }
  } else if (item.assertionKind === 'read') {
    const ownerRecord = atLine.find(candidate => ['assign', 'write'].includes(candidate.event.type));
    if (ownerRecord) {
      frameIndex = ownerRecord.frameIndex;
      // Read records do not encode values themselves. Capture-state values are
      // observed rather than copying potentially erroneous arithmetic payloads.
      const readTargets = ownerRecord.event.semantics?.reads || sourcesOf(ownerRecord.event);
      actual.sources = readTargets.map(target => {
        const value = valueFor(target);
        return { expression: expression(target), ...(value === undefined ? {} : { value }) };
      });
      actual.ownerEventId = ownerRecord.event.id;
      actual.readEventIds = (ownerRecord.event.semantics?.readEventIds || []).slice();
    } else addUnsupported('read', 'No owning assignment exists at the CASE source line.');
  } else if (!record) {
    addUnsupported('event', 'No event with the requested type at the CASE source line.');
  } else {
    const target = targetOf(event);
    const p = event.payload || {};
    if (target) {
      actual.target = event.type === 'swap' ? variableName(target.variableId) : expression(target);
      if (event.type === 'declare') {
        if (!before.has(target.variableId)) actual.before = null;
        actual.initialized = p.value !== null && p.value !== undefined;
        if (actual.initialized) actual.after = primitive(p.value);
      } else if (event.type === 'swap' || event.type === 'sequence-operation') {
        const id = target.variableId;
        if (before.has(id)) actual.before = before.get(id);
        if (frame?.state?.[id]) actual.after = primitive(frame.state[id].data);
      } else {
        if (own(p, 'before')) actual.before = primitive(p.before);
        else if (valueFor(target) !== undefined) actual.before = valueFor(target);
        if (own(p, 'after')) actual.after = primitive(p.after);
        else if (valueFor(target, true) !== undefined) actual.after = valueFor(target, true);
      }
      if (target.variableId) actual.targetVisible = visible(target, frame);
    }
    let sources = sourcesOf(event);
    if (event.conditionalSelection) sources = sources.filter(source => source.role === event.selectedSourceRole);
    if (sources.length) actual.sources = sources.map((source, index) => sourceObservation(source, index));
    if (event.selectionOperation) actual.selectionOperation = event.selectionOperation;
    if (event.selectedSourceRole) {
      actual.selectedSourceRole = event.selectedSourceRole;
      const selected = sourcesOf(event).find(source => source.role === event.selectedSourceRole);
      if (selected) actual.selectedSource = expression(selected);
    }
    // Nested min/max records retain the comparison operands separately from
    // the top-level arithmetic operands. Expand the selected operand at its
    // actual position, preserving other repeated operands instead of globally
    // deduplicating b in expressions such as min(b,c)+b.
    if (event.selectionSteps?.length && (event.binaryOperation || event.multiSourceArithmetic)) {
      const steps = event.selectionSteps;
      const selection = steps[steps.length - 1];
      actual.selectionOperation = selection.operation;
      const selected = (selection.targets || []).find(source => source.role === selection.selectedSourceRole);
      if (selected) actual.selectedSource = expression(selected);
      const expanded = new Set();
      actual.sources = sources.flatMap((source, index) => {
        const stepIndex = steps.findIndex((step, candidate) => !expanded.has(candidate)
          && (step.targets || []).some(target => target.role === step.selectedSourceRole
            && target.variableId === source.variableId && expression(target) === expression(source)));
        if (stepIndex < 0) return [sourceObservation(source, index)];
        expanded.add(stepIndex);
        const step = steps[stepIndex];
        const owner = { targets: step.targets, selectedSourceRole: step.selectedSourceRole,
          payload: { left: step.left, right: step.right, source: step.source } };
        return (step.targets || []).map((target, operandIndex) => sourceObservation(target, operandIndex, owner));
      });
    }
    if (own(event, 'conditionResult')) actual.condition = event.conditionResult;
    if (event.conditionalSelection) {
      const executedReads = atLine.filter(candidate => candidate.event.type === 'read')
        .flatMap(candidate => candidate.event.targets || []).map(expression);
      actual.notRead = sourcesOf(event).filter(source => !executedReads.includes(expression(source))).map(expression);
    }
    if (event.type === 'compare') {
      actual.left = primitive(p.left);
      actual.right = primitive(p.right);
      actual.operation = event.operation;
      actual.result = event.result;
      if (actual.left !== undefined && actual.right !== undefined) {
        actual.relation = ['==', '!='].includes(event.operation)
          ? (same(actual.left, actual.right) ? '=' : '≠')
          : actual.left < actual.right ? '<' : actual.left > actual.right ? '>' : '=';
      }
      // A comparison can be part of a declaration/assignment at this same line.
      const receiver = atLine.find(candidate => candidate.event.type === 'assign');
      if (receiver) {
        const receiverTarget = targetOf(receiver.event);
        if (receiverTarget) actual.target = expression(receiverTarget);
        if (own(receiver.event.payload, 'after')) actual.after = primitive(receiver.event.payload.after);
      }
    }
    if (event.type === 'declare') {
      const initializer = atLine.find(candidate => candidate.event.type === 'assign' && candidate.event.declarationInitializer);
      if (initializer) {
        actual.after = primitive(initializer.event.payload?.after);
        actual.sources = sourcesOf(initializer.event).map((source, index) => sourceObservation(source, index, initializer.event));
      }
    }
    if (Number.isInteger(p.insertIndex)) {
      if (Number(p.afterSize) > Number(p.beforeSize)) actual.insertIndex = p.insertIndex;
      else actual.removeIndex = p.insertIndex;
    }
    if (['assign', 'write', 'sequence-operation'].includes(event.type)) {
      actual.semanticEventCount = atLine.filter(candidate =>
        ['assign', 'write', 'sequence-operation'].includes(candidate.event.type)).length;
      const beforeValues = beforeNamed(), afterValues = plainState(frame);
      actual.unchanged = Object.fromEntries(Object.entries(afterValues)
        .filter(([name, value]) => own(beforeValues, name) && same(beforeValues[name], value)));
    }
    // A syntactically present short-circuit RHS is only classified as not
    // executed when no corresponding write/comparison event actually occurred.
    const shortCircuit = located.source.match(/\b(false|true)\s*(&&|\|\|)\s*\(\s*(\+\+|--)([A-Za-z_]\w*)\s*([<>!=]=?)\s*(\d+)\s*\)/);
    if (shortCircuit) {
      const [, , , update, name, operator, literal] = shortCircuit;
      const executed = atLine.some(candidate => candidate.event.type === 'write'
        || candidate.event.type === 'compare');
      actual.notExecuted = executed ? [] : [update + name, name + ' ' + operator + ' ' + literal];
    }
    if (event.type === 'call') {
      actual.callee = event.callee;
      const calleeActivation = event.calleeActivationId;
      const entry = all.find(candidate => candidate.event.type === 'function-enter'
        && candidate.event.recursionActivationId === calleeActivation);
      if (entry) {
        const parameters = all.filter(candidate => candidate.event.type === 'declare'
          && candidate.event.recursionActivationId === calleeActivation
          && Number(candidate.event.line) === Number(entry.event.line));
        actual.arguments = parameters.map(candidate => primitive(candidate.event.payload?.value));
      }
    }
    if (event.type === 'declare' && activation(event)) {
      actual.activation = activation(event);
      const entry = all.find(candidate => candidate.event.type === 'function-enter'
        && candidate.event.recursionActivationId === event.recursionActivationId);
      if (entry) actual.argumentValues = Object.fromEntries(all.filter(candidate =>
        candidate.event.type === 'declare'
        && candidate.event.recursionActivationId === event.recursionActivationId
        && Number(candidate.event.line) === Number(entry.event.line))
        .map(candidate => [variableName(targetOf(candidate.event)?.variableId), primitive(candidate.event.payload?.value)]));
    }
    if (['function-enter', 'function-exit', 'return'].includes(event.type)) actual.activation = activation(event);
    if (event.type === 'return') {
      const completion = all.find(candidate => candidate.event.type === 'return-complete'
        && candidate.event.returnEventId === event.id);
      if (completion) actual.returnValue = primitive(completion.event.payload?.value);
    }
    if (['continue', 'break'].includes(event.type)) {
      actual.when = beforeNamed();
      Object.assign(actual, beforeNamed());
    }
    if (event.type === 'output') {
      const output = compileOutput?.output ?? compileOutput?.stdout ?? trace.compileOutput?.output ?? trace.compileOutput;
      if (typeof output === 'string') actual.output = output.replace(/\r\n?/g, '\n');
      else addUnsupported('output', 'Output text is not recorded in this Trace; pass the actual compileOutput metadata.');
    }
    if (event.type === 'visual-exit') {
      actual.before = valueFor(target);
      actual.after = valueFor(target);
    }
    // Independent arithmetic for the small derived-pointer fixture. Only a
    // visible binding with an actual scalar source and literal offset qualifies;
    // unrecognized expressions remain unobserved rather than being guessed.
    const derived = (frame?.bindings || []).find(binding => binding.explicitPointer
      && binding.sourceVariableId === target?.variableId
      && compact(binding.indexExpression) !== variableName(target?.variableId));
    if (derived) {
      const match = compact(derived.indexExpression).match(/^([A-Za-z_]\w*)([+-])(\d+)$/);
      const current = primitive(frame?.state?.[derived.sourceVariableId]?.data);
      if (match && Number.isFinite(current)) {
        actual.derivedExpression = compact(derived.indexExpression);
        actual.derivedValue = match[2] === '+' ? current + Number(match[3]) : current - Number(match[3]);
      }
    }
    if (/\b(?:std::)?move\s*\(/.test(event.expression || '')) {
      const sourceRead = atLine.filter(candidate => candidate.event.type === 'read')
        .flatMap(candidate => candidate.event.targets || [])[0];
      const sourceAfter = sourceRead && frame.state?.[sourceRead.variableId];
      if (sourceRead) actual.sources = [{
        expression: expression(sourceRead),
        value: own(p, 'source') ? primitive(p.source) : valueFor(sourceRead)
      }];
      if (sourceAfter) {
        actual.sourceAfter = primitive(sourceAfter.data);
        actual.sourceStatePolicy = 'actual-runtime-state';
      }
    }
  }
  const checked = item.assertionKind === 'control'
    ? { pass: false, failures: [] }
    : verifyEvent(actual, item.expected || {});
  if (event && ['assign', 'write'].includes(event.type) && own(event.payload, 'after')) {
    const target = targetOf(event);
    const laterMutation = all.some(candidate => candidate.frameIndex === frameIndex
      && Number(candidate.event.order) > Number(event.order)
      && ['assign', 'write', 'sequence-operation', 'swap'].includes(candidate.event.type)
      && (candidate.event.targets || []).some(other => other.variableId === target?.variableId));
    const captured = valueFor(target, true);
    const committed = primitive(event.payload.after);
    if (!laterMutation && captured !== undefined && !same(captured, committed)) {
      checked.failures.push({ path: 'state.after', expected: committed, actual: captured,
        reason: 'event-payload-disagrees-with-captured-state' });
      checked.pass = false;
    }
  }
  for (const failure of checked.failures) if (failure.actual === undefined) {
    addUnsupported(failure.path, 'The required field was not observable from the available event/state metadata.');
  }
  return { actual, events: relevant.map(record => record.event), event: event || null,
    frameIndex, sourceLine: located.sourceLine,
    data: { pass: checked.pass && unsupported.length === 0, failures: checked.failures, unsupported } };
}
module.exports = { observeCase };
