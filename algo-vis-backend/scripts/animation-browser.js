const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { validate } = require('./animation-assertions');
const root = path.resolve(__dirname, '..');
const fixture = name => fs.readFileSync(path.join(root, 'tests/fixtures', name + '.cpp'), 'utf8');
const cases = [
  { name: 'arrow-identity', code: fixture('arrow-identity'), input: '' },
  { name: 'quick-style-swap', code: fixture('quick-style-swap'), input: '6\n5 7 2 1 9 4\n', frameLimit: 5 },
  { name: 'insertion-style-labels', code: fixture('insertion-style-labels'), input: '6\n1 8 7 2 6 5\n', frameLimit: 6 },
  { name: 'defaults', code: fixture('defaults'), input: '' },
  { name: 'style-frame-completion', code: fixture('style-frame-completion'), input: '' },
  { name: 'recursive-roles', code: fixture('recursive-roles'), input: '' },
  { name: 'function-call', code: fixture('function-call'), input: '' },
  { name: 'highlight-swap', code: fixture('highlight-swap'), input: '' },
  { name: 'bubble', code: fixture('bubble'), input: '4\n4 1 3 2\n' },
  { name: 'insertion', code: fixture('insertion'), input: '4\n4 1 3 2\n' },
  { name: 'selection', code: fixture('selection'), input: '4\n4 1 3 2\n' },
  { name: 'heap', code: fixture('heap'), input: '4\n4 1 3 2\n' },
  { name: 'quick-recursion', code: fixture('quick-recursion'), input: '4\n4 1 3 2\n' }
];

