const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

test('compound bit rows retain committed intermediate values instead of exposing frame-final bits',
  { timeout: 90000 }, async () => {
    const sample = fs.readFileSync(path.join(__dirname,
      '../algorithm_sample/Backtracking/8queen_recursion.cpp'), 'utf8');
    assert.ok(sample.includes('int P = ((1 << N) - 1) & ~(L | M | R);'));
    const split = sample.replace('int P = ((1 << N) - 1) & ~(L | M | R);',
      'int P = L | M | R;\n    P = ((1 << N) - 1) & ~P;');
    const chained = `#include <bits/stdc++.h>
using namespace std;
// @preset view
// @object bits(x, 5), bits(y, 5), bits(z, 5), bits(P, 5) with labels(none), display("\${value}")
// @style P background AV_red when value == 1
// @endpreset
int main() {
  int x = 1, y = 2, z = 4, P = 0;
  // @frame use view
  P = x | y | z;
  // @frame use view
}
`;
    const browser = await chromium.launch({ headless: true,
      ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.goto(process.env.ASM_TEST_BASE_URL + '/algorithm.html');
      await page.waitForFunction(() => window.ASMTracePlayer && window.ace);
      await page.waitForTimeout(1000);
      for (const [name, code, final] of [['complete', sample, '11111'],
        ['split compound', split, '11111'], ['chained OR', chained, '00111']]) {
        await page.evaluate(source => {
          ace.edit('editor').setValue(source, -1);
          document.getElementById('inputArea').value = '5';
        }, code);
        await page.locator('#runBtn').click();
        await page.waitForFunction(source => !document.getElementById('runBtn').classList.contains('loading')
          && ASMTracePlayer.getDocument()?.sourceCode === source, code, { timeout: 30000 });
        const probes = await page.evaluate(async final => {
          const doc = ASMTracePlayer.getDocument();
          const pid = Object.keys(doc.variables).find(id => doc.variables[id].name === 'P');
          const probes = [];
          const frame = doc.frames[1];
          const operations = frame.events.filter(e => e.bitwise);
          const read = () => {
            const overlay = [...document.querySelectorAll('[data-trace-bitwise]')]
              .find(node => operations.some(e => e.id === node.dataset.traceBitwise));
            const object = document.querySelector('#asm-trace-root [data-trace-object-key="mask_union"]')
              || [...document.querySelectorAll('#asm-trace-root > .asm-trace-object')]
                .find(node => node.dataset.traceVariable === pid);
            const host = overlay?.querySelector('[data-trace-bitwise-base]') || object;
            return [...(host?.querySelectorAll('text') || [])]
              .map(text => text.textContent).filter(text => /^[01]$/.test(text)).join('');
          };
          for (const rate of [1, 2]) {
            window.asmGetAnimationPlaybackRate = () => rate;
            await ASMTracePlayer.renderStable(0);
            let done = false;
            const samples = [];
            const play = Promise.resolve(CodeScript.next()).finally(() => { done = true; });
            samples.push(read());
            while (!done) {
              await new Promise(requestAnimationFrame);
              samples.push(read());
            }
            await play;
            const sequence = samples.filter(value => value.length === 5)
              .filter((value, index, values) => index === 0 || value !== values[index - 1]);
            const firstFinal = sequence.indexOf(final);
            probes.push({ rate, sequence, final: read(), regressed: firstFinal >= 0
              && sequence.slice(firstFinal).some(value => value !== final) });
          }
          return probes;
        }, final);
        for (const probe of probes) {
          assert.equal(probe.final, final, name + JSON.stringify(probe));
          assert.equal(probe.regressed, false, name + JSON.stringify(probe));
          if (name === 'chained OR') assert.deepEqual(probe.sequence, ['00001', '00011', '00111']);
          else if (name === 'split compound') assert.deepEqual(probe.sequence, ['00000', '11111'], name + JSON.stringify(probe));
          else assert.deepEqual(probe.sequence, ['11111'], 'a direct initialized P enters with its sole result');
        }
      }
      assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  });
