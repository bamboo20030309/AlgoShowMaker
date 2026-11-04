'use strict';
// Actual SVG observations at rAF ticks. Expected timings/values are supplied
// by the handwritten manifest, never generated from a playback plan.
async function runVisualCase({ page, trace, item, observation }) {
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const result = await page.evaluate(async ({ trace, item, frameIndex, sourceLine }) => {
    trace = ASMTraceModel.normalizeTraceDocument(trace);
    trace.studio ||= {}; trace.studio.eventSettings ||= {};
    // These contracts explicitly exercise read emphasis, which is off by default.
    trace.studio.eventSettings.readHighlightEnabled = true;
    trace.studio.eventSettings.gapMs = 0;
    let frame = trace.frames[frameIndex], previous = trace.frames[Math.max(0, frameIndex - 1)];
    if (!frame) throw Error('Case has no frame');
    const types = item.assertionKind === 'read' ? ['assign', 'write']
      : (item.eventTypes || []).map(t => ({ sequence: 'sequence-operation', assignment: 'assign' }[t] || t));
    const selected = frame.events.filter(e => Number(e.line) === sourceLine && types.includes(e.type));
    const selectedIds = new Set(selected.map(e => e.id));
    for (const event of frame.events) {
      event.enabled = selectedIds.has(event.id);
      if (event.enabled) { event.autoAnimationDisabled = false; event.animate = true; }
    }
    trace = asmApplyTraceDocument(trace);
    frame = trace.frames[frameIndex]; previous = trace.frames[Math.max(0, frameIndex - 1)];
    // Normalization can synthesize unrelated presentation exits. This probe
    // measures only the case's events; full navigation has separate scenarios.
    frame.events = frame.events.filter(e => selectedIds.has(e.id) || e.type === 'read');
    ASMTraceFrameTween.cancel();
    ASMTraceRenderers.renderFrame(trace, previous, null, { animatePositions: false, animateEvents: false });
    window.asmGetAnimationPlaybackRate = () => 1;
    window.ASMTraceDebugRecorder = { isRecording: () => true };
    const sourceEvents = [];
    const listener = e => {
      if (!selectedIds.has(e.detail.event?.id)) return;
      sourceEvents.push({ phase: e.detail.phase, type: e.detail.event.type, id: e.detail.event.id,
        slot: e.detail.slot ? { start: e.detail.slot.start, duration: e.detail.slot.duration,
          end: e.detail.slot.end, animation: e.detail.slot.animation,
          commit: e.detail.slot.actionPlan?.commitMs } : null });
    };
    window.addEventListener('asm:trace-active-event', listener);
    const samples = [];
    let settled = false;
    const transition = ASMTraceRenderers.renderFrame(trace, frame, previous,
      { direction: 1, animatePositions: true, animateEvents: true }).finally(() => { settled = true; });
    const snapshot = () => {
      const svg = document.getElementById('asm-trace-root') || document.getElementById('arraySvg');
      return {
        elapsed: Number(svg?.dataset.traceDebugElapsedMs || 0),
        active: svg?.dataset.traceActiveEventId || '',
        transfers: [...document.querySelectorAll('.asm-trace-assign-transfer')].map(node => ({
          text: [...node.querySelectorAll('text')].map(t => t.textContent), rects: node.querySelectorAll('rect:not(.asm-trace-compare-highlight)').length,
          transform: node.getAttribute('transform'), valueOnly: node.classList.contains('asm-trace-assign-transfer-value') })),
        falling: [...document.querySelectorAll('.asm-trace-assign-falling-value, .asm-trace-assign-literal-value')].map(node => ({text:node.textContent,y:node.getAttribute('y'),transform:node.getAttribute('transform')})),
        reads: [...document.querySelectorAll('.asm-trace-read-highlight')].map(node => ({
          source: node.dataset.traceReadSource, owner: node.dataset.traceReadOwner,
          animation: getComputedStyle(node).animationName, opacity: node.getAttribute('opacity') })),
        relations: [...document.querySelectorAll('.asm-trace-compare-operator text')].map(node => node.textContent),
        selection: document.querySelector('.asm-trace-selection-label')?.textContent || '',
        snapshots: [...document.querySelectorAll('[data-trace-snapshot]')].map(node => ({
          id: node.dataset.traceSnapshot,
          values: [...node.querySelectorAll('[data-trace-index]')].map(cell =>
            [...cell.querySelectorAll('text:not([data-trace-content-role="index"])')].map(t=>t.textContent)),
          bounds: { x:node.getBoundingClientRect().x,y:node.getBoundingClientRect().y }
        })),
        values: [...document.querySelectorAll('[data-trace-object-key]')].filter(node => node.querySelector(':scope > rect'))
          .map(node => {
            const shape=node.querySelector(':scope > rect');
            const box=shape.getBBox(),matrix=shape.getCTM();
            const point=new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(matrix);
            const variable=Object.keys(trace.variables).find(id=>node.dataset.traceObjectKey.endsWith(id+'#0')
              || node.dataset.traceObjectKey.startsWith(id+'#'));
            const owner=node.closest('[data-trace-variable]') || (variable&&document.querySelector(`[data-trace-variable="${CSS.escape(variable)}"]`));
            const relative=owner?.getCTM()?.inverse().multiply(matrix);
            const local=relative&&new DOMPoint(box.x+box.width/2,box.y+box.height/2).matrixTransform(relative);
            return {key:node.dataset.traceObjectKey, text:[...node.querySelectorAll('text:not([data-trace-content-role="index"])')].map(t=>t.textContent),
              transform:node.getAttribute('transform'),x:point.x,y:point.y,localY:local?.y,
              snapshot:Boolean(node.closest('[data-trace-snapshot]')),fill:node.querySelector(':scope > rect')?.getAttribute('fill')};
          })
      };
    };
    samples.push(snapshot());
    for (let ticks = 0; !settled && ticks < 600; ticks++) {
      await new Promise(resolve => requestAnimationFrame(resolve)); samples.push(snapshot());
    }
    await transition;
    window.removeEventListener('asm:trace-active-event', listener);
    const final = snapshot();
    return { samples, final, sourceEvents, selected: selected.map(e=>({id:e.id,type:e.type,enabled:e.enabled,autoAnimationDisabled:e.autoAnimationDisabled})),
      remaining: document.querySelectorAll('.asm-trace-assign-transfer,.asm-trace-assign-falling-value,.asm-trace-read-highlight,.asm-trace-read-source-ghost,.asm-trace-selection-label,.asm-trace-condition-label').length };
  }, { trace, item, frameIndex: observation.frameIndex, sourceLine: observation.sourceLine });
  const failures = [], require = (condition, label, actual) => { if (!condition) failures.push({ label, actual }); };
  require(errors.length === 0, 'no-browser-errors', errors);
  require(result.remaining === 0, 'temporary-effects-cleaned', result.remaining);
  const starts = result.sourceEvents.filter(e => e.phase === 'start' && e.slot);
  const activeSamples = result.samples.filter(sample => starts.some(e => e.id === sample.active));
  const transfers = activeSamples.flatMap(sample => sample.transfers);
  const visual = item.visual || {}, timing = item.timing || {};
  const transfer = visual.transfer;
  if (transfer === 'cell') require(transfers.some(t => t.rects > 0 && !t.valueOnly), 'whole-cell-copy-visible', transfers);
  if (transfer === 'value') require(transfers.some(t => t.valueOnly || t.rects === 0) || activeSamples.some(s=>s.falling.length), 'value-transfer-visible', transfers);
  if (transfer === 'none') require(transfers.length === 0, 'no-transfer', transfers);
  if (visual.blink === false) require(activeSamples.flatMap(s=>s.reads).every(r=>!r.animation || r.animation === 'none'), 'non-blinking-read', result.samples);
  if (visual.readHighlight?.length) require(activeSamples.some(s=>s.reads.length > 0), 'read-emphasis-visible', result.samples);
  const swapping = (item.eventTypes || []).includes('swap');
  if (Number.isInteger(visual.parallelTransfers) && !swapping) require(activeSamples.some(s=>s.transfers.length === visual.parallelTransfers),
    'parallel-source-count', Math.max(0,...activeSamples.map(s=>s.transfers.length)));
  if (Number.isInteger(visual.readHighlightCount)) require(activeSamples.some(s=>s.reads.length === visual.readHighlightCount),
    'deduplicated-read-highlight', activeSamples.map(s=>s.reads.length));
  if (item.expected?.relation) require(activeSamples.some(s=>s.relations.includes(item.expected.relation)), 'actual-relation-symbol', activeSamples.map(s=>s.relations));
  if (item.expected?.selectionOperation) require(activeSamples.some(s=>s.selection === item.expected.selectionOperation), 'selection-stage-before-copy', activeSamples.map(s=>s.selection));
  const cell = (sample,name) => {
    const match=String(name).match(/^([A-Za-z_]\w*)(?:\[(\d+)\])?$/);
    if(!match)return null;
    const id=Object.keys(trace.variables).find(id=>trace.variables[id].name===match[1]);
    return sample.values.find(v=>!v.snapshot && v.key.endsWith(id+'#'+(match[2]||0)));
  };
  if (swapping && Number.isInteger(visual.parallelTransfers)) {
    const names=(observation.event?.targets||[]).slice(0,2).map(t=>t.expression);
    const first=activeSamples[0];
    const moving=names.filter(name=>{
      const start=first&&cell(first,name);
      return start&&activeSamples.some(s=>{const at=cell(s,name);return at&&Math.hypot(at.x-start.x,at.y-start.y)>1;});
    });
    require(moving.length===visual.parallelTransfers,'parallel-swap-cell-motion',{names,moving});
  }
  if (item.expected?.target && !item.id.startsWith('P') && item.expected.targetVisible !== false
    && Object.hasOwn(item.expected, 'after')) {
    const answer = item.expected.after;
    const names = Array.isArray(answer) ? answer.map((_,i)=>`${item.expected.target}[${i}]`) : [item.expected.target];
    const actual = names.map(name=>cell(result.final,name)?.text?.[0]);
    require(JSON.stringify(actual) === JSON.stringify((Array.isArray(answer)?answer:[answer]).map(String)),
      'final-svg-values-match-handwritten-answer', {expected:answer,actual});
  }
  if (visual.verticalMotion === 0) {
    const sourceNames=(observation.event?.targets||[]).slice(0,2).map(t=>t.expression);
    for(const name of sourceNames){
      const first=cell(result.samples[0],name);
      require(Boolean(first),'compare-source-geometry',name);
      if(first)require(activeSamples.every(s=>{const c=cell(s,name);return c&&Number.isFinite(c.localY)&&Math.abs(c.localY-first.localY)<0.5;}),
        'equality-has-no-vertical-motion',name);
    }
  }
  const total = starts.reduce((sum,e)=>sum+e.slot.duration,0);
  if (Number.isFinite(timing.durationMs)) require(total === timing.durationMs, 'fixed-1x-duration', {expected:timing.durationMs,actual:total,starts});
  if (Number.isFinite(timing.commitMs)) {
    const assignment = starts.find(e=>e.type==='assign'||e.type==='write');
    if (assignment) require(assignment.slot.commit === timing.commitMs, 'fixed-commit-time', assignment);
  }
  if (timing.addedDurationMs === 0) require(starts.every(e=>e.type !== 'read'), 'read-adds-no-slot', starts);
  // Every requested case must have concrete observations. Layout and special
  // control assertions are evaluated by their own adapters, never auto-passed.
  if (item.assertionKind === 'layout') {
    const snapshots = result.final.snapshots.filter(s=>s.values.length);
    require(snapshots.length > 0, 'retained-snapshot-visible', snapshots);
    const expected = item.expected.snapshots || [item.expected.snapshot];
    for (let i=0;i<expected.length;i++) require(snapshots.some(s=>JSON.stringify(s.values.flat().map(Number))===JSON.stringify(expected[i])),
      'snapshot-retains-fixed-values', {expected:expected[i],actual:snapshots});
  }
  return { pass: failures.length === 0, failures, ...result };
}
module.exports = { runVisualCase };
