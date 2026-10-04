const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('queen sample exposes both OR operands and animates L, M and R results',
  { timeout: 90000 }, async () => {
    const code = fs.readFileSync(path.join(__dirname,
      '../algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8');
    assert.ok(!code.includes('or_source'));
    const { trace } = await compile(code, '4');
    const commits = trace.frames.flatMap(frame => frame.events).filter(event => event.bitwiseCommit);
    assert.equal(commits.length, 48, 'all next-mask OR initialization commits remain in runtime metadata');
    assert.ok(commits.every(event => event.animate === false));
    const cases = ['L', 'M', 'R'].map(name => {
      const index = trace.frames.findIndex(frame => frame.events.some(event =>
        event.bitwise?.operator === '|' && event.source?.text === `${name} | p`));
      assert.ok(index >= 0, `${name} OR event exists`);
      return { name, index };
    });
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      await page.waitForFunction(() => window.asmApplyTraceDocument && window.ASMTraceFrameTween);
      await page.waitForTimeout(1000);
      await page.evaluate(source => {
        ace.edit('editor').setValue(source, -1);
        document.getElementById('inputArea').value = '4';
      }, code);
      await page.locator('#runBtn').click();
      await page.waitForFunction(() => !document.getElementById('runBtn').classList.contains('loading')
        && ASMTracePlayer.getDocument()?.sourceCode.includes('lowbit_view'), { timeout: 30000 });
      for (const item of cases) {
        const probe = await page.evaluate(async ({ name, index }) => {
          await ASMTracePlayer.renderStable(index);
          const doc = ASMTracePlayer.getDocument(), frame = doc.frames[index];
          ASMTraceStudio.open(doc);
          await new Promise(resolve => setTimeout(resolve, 200));
          const buttons = [...document.querySelectorAll('.trace-studio-frame-events-section .trace-studio-event-code-button')]
            .filter(button => button.textContent.includes(`${name} | p`))
            .map(button => ({ text: button.textContent, green: button.classList.contains('is-available'),
              yellow: button.classList.contains('is-missing-target') }));
          const event = frame.events.find(e => e.bitwise?.operator === '|' && e.source?.text === `${name} | p`);
          const elements = new Map([...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
            .map(node => [node.dataset.traceObjectKey, node]));
          const plan = ASMTraceFrameTween.bitwisePlan(doc, frame, event, elements);
          const effect = ASMTraceFrameTween.createBitwiseEffect(event, doc, frame, elements);
          let moved = false;
          let held = false;
          if (effect) {
            effect.update(0);
            const cell = document.querySelector('[data-trace-bitwise-motion] > g');
            const start = cell.getAttribute('transform');
            effect.update(260);
            moved = start !== cell.getAttribute('transform');
            effect.update(338);
            const arrival = cell.getAttribute('transform');
            effect.update(437);
            const motion = document.querySelector('[data-trace-bitwise-motion]');
            held = motion.style.opacity === '1' && cell.getAttribute('transform') === arrival;
            effect.update(439);
            held = held && Number(motion.style.opacity) < 1;
            effect.update(520);
            effect.remove();
          }
          return { buttons, available: event.autoAnimationDisabled !== true, plan: !!plan,
            effect: !!effect, moved, held, clean: !document.querySelector('[data-trace-bitwise]') };
        }, item);
        assert.ok(probe.buttons.length && probe.buttons.every(button => button.green), JSON.stringify(probe));
        delete probe.buttons;
        assert.deepEqual(probe, { available: true, plan: true, effect: true, moved: true, held: true, clean: true }, item.name);
      }
      const shiftIndex = trace.frames.findIndex(frame => frame.events.some(event => event.bitShift?.direction === 'left'));
      const lowbitPlacement = await page.evaluate(async index => {
        await ASMTracePlayer.renderStable(index);
        const root = document.getElementById('asm-trace-root');
        const nodes = [...root.querySelectorAll('.asm-trace-object')];
        const doc = ASMTracePlayer.getDocument();
        const p = nodes.find(node => doc.variables[node.dataset.traceVariable]?.name === 'p');
        const l = nodes.find(node => node.dataset.traceObjectKey === 'mask_L');
        return !!p && !!l && p.getBoundingClientRect().bottom < l.getBoundingClientRect().top;
      }, shiftIndex);
      assert.equal(lowbitPlacement, true, 'p remains above L during left shift');
      const playback = await page.evaluate(async items => {
        ASMTraceStudio.close();
        const results = [];
        for (const rate of [1, 2]) {
          window.asmGetAnimationPlaybackRate = () => rate;
          for (const { name, index } of items) {
            await ASMTracePlayer.renderStable(index - 1);
            let done = false, seen = false, moved = false;
            let origin = null;
            const play = Promise.resolve(CodeScript.next()).finally(() => { done = true; });
            for (let tick = 0; tick < 1200 && !done; tick++) {
              await new Promise(requestAnimationFrame);
              const cell = document.querySelector('[data-trace-bitwise-motion] > g');
              if (!cell) continue;
              seen = true;
              const at = cell.getAttribute('transform');
              if (origin === null) origin = at;
              else if (origin !== at) moved = true;
            }
            await play;
            results.push({ rate, name, seen, moved,
              clean: !document.querySelector('[data-trace-bitwise]') });
          }
        }
        return results;
      }, cases);
      assert.ok(playback.every(item => item.seen && item.moved && item.clean), JSON.stringify(playback));
      const legacy = JSON.parse(JSON.stringify(trace));
      legacy.frames.forEach(frame => frame.events.forEach(event => { delete event.bitwiseCommit; }));
      const preserved = await page.evaluate(async doc => {
        asmApplyTraceDocument(doc);
        await ASMTracePlayer.renderStable(4);
        const old = JSON.parse(JSON.stringify(ASMTracePlayer.getDocument()));
        asmApplyTraceDocument(old);
        await ASMTracePlayer.renderStable(4);
        return ASMTracePlayer.getDocument().frames.flatMap(frame => frame.events)
          .filter(event => event.declarationInitializer && event.animate === false).length;
      }, legacy);
      assert.equal(preserved, commits.length, 'legacy commits without the field survive loading and reopening');
      assert.deepEqual(errors, []);
    } finally {
      await browser.close();
    }
  });
