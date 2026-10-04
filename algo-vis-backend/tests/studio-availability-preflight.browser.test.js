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
  // @frame arr
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
  const merge = await compile(
    fs.readFileSync(path.join(__dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up.cpp'), 'utf8'),
    fs.readFileSync(path.join(__dirname, '../algorithm_sample/Sorting/merge_sort_bottom_up-sample_input.txt'), 'utf8')
  );
  merge.trace.studio ||= {};
  merge.trace.studio.eventInstructionStates ||= {};
  merge.trace.studio.eventInstructionStates['declare:mergesort:temp'] = true;

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
          title: button.title,
          background: getComputedStyle(button).backgroundColor
        }));
      return {
        groups,
        buttons,
        toggleBadgeCount: window.document.querySelectorAll('.trace-studio-event-toggle-state').length
      };
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
      assert.equal(group.enabled, false,
        'an unavailable instruction stays visually closed until explicitly enabled');
      assert.ok(group.occurrences.every(occurrence => (
        occurrence.disabled === true && occurrence.reason === 'missing-target'
      )));
    }
    for (const text of ['int left', 'left 退場']) {
      const button = fib.buttons.find(candidate => candidate.text.includes(text));
      assert.ok(button?.classes.includes('is-missing-target'));
      assert.ok(!button.classes.includes('is-available'));
      assert.ok(!button.classes.includes('is-enabled'));
      assert.equal(button.background, 'rgb(23, 28, 33)');
      assert.match(button.title, /目標未顯示/);
    }
    const enabledMissingAppearance = await page.evaluate(async () => {
      const button = [...document.querySelectorAll('.trace-studio-event-code-button')]
        .find(candidate => candidate.textContent.includes('int left'));
      button?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const updated = [...document.querySelectorAll('.trace-studio-event-code-button')]
        .find(candidate => candidate.textContent.includes('int left'));
      return {
        classes: [...(updated?.classList || [])],
        background: updated ? getComputedStyle(updated).backgroundColor : ''
      };
    });
    assert.ok(enabledMissingAppearance.classes.includes('is-enabled'));
    assert.equal(enabledMissingAppearance.background, 'rgb(60, 50, 19)',
      'explicitly opening a missing-target instruction reveals its yellow status');

    const bound = await inspect(marker.trace);
    const indexAssignment = bound.groups.find(group => (
      group.type === 'assign' && group.source === 'index = 1'
    ));
    const indexAssignmentButton = bound.buttons.find(button => button.text.includes('index = 1'));
    const hiddenDeclaration = bound.groups.find(group => (
      group.type === 'declare' && group.source === 'int hidden'
    ));
    const shownExit = bound.groups.find(group => (
      group.type === 'scope-exit' && group.name === 'shown'
    ));
    assert.equal(indexAssignment?.availability, 'available',
      'a scalar used as an automatic array marker remains a real animation target');
    assert.ok(indexAssignment.occurrences.every(occurrence => occurrence.disabled !== true));
    assert.ok(indexAssignmentButton?.classes.includes('is-available'));
    assert.ok(!indexAssignmentButton.classes.includes('is-current'),
      'the later assignment is not part of the currently selected first frame');
    assert.equal(indexAssignmentButton.background, 'rgb(23, 51, 35)',
      'a non-current available instruction keeps the same green background');
    assert.equal(bound.toggleBadgeCount, 0, 'event buttons do not render 開／關 text badges');
    const disabledAppearance = await page.evaluate(async () => {
      const button = [...document.querySelectorAll('.trace-studio-event-code-button')]
        .find(candidate => candidate.textContent.includes('index = 1'));
      button?.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const updated = [...document.querySelectorAll('.trace-studio-event-code-button')]
        .find(candidate => candidate.textContent.includes('index = 1'));
      return {
        classes: [...(updated?.classList || [])],
        background: updated ? getComputedStyle(updated).backgroundColor : ''
      };
    });
    assert.ok(!disabledAppearance.classes.includes('is-enabled'));
    assert.equal(disabledAppearance.background, 'rgb(23, 28, 33)',
      'turning an instruction off immediately restores the original black background');
    assert.equal(hiddenDeclaration?.availability, 'missing-target');
    assert.equal(shownExit?.availability, 'available',
      'an exit can use the matching displayed lifetime from the previous frame');

    const mergeState = await inspect(merge.trace);
    const tempDeclaration = mergeState.groups.find(group => (
      group.type === 'declare' && group.source === 'vector<int> temp'
    ));
    const hiddenWidth = mergeState.groups.find(group => (
      group.type === 'declare' && group.source === 'int width'
    ));
    const tempButton = mergeState.buttons.find(button => button.text.includes('vector<int> temp'));
    const widthButton = mergeState.buttons.find(button => button.text.includes('int width'));
    assert.equal(tempDeclaration?.availability, 'available',
      'temp declaration is green because temp appears in later merge_step frames');
    assert.equal(tempDeclaration?.enabled, true);
    assert.equal(tempButton?.background, 'rgb(23, 51, 35)');
    assert.equal(hiddenWidth?.availability, 'missing-target');
    assert.equal(hiddenWidth?.enabled, false);
    assert.equal(widthButton?.background, 'rgb(23, 28, 33)',
      'an event whose object never appears stays closed on the original black background');
    const tempEntrance = await page.evaluate(async raw => {
      window.ASMTraceStudio.close();
      const document = window.ASMTracePlayer.apply(raw);
      const tempId = Object.keys(document.variables).find(id => (
        document.variables[id]?.name === 'temp'
      ));
      const frameIndex = document.frames.findIndex(frame => (
        !(frame.captureOnlyVariableIds || []).includes(tempId)
        && frame.events.some(event => event.type === 'declare'
          && (event.targets || []).some(target => target.variableId === tempId))
      ));
      const declaration = document.frames[frameIndex]?.events.find(event => (
        event.type === 'declare'
        && (event.targets || []).some(target => target.variableId === tempId)
      ));
      await window.ASMTracePlayer.renderStable(Math.max(0, frameIndex - 1));
      let settled = false;
      let observedActiveDeclaration = false;
      const transition = window.ASMTracePlayer.render(frameIndex, {
        fromIndex: Math.max(0, frameIndex - 1), forceTransition: true
      }).finally(() => { settled = true; });
      for (let count = 0; count < 360 && !settled; count += 1) {
        await new Promise(resolve => requestAnimationFrame(resolve));
        const active = window.document.querySelector('[data-trace-active-event-id]');
        if (active?.dataset.traceActiveEventId === declaration?.id) {
          observedActiveDeclaration = true;
        }
      }
      await transition;
      return {
        frameIndex,
        declarationType: declaration?.type || '',
        tempVisible: Boolean(window.document.querySelector(
          `[data-trace-variable="${tempId}"], [data-trace-source-variable-id="${tempId}"]`
        )),
        observedActiveDeclaration
      };
    }, merge.trace);
    assert.ok(tempEntrance.frameIndex > 0);
    assert.equal(tempEntrance.declarationType, 'declare');
    assert.equal(tempEntrance.tempVisible, true);
    assert.equal(tempEntrance.observedActiveDeclaration, true,
      'the first visible temp runs its real declaration event in the browser');
    assert.deepEqual(browserErrors, []);
  } finally {
    await browser.close();
  }
});
