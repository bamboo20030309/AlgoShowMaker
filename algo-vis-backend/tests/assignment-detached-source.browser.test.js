const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { chromium } = require('playwright');
const { TWEEN_BUILD } = require('./helpers/builds');

test('detached assignment copies retain appearance and commit only after movement', { timeout: 120000 }, async () => {
  const root = path.resolve(__dirname, '..');
  const port = await new Promise(resolve => {
    const socket = net.createServer();
    socket.listen(0, '127.0.0.1', () => {
      const port = socket.address().port;
      socket.close(() => resolve(port));
    });
  });
  const server = spawn(process.execPath, ['server.js'], {
    cwd: root, windowsHide: true, stdio: 'ignore',
    env: { ...process.env, PORT: String(port), ASM_REGRESSION: '1', JWT_SECRET: randomBytes(32).toString('hex') }
  });
  let browser;
  try {
    const base = `http://127.0.0.1:${port}`;
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(base)).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`${base}/algorithm.html`);
    await page.waitForFunction(build => window.ASMTraceFrameTween?.build === build && window.ace, TWEEN_BUILD);
    await page.waitForTimeout(800);

    async function run(code, rate, noCapture = false, roundtrip = false) {
      await page.evaluate(code => {
        ace.edit('editor').setValue(code, -1);
        document.getElementById('inputArea').value = '4';
      }, code);
      await page.locator('#runBtn').click();
      await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
        && ASMTracePlayer.getDocument()?.frames.length >= 2, null, { timeout: 45000 });
      return page.evaluate(async ({ rate, noCapture, roundtrip }) => {
        let trace = ASMTracePlayer.getDocument();
        if (roundtrip) {
          // Saved traces have no geometry cache; rebuild it from the loaded scene.
          const saved = JSON.stringify(trace);
          trace = ASMTracePlayer.apply(JSON.parse(saved));
        }
        const index = trace.frames.findIndex(frame => frame.events.some(event => event.source?.text === 'nextL[j]=L[j+1]'
          || event.source?.text === 'b[0]=a[1]'));
        const frame = trace.frames[index];
        const assignments = frame.events.filter(event => event.source?.text === 'nextL[j]=L[j+1]'
          || event.source?.text === 'nextR[j]=R[j-1]'
          || /^b\[\d\]=a\[1\]$/.test(event.source?.text || ''));
        await ASMTracePlayer.renderStable(index - 1);
        // LOD text is restored asynchronously after the stable camera settles.
        await new Promise(resolve => setTimeout(resolve, 200));
        const geometryCapture = ASMTraceFrameTween.captureAssignmentSourceGeometry;
        if (noCapture) ASMTraceFrameTween.captureAssignmentSourceGeometry = () => {};
        const firstSource = assignments[0].targets.find(target => target.role === 'source');
        const sourceKey = `${firstSource.variableId}#${firstSource.resolvedIndex}`;
        const oldFill = document.querySelector(`[data-trace-object-key="${CSS.escape(sourceKey)}"] rect`)?.getAttribute('fill');
        window.asmGetAnimationPlaybackRate = () => rate;
        const seen = {};
        const paints = [];
        const nextRId = Object.keys(trace.variables).find(id => trace.variables[id].name === 'nextR');
        let finished = false;
        const playback = CodeScript.next().finally(() => { finished = true; });
        while (!finished) {
          await new Promise(resolve => requestAnimationFrame(resolve));
          const active = document.getElementById('asm-trace-root')?.dataset.traceActiveEventId;
          const nextRCell = nextRId && document.querySelector(`[data-trace-object-key="${CSS.escape(`${nextRId}#1`)}"]`);
          const nextRRect = nextRCell?.querySelector('rect');
          if (nextRRect) paints.push({ value: nextRCell.querySelector('text')?.textContent,
            fill: nextRRect.getAttribute('fill'), presented: getComputedStyle(nextRRect).fill });
          const event = assignments.find(item => item.id === active);
          if (!event) continue;
          const target = event.targets.find(target => target.role === 'target');
          const targetKey = `${target.variableId}#${target.resolvedIndex}`;
          const transfers = [...document.querySelectorAll('.asm-trace-assign-transfer')];
          const node = document.querySelector(`[data-trace-object-key="${CSS.escape(targetKey)}"]`);
          const record = seen[event.id] ||= { transforms: [], texts: [], targetValues: [], targetFills: [], fills: [], sourceFills: [], hasCells: [], targetPaintSamples: [] };
          record.targetPaintSamples.push({ fill: node?.querySelector('rect')?.getAttribute('fill'), hasCopy: transfers.length > 0 });
          for (const transfer of transfers) {
            const opacity = Number(transfer.getAttribute('opacity'));
            if (!(opacity > 0.2)) continue;
            record.transforms.push(transfer.getAttribute('transform'));
            record.texts.push(transfer.querySelector('text')?.textContent);
            record.fills.push(transfer.querySelector('rect')?.getAttribute('fill'));
            record.hasCells.push(Boolean(transfer.querySelector('rect')));
            const sourceKey = transfer.dataset.traceTransferSourceKey;
            record.sourceFills.push(document.querySelector(`[data-trace-object-key="${CSS.escape(sourceKey)}"] rect`)?.getAttribute('fill'));
            record.targetValues.push(node?.querySelector('text')?.textContent);
            record.targetFills.push(node?.querySelector('rect')?.getAttribute('fill'));
          }
        }
        await playback;
        ASMTraceFrameTween.captureAssignmentSourceGeometry = geometryCapture;
        return {
          output: document.getElementById('outputArea').textContent,
          oldFill, assignments: assignments.map(event => ({ id: event.id, text: event.source.text,
            source: event.payload.source?.value, before: event.payload.before?.value, after: event.payload.after?.value,
            disabled: event.autoAnimationDisabled, reason: event.autoAnimationUnavailableReason })),
          seen, paints,
          final: assignments.map(event => { const target = event.targets.find(t => t.role === 'target');
            return document.querySelector(`[data-trace-object-key="${CSS.escape(`${target.variableId}#${target.resolvedIndex}`)}"] text`)?.textContent; })
        };
      }, { rate, noCapture, roundtrip });
    }

    const consecutive = `#include <bits/stdc++.h>
using namespace std;
int main(){
 vector<int> a={0,1}, b={9,9};
 // @frame a,b
 // @style a background AV_red
 a[1]=7;
 b[0]=a[1];
 a[1]=8;
 b[1]=a[1];
 // @frame a,b
 // @style a background AV_green
}`;
    for (const rate of [2, 4]) {
      const result = await run(consecutive, rate, false, rate === 4);
      assert.equal(result.assignments.length, 2);
      assert.equal(result.oldFill, 'rgba(239, 154, 154, 0.6)');
      for (const event of result.assignments) {
        const seen = result.seen[event.id];
        assert.ok(seen?.texts.length, `${event.text} needs an actual flying cell`);
        assert.ok(new Set(seen.transforms).size > 2, 'transfer must move rather than remain stationary');
        assert.deepEqual([...new Set(seen.texts)], [String(event.source)], 'copy the event source, not the previous/final value');
        // The new frame explicitly colors the visible source green. The copy
        // must match that source, rather than retain the departed red view.
        assert.ok(seen.sourceFills.every(fill => fill === 'rgba(165, 214, 167, 0.6)'));
        assert.deepEqual(seen.fills, seen.sourceFills, 'copy the currently visible source appearance');
        assert.ok(seen.targetValues.includes(String(event.before)), 'destination must retain its old value during flight');
        const firstAfter = seen.targetValues.indexOf(String(event.after));
        assert.ok(firstAfter < 0 || firstAfter > 0, 'result must not appear from the start');
        if (firstAfter >= 0) assert.equal(seen.transforms[firstAfter], seen.transforms.at(-1),
          'destination changes only after the flying cell reaches its final position');
      }
      assert.deepEqual(result.final, ['7', '8']);
    }

    const zeros = `#include <bits/stdc++.h>
using namespace std;
int main(){
 vector<int> L(4,0);
 // @frame L
 vector<int> nextL(4,0);
 for(int j=0;j<3;j++) nextL[j]=L[j+1];
 // @frame L,nextL
}`;
    for (const noCapture of [false, true]) {
      const result = await run(zeros, 4, noCapture);
      assert.equal(result.assignments.length, 3);
      for (const event of result.assignments) {
        assert.ok(result.seen[event.id]?.texts.includes('0'), '0 -> 0 still copies a full cell into the new object');
        assert.ok(new Set(result.seen[event.id].transforms).size > 2);
      }
    }

    const departing = await run(`#include <bits/stdc++.h>
using namespace std;
int main(){
 vector<int> a={0,5}, b={9};
 // @frame a,b
 b[0]=a[1];
 // @frame b
}`, 4);
    assert.equal(departing.assignments.length, 1);
    // E12: a visible destination still receives a numeric assignment when its
    // source is hidden. Do not revive the source's historical cell rectangle.
    assert.equal(departing.assignments[0].disabled, false);
    assert.equal(departing.assignments[0].reason ?? '', '');
    const hiddenSource = departing.seen[departing.assignments[0].id];
    assert.ok(hiddenSource?.texts.length);
    assert.ok(hiddenSource.texts.every(text => text === '5'));
    assert.ok(hiddenSource.hasCells.every(value => value === false));
    assert.deepEqual(departing.final, ['5']);

    const customDisplay = await run(`#include <bits/stdc++.h>
using namespace std;
int main(){
 vector<int> a={0,1}, b={0};
 // @frame a,b
 // @object b with labels(none), display("x")
 // @style b background AV_red when value == 1
 b[0]=a[1];
 // @frame a,b
 // @object b with labels(none), display("x")
 // @style b background AV_red when value == 1
}`, 4);
    const customFlight = customDisplay.seen[customDisplay.assignments[0].id];
    assert.ok(customFlight?.transforms.length);
    assert.deepEqual(customDisplay.final, ['x'], 'custom display must not be replaced with raw numeric text');
    for (let i = 0; i < customFlight.transforms.length; i++) {
      if (customFlight.transforms[i] !== customFlight.transforms.at(-1)) {
        assert.match(customFlight.targetFills[i], /^(#fff(?:fff)?|white|rgb\(255, 255, 255\))$/);
      }
    }
    // A completed transfer is removed in the same tick as the commit. Observe
    // the target after that handoff rather than requiring a stale flying copy.
    assert.ok(customFlight.targetPaintSamples.some(sample => !sample.hasCopy && sample.fill?.includes('239, 154, 154')),
      'value-dependent paint changes on commit even when display text stays x');

    // Reproduce the user's recursion scene, including disabled declarations.
    const source = fs.readFileSync(path.join(root, 'algorithm_sample/Backtracking/8queen-array-teaching.cpp'), 'utf8');
    const recursive = await run(source, 4);
    assert.match(recursive.output, /Total Solutions: 2/);
    assert.ok(recursive.paints.some(item => item.value === '0'));
    assert.ok(recursive.paints.some(item => item.value === '1'));
    for (const paint of recursive.paints.filter(item => item.value === '0')) {
      assert.match(paint.fill, /^(#fff(?:fff)?|white|rgb\(255, 255, 255\))$/,
        'nextR[1] stays white until its numeric assignment commits');
      assert.equal(paint.presented, 'rgb(255, 255, 255)', 'actual SVG paint must not turn red early');
    }
    assert.ok(recursive.paints.some(item => item.value === '1' && item.fill.includes('239, 154, 154')));
    assert.ok(recursive.paints.some(item => item.value === '1' && item.presented !== item.fill),
      'color must still transition rather than snap on commit');
    assert.equal(recursive.assignments.length, 6);
    for (const event of recursive.assignments) {
      assert.ok(recursive.seen[event.id]?.texts.includes('0'));
      assert.ok(new Set(recursive.seen[event.id].transforms).size > 2, `${event.text} must visibly move`);
    }
    console.log('Array queens N=4: 2 solutions; all six L/R copies have moving SVG transforms.');
    assert.deepEqual(errors, []);
    console.log('Verified visible source appearance, sequential values 7/8, landing commits, two speeds, new targets, hidden-source numeric transfers, geometry fallback, and recursive zero copies.');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
});
