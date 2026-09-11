const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { compile } = require('./helpers/compile');
const provenance = require('../public/trace-provenance');
const fixture = require('./fixtures/sorting.json');
for (const name of ['bubble', 'insertion']) {
  test(`${name}: fixed input, sorted state, ordered events and generation identity`, async () => {
    const code = fs.readFileSync(path.join(__dirname, 'fixtures', name + '.cpp'), 'utf8');
    const { trace, window } = await compile(code, fixture.input);
    const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
    const values = Array.from(trace.frames.at(-1).state[arr].data.items, item => Number(item.value));
    assert.deepEqual(values, fixture.sorted);
    assert.equal(provenance.status(trace, code, fixture.input).kind, 'current',
      'Restart an older development server, or use npm run regression (isolated fresh server).');
    const events = trace.frames.flatMap(frame => frame.events);
    if (name === 'bubble') {
      for (const expression of [/i\s*=\s*0/, /j\s*=\s*0/]) {
        const initializer = events.find(event => event.type === 'assign'
          && expression.test(event.expression || event.signature || ''));
        assert.ok(initializer, `for initializer ${expression} must be traced`);
        assert.equal(initializer.forInitializer, true,
          'for declaration initialization is explicitly position-only');
        assert.ok(initializer.source?.contexts?.some(context => context.type === 'ForStatement'),
          'for initializer must retain its AST context');
        assert.equal(window.ASMTraceEvents.showInspector(initializer, trace), true,
          'for initializer must remain visible in the Studio right inspector');
        assert.match(initializer.source?.text || '', /^[ij]\s*=\s*0$/,
          'initialized assignment source excludes its declaration type');
        const targetId = initializer.targets.find(target => target.role === 'target')?.variableId;
        const declaration = events.find(event => event.type === 'declare'
          && event.targets.some(target => target.variableId === targetId));
        assert.ok(declaration);
        assert.ok(declaration.lifetimeIdentity);
        assert.equal(initializer.targets.find(target => target.role === 'target')?.lifetimeIdentity,
          declaration.lifetimeIdentity,
          'declaration and initialized assignment share one visual lifetime');
        assert.match(declaration.source?.text || '', /^int\s+[ij]$/,
          'declaration source contains only the type and variable name');
      }
      const forConditions = events.filter(event => (
        event.type === 'condition' && event.conditionKind === 'ForStatement'
      ));
      assert.ok(forConditions.some(event => /i\s*</.test(event.expression || event.signature || '')));
      assert.ok(forConditions.some(event => /j\s*</.test(event.expression || event.signature || '')));
      assert.ok(forConditions.every(event => !window.ASMTraceEvents.showInspector(event, trace)),
        'whole conditions remain internal and never duplicate their comparisons in the inspector');
      assert.ok(events.some(e => e.type === 'write' && e.update && /j\+\+/.test(e.expression || e.signature || '')));
      assert.ok(events.some(e => e.type === 'swap'));
      assert.ok(trace.snapshots.length > 0, '@keep last must retain rounds');
      const jDeclarations = events.filter(event => event.type === 'declare'
        && event.name === 'j');
      assert.equal(new Set(jDeclarations.map(event => event.lifetimeIdentity)).size,
        jDeclarations.length,
        'each loop-local j declaration receives a distinct lifetime even when the stack address is reused');
      jDeclarations.slice(0, -1).forEach(declaration => {
        assert.ok(events.some(event => event.type === 'scope-exit'
          && event.name === 'j'
          && event.lifetimeIdentity === declaration.lifetimeIdentity),
        'each completed j lifetime has a matching scope-exit event');
      });
      const firstKeptFrame = trace.frames.findIndex(frame => (frame.snapshotIds || []).length > 0);
      assert.ok(firstKeptFrame > 0, 'the first completed round must introduce a retained frame');
      const outgoing = trace.frames[firstKeptFrame - 1];
      const incoming = trace.frames[firstKeptFrame];
      assert.ok(outgoing.events.some(event => (
        event.type === 'write' && /j\+\+/.test(event.expression || event.signature || '')
      )), 'the terminal j++ must play on the outgoing frame before @keep last');
      assert.ok(outgoing.events.some(event => (
        event.type === 'condition' && event.conditionKind === 'ForStatement' && event.result === false
      )), 'the terminal false loop condition must remain beside its outgoing j++');
      assert.ok(!incoming.events.some(event => (
        event.type === 'write' && /j\+\+/.test(event.expression || event.signature || '')
          && Number(event.order) < Math.min(...incoming.events
            .filter(item => /j\s*=\s*0/.test(item.expression || item.signature || ''))
            .map(item => Number(item.order)))
      )), 'the new retained-frame scene must not replay the old terminal j++ before j = 0');
      assert.ok(incoming.events.some(event => (
        event.type === 'assign' && /j\s*=\s*0/.test(event.expression || event.signature || '')
      )), 'the next round must still initialize j on the incoming frame');
      const firstSnapshot = trace.snapshots.find(snapshot => (
        snapshot.id === incoming.snapshotIds[0]
      ));
      const terminalIncrement = outgoing.events.find(event => (
        event.loopBoundary === true && event.type === 'write' && /j\+\+/.test(event.expression || event.signature || '')
      ));
      const jTarget = terminalIncrement.targets.find(target => target.role === 'target');
      assert.equal(firstSnapshot.frame.state[jTarget.variableId], undefined,
        '@keep last does not serialize a pointer whose lifetime ended before keep');
      assert.ok(!(firstSnapshot.frame.bindings || []).some(binding => (
        binding.sourceVariableId === jTarget.variableId
        || (binding.sourceVariableIds || []).includes(jTarget.variableId)
      )), 'bindings for the exited pointer are removed from the retained frame');
      trace.studio.eventSettings ||= {};
      trace.studio.eventSettings.autoLoopBoundaryEnabled = true;
      window.ASMTraceEvents.applyEnabledStates(trace);
      const enabledSnapshotFrame = window.ASMTraceEvents.keepSnapshotFrame(trace, firstSnapshot);
      assert.equal(enabledSnapshotFrame.state[jTarget.variableId], undefined,
        'enabling boundary animation never resurrects an exited pointer in @keep last');
      trace.studio.eventSettings.autoLoopBoundaryEnabled = false;
      window.ASMTraceEvents.applyEnabledStates(trace);
      const disabledSnapshotFrame = window.ASMTraceEvents.keepSnapshotFrame(trace, firstSnapshot);
      assert.equal(disabledSnapshotFrame.state[jTarget.variableId], undefined,
        'turning boundary animation off keeps the exited pointer absent');
    } else {
      assert.ok(events.some(e => e.type === 'write' && e.update));
      assert.ok(events.some(e => e.type === 'assign' && e.targets.some(t => t.resolvedIndex === 0)));
      const shift = trace.frames.find(f => f.events.some(e => e.type === 'assign') &&
        f.events.some(e => e.type === 'write' && e.update));
      assert.ok(shift, 'shift and decrement captured in one frame');
    }
  });
}
