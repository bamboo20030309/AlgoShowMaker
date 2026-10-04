const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('n=5 preserves P=11111 until XOR completes',
  { timeout: 60000 }, async () => {
    const code = fs.readFileSync(path.join(__dirname,
      '../algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.ace);
      await page.waitForTimeout(1000);
      await page.evaluate(source => {
        ace.edit('editor').setValue(source, -1);
        document.getElementById('inputArea').value = '5';
      }, code);
      await page.locator('#runBtn').click();
      await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
        && ASMTracePlayer.getDocument()?.frames.length > 4, { timeout: 30000 });
      const results = await page.evaluate(async () => {
        const doc = ASMTracePlayer.getDocument(), results = [];
        const index = doc.frames.findIndex(frame => frame.events.some(event =>
          event.bitwise?.operator === '^' && event.source?.text === 'P ^= p'));
        const event = doc.frames[index].events.find(event => event.source?.text === 'P ^= p');
        const visibleBits = () => {
          const overlay = [...document.querySelectorAll('[data-trace-bitwise]')]
            .find(node => node.dataset.traceBitwise === event.id);
          const host = overlay?.querySelector('[data-trace-bitwise-base]')
            || document.querySelector('#asm-trace-root [data-trace-object-key="mask_union"]');
          return [...(host?.querySelectorAll('text') || [])]
            .filter(text => !text.closest('[data-trace-index-label]'))
            .map(text => text.textContent).filter(text => /^[01]$/.test(text)).join('');
        };
        for (const rate of [1, 2]) {
          window.asmGetAnimationPlaybackRate = () => rate;
          await ASMTracePlayer.renderStable(index - 1);
          const initial = visibleBits();
          let done = false, xorFinished = false, xorStarted = false;
          const onEvent = e => {
            if (e.detail?.event?.id === event.id && e.detail.phase === 'start') xorStarted = true;
            if (e.detail?.event?.id === event.id && e.detail.phase === 'end') xorFinished = true;
          };
          addEventListener('asm:trace-active-event', onEvent);
          const samples = [];
          let prematureIncoming = false;
          const play = Promise.resolve(CodeScript.next()).finally(() => { done = true; });
          const incomingVisible = () => Number(document.querySelector(
            `[data-trace-bitwise="${event.id}"] [data-trace-bitwise-motion]`)?.style.opacity || 0) > 0;
          if (!xorStarted && incomingVisible()) prematureIncoming = true;
          samples.push({ bits: visibleBits(), xorFinished, active: document.getElementById('asm-trace-root').dataset.traceActiveEventId || '' });
          for (let tick = 0; tick < 1000 && !done; tick++) {
            await new Promise(requestAnimationFrame);
            if (!xorStarted && incomingVisible()) prematureIncoming = true;
            samples.push({ bits: visibleBits(), xorFinished, active: document.getElementById('asm-trace-root')?.dataset.traceActiveEventId || '' });
          }
          await play;
          removeEventListener('asm:trace-active-event', onEvent);
          const firstResult = samples.findIndex(sample => sample.bits === '11110');
          const premature = samples.slice(0, firstResult < 0 ? samples.length : firstResult)
            .filter(sample => sample.bits !== '11111');
          const reverted = firstResult >= 0 && samples.slice(firstResult).some(sample => sample.bits === '11111');
          results.push({ index, rate, initial, final: visibleBits(), premature, reverted,
            earlyResult: samples.some(sample => !sample.xorFinished && sample.bits !== '11111'),
            startedWith: samples[0].bits, prematureIncoming,
            xorSeen: samples.some(sample => sample.active === event.id),
            clean: !document.querySelector('[data-trace-bitwise]') });
        }
        return results;
      });
      for (const result of results) {
        assert.equal(result.index, 2);
        assert.equal(result.initial, '11111');
        assert.equal(result.startedWith, '11111', JSON.stringify(result));
        assert.equal(result.final, '11110');
        assert.equal(result.xorSeen && result.clean, true);
        assert.deepEqual(result.premature, []);
        assert.equal(result.reverted, false, JSON.stringify(result));
        assert.equal(result.earlyResult, false, JSON.stringify(result));
        assert.equal(result.prematureIncoming, false, 'p flying copy must wait for XOR to start');
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });

test('queen complete P expression, synchronized result and pre-call exits',
  { timeout: 60000 }, async () => {
    const code = fs.readFileSync(path.join(__dirname,
      '../algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8');
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.ace);
      await page.waitForTimeout(1000);
      await page.evaluate(source => {
        ace.edit('editor').setValue(source, -1);
        document.getElementById('inputArea').value = '5';
      }, code);
      await page.locator('#runBtn').click();
      await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
        && ASMTracePlayer.getDocument()?.frames.length > 4, { timeout: 30000 });
      const result = await page.evaluate(async () => {
        const doc = ASMTracePlayer.getDocument();
        const nid = Object.keys(doc.variables).find(id => doc.variables[id].name === 'n');
        const indices = doc.frames.map((frame, index) => frame.events.some(event =>
          event.source?.text === 'P ^= p') && frame.state[nid]?.data?.value === 0 ? index : -1)
          .filter(index => index >= 0);
        const opacity = element => {
          let value = 1;
          for (; element && element.id !== 'asm-trace-root'; element = element.parentElement) {
            value *= Number(element.getAttribute('opacity') ?? 1);
          }
          return value;
        };
        let mismatch = false, prematureIncoming = false, entered = false;
        for (const rate of [1, 2]) {
          window.asmGetAnimationPlaybackRate = () => rate;
          await ASMTracePlayer.renderStable(indices[1] - 1);
          const frame = doc.frames[indices[1]];
          const xor = frame.events.find(event => event.source?.text === 'P ^= p');
          let done = false, started = false;
          const listener = e => {
            if (e.detail?.event?.id === xor.id && e.detail.phase === 'start') started = true;
          };
          addEventListener('asm:trace-active-event', listener);
          const play = Promise.resolve(CodeScript.next()).finally(() => { done = true; });
          while (!done) {
            await new Promise(requestAnimationFrame);
            const p = [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
              .find(node => doc.variables[node.dataset.traceVariable]?.name === 'p');
            const bg = p?.querySelector('.outerframe-bg');
            if (bg) {
              const base = opacity(bg);
              if (base > 0 && base < 1) entered = true;
              for (const cell of p.querySelectorAll('[data-trace-index]')) {
                if (Math.abs(opacity(cell) - base) > 0.001) mismatch = true;
              }
            }
            const incoming = document.querySelector(`[data-trace-bitwise="${xor.id}"] [data-trace-bitwise-motion]`);
            if (!started && Number(incoming?.style.opacity || 0) > 0) prematureIncoming = true;
          }
          await play;
          removeEventListener('asm:trace-active-event', listener);
        }
        const sceneHasP = async index => {
          await ASMTracePlayer.renderStable(index);
          return !!document.querySelector('#asm-trace-root [data-trace-object-key="mask_union"]');
        };
        const frameWithText = text => doc.frames.findIndex(frame =>
          JSON.stringify(frame).includes(text));
        const firstCall = await sceneHasP(0);
        const separateUnion = frameWithText('P = L | M | R：合併三種攻擊範圍') >= 0;
        const propagation = await sceneHasP(doc.frames.findIndex(frame => frame.events.some(event =>
          event.source?.text === 'L | p')));
        const preCallIndex = frameWithText('把 nextL、nextM、nextR 傳入 dfs');
        const merged = await sceneHasP(preCallIndex);
        const preCallHasLowbit = [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
          .some(node => doc.variables[node.dataset.traceVariable]?.name === 'p');
        const isCalculation = event => event.source?.text?.includes('((1 << N) - 1) & ~(L | M | R)');
        const invertIndex = doc.frames.findIndex(frame => frame.state[nid]?.data?.value === 1
          && frame.events.some(isCalculation));
        const calculationHasP = await sceneHasP(invertIndex);
        await ASMTracePlayer.renderStable(invertIndex);
        // The first n=1 activation is rendered in its retained Q_1 node;
        // keep handoff deliberately removes the separate live board visual.
        const board = document.querySelector('#asm-trace-root [data-trace-object-key="Q_1"]');
        const row = [...(board?.querySelectorAll('[data-trace-index]') || [])]
          .filter(cell => cell.dataset.traceIndex.startsWith('1,'));
        const lod = board.querySelector('[data-asm-lod]')?._asmLod;
        const qBits = row.map(cell => cell.querySelector('text')?.textContent
          ?? lod?.records.find(item => item.cell === cell)?.value).join('');
        const pBits = [...document.querySelectorAll('#asm-trace-root [data-trace-object-key="mask_union"] [data-trace-index]')]
          .map(cell => cell.querySelector('text')?.textContent).join('');
        const colors = row.map(cell => cell.querySelector('rect').getAttribute('fill'));
        const inverseFrames = doc.frames.filter(frame => frame.state[nid]?.data?.value === 1
          && frame.events.some(isCalculation));
        return { mismatch, prematureIncoming, entered, firstCall, separateUnion, calculationHasP, propagation, merged,
          preCallHasLowbit, qBits, pBits, colors, inverseCount: inverseFrames.length };
      });
      const { qBits, pBits, colors, inverseCount, ...lifecycle } = result;
      assert.deepEqual(lifecycle, { mismatch: false, prematureIncoming: false, entered: true,
        firstCall: false, separateUnion: false, calculationHasP: true, propagation: false, merged: false,
        preCallHasLowbit: false });
      assert.equal(qBits, '11100');
      assert.equal(pBits, qBits);
      assert.equal(new Set(colors).size, 2, 'red unavailable and green available coexist');
      assert.equal(inverseCount, 5, 'each of the five n=1 activations has one shared Q/P inversion frame');
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
