const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('Studio lazily checks visited frames without losing hidden-event or marker-bound targets', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const fibonacci = await compile(fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Backtracking/fibonacci.cpp'
  ), 'utf8'), '5\n');
  const marker = await compile(`#include <bits/stdc++.h>
using namespace std;
int main() {
  vector<int> arr = {3, 2, 1};
  int index = 0;
  int hidden = 7;
  {
    int shown = 5;
    // @frame arr[index],shown
  }
  index = 1;
  // @frame arr[index]
  return 0;
}`);

  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const browserErrors = [];
    page.on('pageerror', error => browserErrors.push(String(error)));
    page.on('console', message => {
      if (message.type() === 'error') browserErrors.push(message.text());
    });
    await page.goto(`${base}/algorithm.html`);
    const inspect = sourceTrace => page.evaluate(async raw => {
      window.ASMTraceStudio.close();
      const document = window.ASMTracePlayer.apply(raw);
      window.ASMTraceStudio.open(document);
      // Availability is now evaluated when visiting each frame, not by opening
      // every hidden scene up front. Preserve all classification assertions.
      for (let index = 0; index < document.frames.length; index += 1) {
        await window.ASMTracePlayer.renderStable(index);
      }
      await window.ASMTracePlayer.renderStable(0);

      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const frame = document.frames[window.ASMTracePlayer.getCurrentFrame()];
      const groups = window.ASMTraceEventCodeTree.collectGroups(document, frame).map(group => ({
        type: group.type,
        source: String(group.event?.source?.text || ''),
        name: String(group.event?.name || ''),
        availability: group.availability,
        enabled: group.enabled,
        occurrences: group.events.map(event => ({
          disabled: event.autoAnimationDisabled,
          reason: event.autoAnimationUnavailableReason
        }))
      }));
      const buttons = [...window.document.querySelectorAll('.trace-studio-event-code-button')]
        .map(button => ({
          text: button.textContent.trim(),
          classes: [...button.classList],
          title: button.title
        }));
      return { groups, buttons };
    }, sourceTrace);

    const fib = await inspect(fibonacci.trace);
    const leftDeclaration = fib.groups.find(group => (
      group.type === 'declare' && group.source === 'int left'
    ));
    const leftExit = fib.groups.find(group => (
      group.type === 'scope-exit' && group.name === 'left'
    ));
    for (const group of [leftDeclaration, leftExit]) {
      assert.ok(group);
      assert.equal(group.availability, 'missing-target');
      assert.equal(group.enabled, false);
      assert.ok(group.occurrences.every(occurrence => (
        occurrence.disabled === true && occurrence.reason === 'missing-target'
      )));
    }
    for (const text of ['int left', 'left 退場']) {
      const button = fib.buttons.find(candidate => candidate.text.includes(text));
      assert.ok(button?.classes.includes('is-missing-target'));
      assert.ok(!button.classes.includes('is-available'));
      assert.match(button.title, /目標未顯示/);
    }

    const bound = await inspect(marker.trace);
    const indexAssignment = bound.groups.find(group => (
      group.type === 'assign' && group.source === 'index = 1'
    ));
    const hiddenDeclaration = bound.groups.find(group => (
      group.type === 'declare' && group.source === 'int hidden'
    ));
    const shownExit = bound.groups.find(group => (
      group.type === 'scope-exit' && group.name === 'shown'
    ));
    assert.equal(indexAssignment?.availability, 'available',
      'a scalar used as an automatic array marker remains a real animation target');
    assert.ok(indexAssignment.occurrences.every(occurrence => occurrence.disabled !== true));
    assert.equal(hiddenDeclaration?.availability, 'missing-target');
    assert.equal(shownExit?.availability, 'available',
      'an exit can use the matching displayed lifetime from the previous frame');
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
  }
});