async function runAnimationBrowser(baseURL) {
  const selectedCases = cases.filter(item => !process.env.ASM_ANIMATION_CASES
    || process.env.ASM_ANIMATION_CASES.split(',').includes(item.name));
  if (!selectedCases.length) throw new Error('沒有匹配的動畫案例，不能視為驗證成功');
  const output = path.join(root, 'test-results/animation', new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true,
    ...(process.env.ASM_BROWSER_CHANNEL ? { channel: process.env.ASM_BROWSER_CHANNEL } :
      process.platform === 'win32' ? { channel: 'msedge' } : {}) });
  const failures = [];
  const results = [];
  try {
    try {
      results.push(await require('./deck-import-browser').runDeckImportBrowser(browser, baseURL, output));
    } catch (error) {
      failures.push('deck-import-repair');
      results.push({ label: 'deck-import-repair', pass: false, firstViolation: error.message });
      console.log(`FAIL deck-import-repair: ${error.message}`);
    }
    for (const item of selectedCases) {
      let animation;
      let baseline;
      for (const mode of ['algorithm', 'editor', 'runtime']) {
        const context = await browser.newContext({ viewport: { width: 1600, height: 900 } });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
        let target = page;
        const label = `${item.name}-${mode}`;
        console.log(`RUN ${label}`);
        try {
          if (mode === 'algorithm') {
            await page.goto(baseURL + '/algorithm.html');
            await page.waitForFunction(() => typeof aceEditor !== 'undefined' && window.ASMTraceDebugRecorder);
            // Real RUN button uses analyze/compile and the application's load path.
            await page.evaluate(({ code, input }) => {
              aceEditor.setValue(code, -1);
              document.getElementById('inputArea').value = input;
            }, item);
            await page.locator('#runBtn').click();
            await page.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length > 1,
              null, { timeout: 60000 });
            animation = await page.evaluate(() => ({ ...window.ASMTraceEditor.snapshot(),
              code: aceEditor.getValue(), input: document.getElementById('inputArea').value }));
          } else {
            // Same-origin parent uses the exact slide iframe message protocol.
            await page.route('**/asm-animation-regression-host', route => route.fulfill({
              contentType: 'text/html', body: `<html><body style="margin:0"><iframe id="animation" style="border:0;width:100vw;height:100vh" src="/algorithm.html?asmEmbed=${mode}"></iframe></body></html>`
            }));
            await page.goto(baseURL + '/asm-animation-regression-host');
            await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?.ASMTraceEditor);
            target = page.frames().find(frame => frame.url().includes('/algorithm.html'));
            await page.evaluate(animation => {
              const child = document.querySelector('iframe').contentWindow;
              child.postMessage({ type: 'asm-load-animation', animation }, location.origin);
              child.postMessage({ type: 'asm-runtime-visibility', visible: true }, location.origin);
            }, JSON.parse(JSON.stringify(animation)));
            await target.waitForFunction(() => window.ASMTracePlayer?.getDocument?.()?.frames?.length > 1);
          }
          await target.evaluate(() => window.ASMTraceStudio?.close?.());
          if (item.name === 'arrow-identity') await target.evaluate(() => {
            window.__arrowChecks = { rebound: 0, follow: 0, failures: [] };
            const tween = ASMTraceFrameTween, original = tween.play;
            tween.play = function(options) {
              const result = original.call(this, options);
              let complete = false;
              Promise.resolve(result).finally(() => { complete = true; });
              function sample() {
                const arrow = options.root.querySelector('[data-trace-arrow="link"]');
                const state = arrow?._asmArrowTween;
                if (state && state.progress > .05 && state.progress < .95) {
                  const automatic = [...options.root.querySelectorAll('[data-trace-arrow-identity]')]
                    .find(element => JSON.parse(element.dataset.traceArrowIdentity).explicitId === false);
                  if (!automatic?._asmArrowTween || automatic.getAttribute('opacity') !== '1') {
                    window.__arrowChecks.failures.push('automatic-role-not-paired');
                  }
                  if (arrow.getAttribute('opacity') !== '1') window.__arrowChecks.failures.push('matched-arrow-fades');
                  const oldKey = state.previous.dataset.traceArrowToKey;
                  const newKey = arrow.dataset.traceArrowToKey;
                  const cell = options.currentElements.get(newKey);
                  const box = ASMArrowModel.presentedBounds(cell, options.root);
                  if (box) {
                    const x = Number(arrow.dataset.traceArrowToX), end = box.x + box.width / 2;
                    if (oldKey !== newKey) {
                      const old = ASMArrowModel.presentedBounds(options.currentElements.get(oldKey), options.root);
                      const start = old ? old.x + old.width / 2 : Number(state.previous.dataset.traceArrowToX);
                      const expected = start + (end - start) * state.progress;
                      if (Math.abs(x - expected) > 1) window.__arrowChecks.failures.push('rebound-position');
                      if (Math.abs(x - end) > 1 && Math.abs(x - start) > 1) window.__arrowChecks.rebound++;
                      const width = Number(arrow.getAttribute('stroke-width'));
                      if (!(width > 2 && width < 4)) window.__arrowChecks.failures.push('rebound-width');
                      if (!/^rgba/.test(arrow.getAttribute('stroke'))) window.__arrowChecks.failures.push('rebound-color');
                    } else {
                      window.__arrowChecks.follow++;
                      if (Math.abs(x - end) > 1) window.__arrowChecks.failures.push('following-lags');
                    }
                  }
                }
                if (!complete) requestAnimationFrame(sample);
              }
              requestAnimationFrame(sample);
              return result;
            };
          });
          if (item.name === 'quick-style-swap') await target.evaluate(() => {
            window.__swapPaintChecks = { heldSamples: 0, transitionSamples: 0, failures: [] };
            const tween = window.ASMTraceFrameTween, play = tween.play;
            tween.play = function(options) {
              const result = play.call(this, options);
              const plan = result?.playbackPlan?.forwardReplay;
              const swap = plan?.checkpoints?.find(c => c.eventType === 'swap' && c.mode === 'animated');
              if (!swap) return result;
              const bindings = plan.checkpoints.find(c => c.visualBindingsBefore)?.visualBindingsBefore || {};
              const previousRect = key => {
                const direct = options.previousObjects.get(key);
                if (direct) return direct.querySelector(':scope > rect');
                for (const top of options.previousObjects.values()) {
                  const cell = top.querySelector(`[data-trace-object-key="${CSS.escape(key)}"]`);
                  if (cell) return cell.querySelector(':scope > rect');
                }
                return null;
              };
              const normalize = color => {
                if (color === '#ffffff' || color === '#fff') return [255,255,255,1];
                const values = color?.match(/[\d.]+/g)?.map(Number) || [];
                if (values.length === 3) values.push(1);
                return values;
              };
              const cells = swap.mutations.filter(m => m.kind === 'value').map(m => {
                const visual = m.visualKey || m.key;
                const source = Object.keys(bindings).find(key => bindings[key] === visual) || visual;
                return { key: visual, rect: options.currentElements.get(visual)?.querySelector(':scope > rect'),
                  expected: normalize(previousRect(source)?.getAttribute('fill')) };
              });
              let complete = false, started = false;
              Promise.resolve(result).finally(() => { complete = true; });
              function sample() {
                if (complete) return;
                const active = document.getElementById('asm-trace-root')?.getAttribute('data-trace-active-event-type');
                if (active === 'swap') started = true;
                for (const cell of cells) {
                  if (!cell.rect || cell.expected.length !== 4) {
                    window.__swapPaintChecks.failures.push({ kind: 'swap-paint-missing-cell', key: cell.key });
                    continue;
                  }
                  if (!started) {
                    window.__swapPaintChecks.heldSamples++;
                    const actual = normalize(getComputedStyle(cell.rect).fill);
                    if (actual.some((v,i) => Math.abs(v-cell.expected[i]) > (i===3 ? .01 : 1))) {
                      window.__swapPaintChecks.failures.push({ kind: 'paint-before-swap', key: cell.key, active,
                        expected: cell.expected, actual });
                    }
                  } else if (active === 'swap' && cell.rect.getAnimations().some(a => a.transitionProperty === 'fill')) {
                    window.__swapPaintChecks.transitionSamples++;
                  }
                }
                requestAnimationFrame(sample);
              }
              requestAnimationFrame(sample);
              return result;
            };
          });
          if (item.frameLimit) await target.evaluate(limit => {
            const trace = window.ASMTracePlayer.getDocument();
            trace.frames = trace.frames.slice(0, limit);
          }, item.frameLimit);
          if (item.name === 'insertion-style-labels') await target.evaluate(() => {
            window.__labelPaintChecks = { samples: 0, transitions: 0, failures: [] };
            window.__labelPaintSampling = true;
            function sample() {
              if (!window.__labelPaintSampling) return;
              const root = document.getElementById('asm-trace-root');
              const trace = window.ASMTracePlayer.getDocument();
              const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
              const checks = window.__labelPaintChecks;
              const rectFor = key => root?.querySelector(`[data-trace-object-key="${CSS.escape(key)}"] > rect`);
              const color = rect => {
                const channels = getComputedStyle(rect).fill.match(/[\d.]+/g)?.map(Number);
                if (channels?.length === 3) channels.push(1);
                return channels;
              };
              for (let i=0; i<6; i++) {
                const value = rectFor(`${arr}#${i}`);
                const index = rectFor(`${arr}#${i}:index`);
                if (!value || !index) continue;
                checks.samples++;
                const a=color(value), b=color(index);
                if (i === 5 && b?.slice(0,3).some(channel => Math.abs(channel-255)>1)) {
                  checks.failures.push({ kind: 'untouched-index-painted', frame: window.ASMTracePlayer.getCurrentFrame()+1, color: b });
                }
                if (a?.length === b?.length && a.some((channel,j) => Math.abs(channel-b[j]) > (j===3 ? 0.01 : 1))) {
                  checks.failures.push({ kind: 'value-index-color-progress', frame: window.ASMTracePlayer.getCurrentFrame()+1, index:i, value:a, label:b });
                }
                if ([value,index].some(rect => rect.getAnimations().some(animation => animation.transitionProperty === 'fill'))) checks.transitions++;
              }
              requestAnimationFrame(sample);
            }
            requestAnimationFrame(sample);
          });
          await target.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
          if (item.name === 'style-frame-completion') await target.evaluate(() => {
            window.__styleCompletionChecks = { samples: 0, failures: [] };
            const renderer = window.ASMTraceRenderers;
            const refresh = renderer.refreshArrows;
            renderer.refreshArrows = function(...args) {
              const result = refresh.apply(this, args);
              const root = document.getElementById('asm-trace-root');
              if (!['assign', 'write'].includes(root?.dataset.traceActiveEventType)) return result;
              const trace = window.ASMTracePlayer.getDocument();
              const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
              const cell = root.querySelector(`[data-trace-object-key="${CSS.escape(arr + '#0')}"]`);
              const index = root.querySelector(`[data-trace-object-key="${CSS.escape(arr + '#0:index')}"]`);
              const destinationPaint = 'rgba(239, 154, 154, 0.6)';
              window.__styleCompletionChecks.samples++;
              for (const element of [cell, index]) {
                const fill = element?.querySelector(':scope > rect')?.getAttribute('fill');
                if (fill !== destinationPaint) window.__styleCompletionChecks.failures.push({
                  kind: 'style-not-applied-at-frame-entry', fill,
                  key: element?.dataset.traceObjectKey,
                  event: root.dataset.traceActiveEventId
                });
              }
              return result;
            };
          });
          if (item.name === 'recursive-roles') await target.evaluate(() => {
            const tween = window.ASMTraceFrameTween;
            const original = tween.play;
            window.__recursiveRoleChecks = { handoffs: 0, markers: 0, scalars: 0, failures: [] };
            tween.play = function(options) {
              const roles = tween.recursiveRoleContinuations(options.document, options.previousFrame,
                options.frame, options.previousObjects, options.currentElements);
              const result = original.call(this, options);
              if (roles.size) window.__recursiveRoleChecks.handoffs++;
              roles.forEach((match, key) => {
                const element = options.currentElements.get(key);
                if (element.dataset.traceSourceVariableId) window.__recursiveRoleChecks.markers++;
                else window.__recursiveRoleChecks.scalars++;
              });
              const check = () => roles.forEach((match, key) => {
                const element = options.currentElements.get(key);
                if (element.dataset.traceAppearing === '1'
                  || element.querySelector?.('[data-trace-appearing="1"]')) {
                  window.__recursiveRoleChecks.failures.push({ kind: 'recursive-role-reentered', key });
                }
              });
              requestAnimationFrame(check);
              return result;
            };
          });
          if (item.name === 'function-call') await target.evaluate(() => {
            // Calls retain the user's historical default-off preference. This
            // fixture explicitly enables them to exercise the new animation.
            const trace = window.ASMTracePlayer.getDocument();
            trace.eventSettings ||= {};
            trace.eventSettings.defaultEnabled ||= {};
            trace.eventSettings.defaultEnabled.call = true;
            trace.frames.forEach(frame => frame.events.forEach(event => {
              if (event.type === 'call') event.enabled = true;
            }));
            window.__callCodeChecks = { samples: 0, failures: [] };
            const presenter = window.ASMTraceCodePresenter;
            window.addEventListener('asm:trace-active-event', notification => {
              const { event, phase } = notification.detail || {};
              if (event?.type !== 'call' || phase !== 'start') return;
              const id = event.id;
              const nodes = [...presenter.getPanel().querySelectorAll('[data-trace-event-ids]')]
                .filter(node => node.dataset.traceEventIds.split(/\s+/).includes(id));
              window.__callCodeChecks.samples++;
              if (!nodes.length || nodes.some(node => !node.classList.contains('is-complete')
                || node.classList.contains('is-active'))) {
                window.__callCodeChecks.failures.push({ kind: 'function-call-code-grey', id, nodes: nodes.length });
              }
            });
          });
          if (item.name === 'highlight-swap') await target.evaluate(() => {
            window.__highlightSwapChecks = { samples: 0, ghostSamples: 0, indexSamples: 0,
              motionSamples: 0, scaleSamples: 0, rhythmSamples: 0, paintTransitionSamples: 0, failures: [] };
            window.__highlightPaintSampling = true;
            const samplePaint = () => {
              if (!window.__highlightPaintSampling) return;
              const root = document.getElementById('asm-trace-root');
              (root?.getAnimations?.({ subtree: true }) || []).forEach(animation => {
                const progress = animation.effect?.getComputedTiming?.().progress;
                if (['fill', 'stroke'].includes(animation.transitionProperty)
                  && progress > 0 && progress < 1) window.__highlightSwapChecks.paintTransitionSamples++;
              });
              requestAnimationFrame(samplePaint);
            };
            requestAnimationFrame(samplePaint);
            const history = new WeakMap();
            const original = window.ASMTraceRenderers.refreshArrows;
            window.ASMTraceRenderers.refreshArrows = function (...args) {
              const result = original.apply(this, args);
              const root = document.getElementById('asm-trace-root');
              if (root?.getAttribute('data-trace-active-event-type') !== 'swap') return result;
              const checks = window.__highlightSwapChecks;
              const visible = [...root.querySelectorAll('.asm-trace-style-decoration')]
                .filter(wrapper => wrapper.firstElementChild?.classList.contains('highlight-blink')
                  && wrapper.firstElementChild.getAttribute('display') !== 'none');
              checks.samples++;
              if (visible.some(wrapper => wrapper._asmStyleCell?._asmStylePresentationCell)) checks.ghostSamples++;
              if (visible.length < 2 || visible.some(wrapper => wrapper.getAttribute('display') === 'none'
                || Number(wrapper.getAttribute('opacity')) < 0.99)) {
                checks.failures.push({ kind: 'highlight-swap-visibility', frame: root.dataset.traceFrameId,
                  wrappers: visible.map(wrapper => ({ opacity: wrapper.getAttribute('opacity'),
                    display: wrapper.getAttribute('display'),
                    key: wrapper._asmStyleCell?.getAttribute('data-trace-object-key'),
                    proxy: !!wrapper._asmStyleCell?._asmStylePresentationCell })) });
              }
              visible.forEach(wrapper => {
                const sourceCell = wrapper._asmStyleCell?._asmStylePresentationCell || wrapper._asmStyleCell;
                const rect = [...(sourceCell?.children || [])].find(child => child.tagName.toLowerCase() === 'rect');
                const label = wrapper._asmStyleIndexRect;
                if (!rect || !label) return;
                checks.indexSamples++;
                const required = Number(rect.getAttribute('height')) + Number(label.getAttribute('height'));
                const hint = wrapper.firstElementChild;
                if (Math.abs(Number(hint.getAttribute('height')) - required) > 0.01) {
                  checks.failures.push({ kind: 'highlight-index-bounds', required });
                }
                const expected = rect.getBoundingClientRect();
                const actual = hint.getBoundingClientRect();
                if (Math.abs(actual.left - expected.left) > 1 || Math.abs(actual.top - expected.top) > 1
                  || Math.abs(actual.width - expected.width) > 1) {
                  checks.failures.push({ kind: 'highlight-follow-cell', time: performance.now(),
                    expected: { x: expected.left, y: expected.top, width: expected.width },
                    actual: { x: actual.left, y: actual.top, width: actual.width } });
                }
                const animation = hint.getAnimations().find(item => item.animationName === 'blink-stroke');
                const prior = history.get(hint);
                if (prior) {
                  if (Math.abs(actual.left - prior.x) > 0.01 || Math.abs(actual.top - prior.y) > 0.01) checks.motionSamples++;
                  // SVG resizing may change rect dimensions rather than use a
                  // scale() transform. Require actual presented size changes.
                  if (Math.abs(actual.width - prior.width) > 0.01
                    || Math.abs(actual.height - prior.height) > 0.01) checks.scaleSamples++;
                  if (hint.style.animationDelay !== prior.delay
                    || (animation?.startTime != null && prior.start != null && animation.startTime !== prior.start)
                    || (animation?.currentTime != null && prior.time != null && animation.currentTime < prior.time)) {
                    checks.failures.push({ kind: 'highlight-rhythm-reset', time: performance.now(),
                      previous: { delay: prior.delay, start: prior.start, time: prior.time },
                      current: { delay: hint.style.animationDelay, start: animation?.startTime, time: animation?.currentTime } });
                  }
                }
                if (!animation || hint.dataset.tracePresentationClock !== 'global') {
                  checks.failures.push({ kind: 'highlight-missing-global-rhythm' });
                } else checks.rhythmSamples++;
                history.set(hint, { x: actual.left, y: actual.top, width: actual.width, height: actual.height,
                  delay: hint.style.animationDelay, start: animation?.startTime, time: animation?.currentTime });
              });
              return result;
            };
          });
          let recordingTimeout;
          const report = await Promise.race([
            target.evaluate(async label => {
              return window.ASMTraceDebugRecorder.recordAllFrames({ label, sampleIntervalMs: 16,
                maxSamples: 30000, includeTraceDocument: false });
            }, label),
            new Promise((_, reject) => { recordingTimeout = setTimeout(() => reject(
              new Error('動畫播放超過 180 秒，可能有未完成的等待或排程')), 180000); })
          ]).finally(() => clearTimeout(recordingTimeout));
          const verdict = validate(report);
          if (item.name === 'arrow-identity') {
            const checks = await target.evaluate(() => window.__arrowChecks);
            report.arrowChecks = checks;
            if (!checks.rebound || !checks.follow || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push({ kind: 'arrow-identity-transition', checks });
            }
          }
          if (item.name === 'quick-style-swap') {
            const checks = await target.evaluate(() => window.__swapPaintChecks);
            report.swapPaintChecks = checks;
            if (!checks.heldSamples || !checks.transitionSamples || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures
                : [{ kind: 'swap-paint-no-timing-samples', checks }]));
            }
          }
          if (item.name === 'function-call') {
            const checks = await target.evaluate(() => window.__callCodeChecks);
            if (checks.samples < 2 || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures
                : [{ kind: 'function-call-no-samples' }]));
            }
            report.callCodeChecks = checks;
          }
          if (item.name === 'insertion-style-labels') {
            const checks = await target.evaluate(() => {
              window.__labelPaintSampling = false;
              return window.__labelPaintChecks;
            });
            report.labelPaintChecks = checks;
            if (!checks.samples || !checks.transitions || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures.slice(0,5)
                : [{ kind:'label-paint-no-samples', checks }]));
            }
          }
          if (item.name === 'highlight-swap') {
            await target.evaluate(() => { window.__highlightPaintSampling = false; });
            const checks = await target.evaluate(() => window.__highlightSwapChecks);
            if (!checks.samples || !checks.ghostSamples || !checks.indexSamples
              || !checks.motionSamples || !checks.scaleSamples || !checks.rhythmSamples
              || !checks.paintTransitionSamples || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures.slice(0, 5)
                : [{ kind: 'highlight-swap-no-samples', checks }]));
            }
            report.highlightChecks = checks;
          }
          if (item.name === 'recursive-roles') {
            const checks = await target.evaluate(() => window.__recursiveRoleChecks);
            report.recursiveRoleChecks = checks;
            if (!checks.handoffs || !checks.markers || !checks.scalars || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures.slice(0, 5)
                : [{ kind: 'recursive-role-no-samples', checks }]));
            }
          }
          if (item.name === 'style-frame-completion') {
            const checks = await target.evaluate(() => {
              const checks = window.__styleCompletionChecks;
              const trace = window.ASMTracePlayer.getDocument();
              const arr = Object.keys(trace.variables).find(id => trace.variables[id].name === 'arr');
              const root = document.getElementById('asm-trace-root');
              for (const suffix of ['#0', '#0:index']) {
                const cell = root.querySelector(`[data-trace-object-key="${CSS.escape(arr + suffix)}"]`);
                const fill = cell?.querySelector(':scope > rect')?.getAttribute('fill');
                if (fill !== 'rgba(239, 154, 154, 0.6)') checks.failures.push({
                  kind: 'style-frame-final-paint', key: arr + suffix, fill
                });
              }
              return checks;
            });
            report.styleCompletionChecks = checks;
            if (!checks.samples || checks.failures.length) {
              verdict.pass = false;
              verdict.violations.push(...(checks.failures.length ? checks.failures.slice(0, 5)
                : [{ kind: 'style-completion-no-samples', checks }]));
            }
          }
          const settled = report.samples.filter(sample => sample.reason === 'playback-complete')
            .map(sample => ({ frameId: sample.frameId,
              objects: sample.objects.map(object => [object.key, object.displayValue,
                object.effectiveOpacity, object.primitives?.map(primitive => primitive.attributes.fill)])
                .sort((a, b) => a[0].localeCompare(b[0])),
              events: sample.code?.lines?.flatMap(line => line.events || []).map(event => [event.ids, event.classes]) }));
          if (!settled.length) throw new Error('沒有任何播放完成檢查點');
          if (mode === 'algorithm') baseline = settled;
          else if (JSON.stringify(settled) !== JSON.stringify(baseline)) {
            verdict.pass = false;
            verdict.violations.push({ kind: 'surface-parity', message: '與 algorithm 的完成畫面不同' });
          }
          if (errors.length) { verdict.pass = false; verdict.violations.push({ kind: 'console', errors }); }
          fs.writeFileSync(path.join(output, label + '.json'), JSON.stringify({ verdict, report }, null, 2));
          if (!verdict.pass) {
            const index = report.samples.findIndex(sample => sample.sequence === verdict.firstViolation?.sequence);
            fs.writeFileSync(path.join(output, label + '-failure-window.json'), JSON.stringify({
              firstViolation: verdict.firstViolation || verdict.violations[0],
              samples: index < 0 ? [] : report.samples.slice(Math.max(0, index - 3), index + 4)
            }, null, 2));
          }
          await page.screenshot({ path: path.join(output, label + '.png') });
          results.push({ label, pass: verdict.pass, sampleCount: report.samples.length,
            firstViolation: verdict.firstViolation || verdict.violations[0] || null });
          if (!verdict.pass) failures.push(label);
          console.log(`${verdict.pass ? 'PASS' : 'FAIL'} ${label} (${report.samples.length} samples)`);
        } catch (error) {
          failures.push(label);
          results.push({ label, pass: false, error: error.message });
          await page.screenshot({ path: path.join(output, label + '.png') }).catch(() => {});
          console.error(`FAIL ${label}: ${error.message}`);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(output, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(`動畫驗證報告：${output}`);
  if (failures.length) throw new Error(`實際動畫驗證失敗：${failures.join(', ')}`);
}
module.exports = { runAnimationBrowser };
if (require.main === module) runAnimationBrowser(process.env.ASM_TEST_BASE_URL || 'http://localhost:3000')
  .catch(error => { console.error(error.message); process.exitCode = 1; });
