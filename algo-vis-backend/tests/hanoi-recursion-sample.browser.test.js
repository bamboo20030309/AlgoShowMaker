const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { compile } = require('./helpers/compile');

test('Hanoi sample draws three disk pegs left of the completed recursion tree', { timeout: 60000 }, async () => {
  const base = process.env.ASM_TEST_BASE_URL;
  assert.ok(base, 'set ASM_TEST_BASE_URL to an isolated server');
  const code = fs.readFileSync(path.join(
    __dirname, '../algorithm_sample/Backtracking/hanoi-recursion.cpp'
  ), 'utf8');
  const { trace } = await compile(code, '4\n');
  const browser = await chromium.launch({
    headless: true,
    ...(process.platform === 'win32' ? { channel: 'msedge' } : {})
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    await page.goto(`${base}/algorithm.html`);
    const scene = await page.evaluate(async sourceTrace => {
      const document = window.ASMTraceModel.normalizeTraceDocument(sourceTrace);
      const frameSixCodePlan = window.ASMTraceCodeModel.planFrame(document, document.frames[5]);
      const frameSevenCodePlan = window.ASMTraceCodeModel.planFrame(document, document.frames[6]);
      window.ASMTraceCodePresenter.renderFrame(document, document.frames[5]);
      const frameSevenCodeDelay = window.ASMTraceCodePresenter.transitionDelay(
        document, document.frames[6]
      );
      const pegIds = Object.fromEntries(Object.entries(document.variables)
        .filter(([, variable]) => ['Peg_A', 'Peg_B', 'Peg_C'].includes(variable.name))
        .map(([id, variable]) => [variable.name, id]));
      const parameterIds = Object.fromEntries(Object.entries(document.variables)
        .filter(([, variable]) => ['from', 'to'].includes(variable.name))
        .map(([id, variable]) => [variable.name, id]));
      const diskValues = (candidate, variableId) => (
        candidate.state?.[variableId]?.data?.items || []
      ).map(item => Number(item.value));
      const visualOwnerId = element => element?.closest('[data-trace-variable]')
        ?.dataset.traceVariable || element?.closest('[data-trace-animation-owner-variable]')
        ?.dataset.traceAnimationOwnerVariable || '';
      const handoffTransitionProbe = async (fromIndex, toIndex) => {
        const previous = document.frames[fromIndex];
        const current = document.frames[toIndex];
        await window.ASMTraceRenderers.renderFrame(document, previous, null, {
          animatePositions: false, animateEvents: false
        });
        const transition = window.ASMTraceRenderers.renderFrame(document, current, previous, {
          animatePositions: true, animateEvents: true
        });
        const samples = [];
        const sampleDiskTwo = elapsed => {
          const diskOne = [...window.document.querySelectorAll('[data-trace-visual-continuity-key="disk:1"]')]
            .find(cell => document.variables[
              visualOwnerId(cell)
            ]?.name === 'Peg_C');
          const diskTwo = [...window.document.querySelectorAll('[data-trace-visual-continuity-key="disk:2"]')]
            .find(cell => document.variables[
              visualOwnerId(cell)
            ]?.name === 'Peg_C');
          return {
            elapsed,
            diskOneFill: diskOne?.querySelector('rect')
              ? getComputedStyle(diskOne.querySelector('rect')).fill : '',
            diskOneMoving: Boolean(diskOne?.closest('.asm-trace-animation-effect-layer')),
            fill: diskTwo?.querySelector('rect')
              ? getComputedStyle(diskTwo.querySelector('rect')).fill : '',
            diskTwoMoving: Boolean(diskTwo?.closest('.asm-trace-animation-effect-layer')),
            position: diskTwo ? (() => {
              const box = diskTwo.getBoundingClientRect();
              return { x: box.x, y: box.y };
            })() : null
          };
        };
        for (let elapsed = 0; elapsed <= 600; elapsed += 100) {
          if (elapsed) await new Promise(resolve => setTimeout(resolve, 100));
          samples.push(sampleDiskTwo(elapsed));
        }
        await transition;
        samples.push(sampleDiskTwo('settled'));
        return {
          samples,
          motionEvents: transition.playbackPlan?.phases
            ?.find(phase => phase.id === 'visual-motions')?.steps || []
        };
      };
      const transition31to32 = await handoffTransitionProbe(30, 31);
      await window.ASMTraceRenderers.renderFrame(document, document.frames[15], null, {
        animatePositions: false, animateEvents: false
      });
      const transition16to17 = window.ASMTraceRenderers.renderFrame(
        document, document.frames[16], document.frames[15],
        { animatePositions: true, animateEvents: true }
      );
      await new Promise(resolve => setTimeout(resolve, 120));
      const transition16to17MovingFills = [...window.document.querySelectorAll(
        '.asm-trace-animation-effect-layer [data-trace-visual-continuity-key^="disk:"] rect'
      )].map(rect => getComputedStyle(rect).fill);
      await transition16to17;
      const postLandingPaintProbe = async () => {
        await window.ASMTraceRenderers.renderFrame(document, document.frames[10], null, {
          animatePositions: false, animateEvents: false
        });
        const transition = window.ASMTraceRenderers.renderFrame(
          document, document.frames[11], document.frames[10],
          { animatePositions: true, animateEvents: true }
        );
        const samples = [];
        const diskSample = value => {
          const element = [...window.document.querySelectorAll(
            `[data-trace-visual-continuity-key="disk:${value}"]`
          )].find(cell => document.variables[
            visualOwnerId(cell)
          ]?.name === 'Peg_A');
          return {
            fill: element?.querySelector(':scope > rect')
              ? getComputedStyle(element.querySelector(':scope > rect')).fill : '',
            moving: Boolean(element?.closest('.asm-trace-animation-effect-layer'))
          };
        };
        for (let elapsed = 0; elapsed <= 660; elapsed += 30) {
          if (elapsed) await new Promise(resolve => setTimeout(resolve, 30));
          samples.push({ elapsed, one: diskSample(1), two: diskSample(2) });
        }
        await transition;
        return {
          samples,
          settled: { one: diskSample(1), two: diskSample(2) },
          motionPhase: transition.playbackPlan?.phases?.find(
            phase => phase.id === 'visual-motions'
          ) || null,
          paintPhase: transition.playbackPlan?.phases?.find(
            phase => phase.id === 'style-paint-transition'
          ) || null
        };
      };
      const transition11to12Paint = await postLandingPaintProbe();
      const playerProbe = async (fromIndex, toIndex) => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.renderStable(fromIndex);
        await new Promise(resolve => setTimeout(resolve, 50));
        const samples = [];
        const transition = window.ASMTracePlayer.render(toIndex, { fromIndex });
        for (let elapsed = 0; elapsed <= 700; elapsed += 100) {
          if (elapsed) await new Promise(resolve => setTimeout(resolve, 100));
          const ansId = Object.entries(document.variables)
            .find(([, variable]) => variable.name === 'ans')?.[0] || '';
          const ans = window.document.querySelector(`[data-trace-object-key="${ansId}"]`);
          const box = ans?.getBoundingClientRect?.();
          samples.push({
            elapsed,
            ansRect: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
            viewportTransform: window.document.querySelector('#viewport')?.getAttribute('transform') || '',
            arrows: window.document.querySelectorAll('.asm-trace-directive-arrows .asm-trace-arrow').length,
            arrowOpacities: [...window.document.querySelectorAll(
              '.asm-trace-directive-arrows .asm-trace-arrow'
            )].map(arrow => getComputedStyle(arrow).opacity)
          });
        }
        await transition;
        return samples;
      };
      const player21to22 = await playerProbe(20, 21);
      const rapidNextProbe = async (startIndex, sample) => {
        window.ASMTracePlayer.apply(sourceTrace);
        await window.ASMTracePlayer.renderStable(startIndex);
        const first = window.CodeScript.next();
        await new Promise(resolve => setTimeout(resolve, 90));
        const second = window.CodeScript.next();
        await new Promise(resolve => setTimeout(resolve, 20));
        const during = sample();
        await Promise.allSettled([first, second]);
        return { during, settled: sample() };
      };
      const rapid14to16 = await rapidNextProbe(13, () => ({
        frame: window.CodeScript.get_current_frame_index() + 1,
        pegCFills: [...window.document.querySelectorAll(
          `[data-trace-variable="${pegIds.Peg_C}"] [data-trace-visual-continuity-key^="disk:"] rect`
        )].map(rect => getComputedStyle(rect).fill)
      }));
      window.ASMTracePlayer.apply(sourceTrace);
      await window.ASMTracePlayer.renderStable(15);
      const recursionNamesBefore = new Map([...window.document.querySelectorAll(
        '#arraySvg #asm-trace-root [data-trace-object-key$=":label"]'
      )].map(element => [element.dataset.traceObjectKey, {
        text: element.textContent,
        ownerKey: element.closest('.asm-trace-object')?.dataset.traceObjectKey || ''
      }]));
      const recursionEntrance = window.CodeScript.next();
      await new Promise(resolve => setTimeout(resolve, 20));
      const recursionNameEntrances = [...window.document.querySelectorAll(
        '#arraySvg #asm-trace-root [data-trace-object-key$=":label"]'
      )].map(element => {
        const owner = element.closest('.asm-trace-object');
        const motion = owner?.querySelector(':scope > .asm-trace-motion');
        const before = recursionNamesBefore.get(element.dataset.traceObjectKey);
        return {
          text: element.textContent,
          key: element.dataset.traceObjectKey,
          ownerKey: owner?.dataset.traceObjectKey || '',
          existed: Boolean(before && before.ownerKey === owner?.dataset.traceObjectKey),
          appearing: element.dataset.traceAppearing || '',
          labelOpacity: getComputedStyle(element).opacity,
          ownerOpacity: owner ? getComputedStyle(owner).opacity : '',
          motionOpacity: motion ? getComputedStyle(motion).opacity : ''
        };
      });
      await recursionEntrance;
      const rapid18to20 = await rapidNextProbe(17, () => {
        const fill = (owner, value) => {
          const cell = [...window.document.querySelectorAll(
            `[data-trace-visual-continuity-key="disk:${value}"]`
          )].find(candidate => visualOwnerId(candidate) === pegIds[owner]);
          return cell?.querySelector('rect')
            ? getComputedStyle(cell.querySelector('rect')).fill : '';
        };
        return {
          frame: window.CodeScript.get_current_frame_index() + 1,
          pegA2: fill('Peg_A', 2),
          pegB1: fill('Peg_B', 1)
        };
      });
      // The rapid navigation probe intentionally starts camera animations.
      // Let that independent viewport motion settle before measuring the
      // root's object-local keep handoff below.
      await new Promise(resolve => setTimeout(resolve, 600));
      const rootDefinition = document.snapshots.find(snapshot => !snapshot.layoutNode?.parentSnapshotId);
      const rootEntryFrame = document.frames[0];
      await window.ASMTraceRenderers.renderFrame(document, rootEntryFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const rootEntryText = window.document.querySelector('.asm-trace-text-object');
      const rootEntryObjectKey = rootEntryFrame.source?.objectIds?.[
        rootEntryFrame.source?.primaryVariableId
      ] || rootEntryFrame.source?.primaryVariableId || '';
      const rootEntry = {
        isFirstFrame: document.frames[0]?.id === rootEntryFrame?.id,
        narrative: [...window.document.querySelectorAll('.asm-trace-text-object text')]
          .map(text => text.textContent).join('\n'),
        textPlacement: window.ASMTraceRenderers.currentPlacement(
          rootEntryText?.dataset.traceObjectKey || ''
        ),
        rootPlacement: window.ASMTraceRenderers.currentPlacement(rootEntryObjectKey)
      };
      const rootEntryElement = window.document.querySelector(
        `[data-trace-object-key="${rootEntryObjectKey}"]`
      );
      const rootEntryScreenY = rootEntryElement?.getBoundingClientRect?.().y;
      const rootKeepTransition = window.ASMTraceRenderers.renderFrame(
        document, document.frames[1], rootEntryFrame,
        { animatePositions: true, animateEvents: true }
      );
      await new Promise(resolve => setTimeout(resolve, 30));
      const rootSnapshotElement = window.document.querySelector(
        `[data-trace-object-key="${rootDefinition.objectId}"]`
      );
      const rootKeepHandoff = {
        beforeY: rootEntryScreenY,
        duringY: rootSnapshotElement?.getBoundingClientRect?.().y,
        motion: rootSnapshotElement?.querySelector(':scope > .asm-trace-motion')
          ?.getAttribute('transform') || '',
        nonRootNames: [...window.document.querySelectorAll('.outerframe-label')]
          .filter(element => element.textContent !== 'H')
          .map(element => ({
            text: element.textContent,
            opacity: getComputedStyle(element).opacity,
            appearing: element.dataset.traceAppearing || ''
          }))
      };
      await rootKeepTransition;
      const rootProcessingFrame = document.frames.find(candidate => candidate.id === rootDefinition.createdFrameId);
      await window.ASMTraceRenderers.renderFrame(document, rootProcessingFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const rootProcessingText = window.document.querySelector('.asm-trace-text-object');
      const rootProcessing = {
        narrative: [...window.document.querySelectorAll('.asm-trace-text-object text')]
          .map(text => text.textContent).join('\n'),
        textPlacement: window.ASMTraceRenderers.currentPlacement(
          rootProcessingText?.dataset.traceObjectKey || ''
        ),
        rootPlacement: window.ASMTraceRenderers.currentPlacement(rootDefinition.objectId)
      };
      const rootPreviewFrames = document.frames.filter(candidate => (
        candidate.source?.systemBranchPreview
          && candidate.source?.recursionParentActivationId === rootDefinition.recursionActivationId
      )).sort((left, right) => left.source.recursionSiblingIndex - right.source.recursionSiblingIndex);
      const rootPreviews = [];
      for (const candidate of rootPreviewFrames) {
        await window.ASMTraceRenderers.renderFrame(document, candidate, null, {
          animatePositions: false,
          animateEvents: false
        });
        const previewSnapshot = document.snapshots.find(snapshot => (
          snapshot.id === candidate.source.previewSnapshotId
        ));
        const previewElement = window.document.querySelector(
          `[data-trace-object-key="${previewSnapshot?.objectId || ''}"]`
        );
        const narrativeElement = window.document.querySelector('.asm-trace-text-object');
        const diskColors = [...window.document.querySelectorAll(
          '[data-layout="disk"] [data-trace-visual-continuity-key]'
        )].map(cell => {
          const ownerId = visualOwnerId(cell);
          return {
            owner: document.variables[ownerId]?.name || ownerId,
            value: Number(cell.dataset.traceDataValue),
            fill: cell.querySelector('rect')?.getAttribute('fill') || ''
          };
        }).sort((left, right) => left.owner.localeCompare(right.owner) || left.value - right.value);
        rootPreviews.push({
          pegs: ['Peg_A', 'Peg_B', 'Peg_C'].map(name => diskValues(candidate, pegIds[name])),
          nodeText: [...(previewElement?.querySelectorAll('text') || [])].map(text => text.textContent).join(' '),
          narrative: [...window.document.querySelectorAll('.asm-trace-text-object text')]
            .map(text => text.textContent).join('\n'),
          narrativePlacement: window.ASMTraceRenderers.currentPlacement(
            narrativeElement?.dataset.traceObjectKey || ''
          ),
          narrativeTarget: narrativeElement?.dataset.traceBindingTarget || '',
          narrativeBackgrounds: [...(narrativeElement?.querySelectorAll(
            '.asm-trace-text-segment-background'
          ) || [])].map(rect => rect.getAttribute('fill')),
          diskColors,
          rootPlacement: window.ASMTraceRenderers.currentPlacement(rootDefinition.objectId),
          childObjectId: previewSnapshot?.objectId || '',
          childPlacement: window.ASMTraceRenderers.currentPlacement(previewSnapshot?.objectId || ''),
          highlights: window.document.querySelectorAll('.asm-trace-style-highlight').length,
          points: window.document.querySelectorAll('.asm-trace-style-point').length
        });
      }
      const actualDepthOneFrame = document.frames.find(candidate => (
        candidate.source?.recursionDepth === 1 && !candidate.source?.systemBranchPreview
      ));
      await window.ASMTraceRenderers.renderFrame(document, actualDepthOneFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const actualDepthOneNarrative = [...window.document.querySelectorAll(
        '.asm-trace-text-object text'
      )].map(text => text.textContent).join('\n');
      const handoffIndex = document.frames.indexOf(rootPreviewFrames.at(-1)) + 1;
      const handoffFrame = document.frames[handoffIndex];
      await window.ASMTraceRenderers.renderFrame(document, handoffFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const handoff = {
        pegs: ['Peg_A', 'Peg_B', 'Peg_C'].map(name => diskValues(handoffFrame, pegIds[name])),
        fills: [...window.document.querySelectorAll(
          '[data-layout="disk"] [data-trace-visual-continuity-key] rect'
        )].map(rect => rect.getAttribute('fill')),
        narrative: [...window.document.querySelectorAll('.asm-trace-text-object text')]
          .map(text => text.textContent).join('\n'),
        highlights: window.document.querySelectorAll('.asm-trace-style-highlight').length,
        points: window.document.querySelectorAll('.asm-trace-style-point').length
      };
      const restoredFrame = document.frames[handoffIndex + 1];
      const restoredPegs = ['Peg_A', 'Peg_B', 'Peg_C']
        .map(name => diskValues(restoredFrame, pegIds[name]));
      const transferIndex = document.frames.findIndex((candidate, index) => {
        if (!index) return false;
        return ['Peg_A', 'Peg_B', 'Peg_C'].some(name => (
          JSON.stringify(diskValues(candidate, pegIds[name]))
            !== JSON.stringify(diskValues(document.frames[index - 1], pegIds[name]))
        ));
      });
      const transfer = [];
      for (const candidate of [document.frames[transferIndex - 1], document.frames[transferIndex]]) {
        await window.ASMTraceRenderers.renderFrame(document, candidate, null, {
          animatePositions: false,
          animateEvents: false
        });
        const cell = window.document.querySelector('[data-trace-visual-continuity-key="disk:1"]');
        transfer.push({
          continuity: cell?.dataset.traceVisualContinuityKey || '',
          owner: visualOwnerId(cell)
        });
      }
      const actualTransferIndex = document.frames.findIndex((candidate, index) => {
        if (!index || candidate.source?.systemBranchPreview) return false;
        const previous = document.frames[index - 1];
        return JSON.stringify(diskValues(previous, pegIds.Peg_A)) === '[1,2,3,4]'
          && JSON.stringify(diskValues(previous, pegIds.Peg_B)) === '[]'
          && JSON.stringify(diskValues(candidate, pegIds.Peg_A)) === '[2,3,4]'
          && JSON.stringify(diskValues(candidate, pegIds.Peg_B)) === '[1]';
      });
      const styleTransferPrevious = document.frames[actualTransferIndex - 1];
      const styleTransferCurrent = document.frames[actualTransferIndex];
      await window.ASMTraceRenderers.renderFrame(document, styleTransferPrevious, null, {
        animatePositions: false,
        animateEvents: false
      });
      const styleTransition = window.ASMTraceRenderers.renderFrame(
        document, styleTransferCurrent, styleTransferPrevious,
        { animatePositions: true, animateEvents: true }
      );
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const transitionDisk = (owner, value) => [...window.document.querySelectorAll(
        `[data-trace-visual-continuity-key="disk:${value}"]`
      )].find(cell => visualOwnerId(cell) === pegIds[owner]);
      const diskOneRect = transitionDisk('Peg_B', 1)?.querySelector('rect');
      const diskTwoRect = transitionDisk('Peg_A', 2)?.querySelector('rect');
      const styleTransfer = {
        fromFrame: actualTransferIndex,
        toFrame: actualTransferIndex + 1,
        diskOneFill: diskOneRect ? getComputedStyle(diskOneRect).fill : '',
        diskTwoFill: diskTwoRect ? getComputedStyle(diskTwoRect).fill : ''
      };
      await styleTransition;
      styleTransfer.diskTwoFinalFill = diskTwoRect ? getComputedStyle(diskTwoRect).fill : '';
      await window.ASMTraceRenderers.renderFrame(document, document.frames[18], null, {
        animatePositions: false, animateEvents: false
      });
      const synchronizedPaintTransition = window.ASMTraceRenderers.renderFrame(
        document, document.frames[19], document.frames[18],
        { animatePositions: true, animateEvents: true }
      );
      const synchronizedPaintSample = () => Object.fromEntries([
        ['Peg_A', 2], ['Peg_B', 1]
      ].map(([owner, value]) => {
        const cell = [...window.document.querySelectorAll(
          `[data-trace-visual-continuity-key="disk:${value}"]`
        )].find(candidate => visualOwnerId(candidate) === pegIds[owner]);
        return [`${owner}:${value}`, cell?.querySelector('rect')
          ? getComputedStyle(cell.querySelector('rect')).fill : ''];
      }));
      await new Promise(resolve => requestAnimationFrame(resolve));
      const synchronizedDiskPaints = { start: synchronizedPaintSample() };
      await new Promise(resolve => setTimeout(resolve, 90));
      synchronizedDiskPaints.middle = synchronizedPaintSample();
      await synchronizedPaintTransition;
      synchronizedDiskPaints.final = synchronizedPaintSample();
      synchronizedDiskPaints.motionEvents = synchronizedPaintTransition.playbackPlan?.phases
        ?.find(phase => phase.id === 'visual-motions')?.steps || [];
      window.ASMTracePlayer.apply(sourceTrace);
      await window.ASMTracePlayer.renderStable(18);
      const playerSynchronizedPaintTransition = window.ASMTracePlayer.render(19, { fromIndex: 18 });
      await new Promise(resolve => requestAnimationFrame(resolve));
      const playerSynchronizedDiskPaints = { start: synchronizedPaintSample() };
      await new Promise(resolve => setTimeout(resolve, 90));
      playerSynchronizedDiskPaints.middle = synchronizedPaintSample();
      await playerSynchronizedPaintTransition;
      playerSynchronizedDiskPaints.final = synchronizedPaintSample();
      await window.ASMTraceRenderers.renderFrame(document, styleTransferPrevious, null, {
        animatePositions: false, animateEvents: false
      });
      const crossPegTransition = window.ASMTraceRenderers.renderFrame(
        document, styleTransferCurrent, styleTransferPrevious,
        { animatePositions: true, animateEvents: true }
      );
      await new Promise(resolve => setTimeout(resolve, 120));
      const effectLayer = window.document.querySelector('.asm-trace-animation-effect-layer');
      const sceneRoot = window.document.querySelector('#asm-trace-root');
      const destinationPegElement = [...(sceneRoot?.children || [])].find(element => (
        document.variables[element.dataset?.traceVariable]?.name === 'Peg_B'
      ));
      const crossPegLayering = {
        movedDisks: [...(effectLayer?.querySelectorAll(
          '[data-trace-visual-continuity-key^="disk:"]'
        ) || [])].map(element => element.dataset.traceVisualContinuityKey),
        movingFills: [...(effectLayer?.querySelectorAll(
          '[data-trace-visual-continuity-key^="disk:"] rect'
        ) || [])].map(rect => getComputedStyle(rect).fill),
        effectLayerIndex: [...(sceneRoot?.children || [])].indexOf(effectLayer),
        pegCIndex: [...(sceneRoot?.children || [])].indexOf(destinationPegElement)
      };
      await crossPegTransition;
      crossPegLayering.finalFills = [...window.document.querySelectorAll(
        '[data-trace-visual-continuity-key^="disk:"]'
      )].sort((left, right) => Number(left.dataset.traceDataValue)
        - Number(right.dataset.traceDataValue))
        .map(element => getComputedStyle(element.querySelector('rect')).fill);
      const previewStylePrevious = document.frames[1];
      const previewStyleCurrent = document.frames[2];
      await window.ASMTraceRenderers.renderFrame(document, previewStylePrevious, null, {
        animatePositions: false,
        animateEvents: false
      });
      const previousDiskFour = [...window.document.querySelectorAll(
        '[data-trace-visual-continuity-key="disk:4"]'
      )].find(cell => visualOwnerId(cell) === pegIds.Peg_A);
      const previousDiskFourFill = previousDiskFour?.querySelector('rect')
        ? getComputedStyle(previousDiskFour.querySelector('rect')).fill : '';
      const previewTransition = window.ASMTraceRenderers.renderFrame(
        document, previewStyleCurrent, previewStylePrevious,
        { animatePositions: true, animateEvents: true }
      );
      const previewStyleSamples = [];
      for (let elapsed = 0; elapsed <= 720; elapsed += 60) {
        if (elapsed) await new Promise(resolve => setTimeout(resolve, 60));
        const diskFour = [...window.document.querySelectorAll(
          '[data-trace-visual-continuity-key="disk:4"]'
        )].find(cell => visualOwnerId(cell) === pegIds.Peg_A);
        const rect = diskFour?.querySelector('rect');
        previewStyleSamples.push({
          elapsed,
          fill: rect ? getComputedStyle(rect).fill : ''
        });
      }
      await previewTransition;
      const twoDiskFrame = document.frames.find(candidate => {
        const variableId = candidate.source?.primaryVariableId;
        return variableId
          && Number(window.ASMTraceModel.scalarValue(candidate.state?.[variableId]?.data)) === 2
          && window.ASMTraceModel.scalarValue(candidate.state?.[parameterIds.from]?.data) === 'A'
          && window.ASMTraceModel.scalarValue(candidate.state?.[parameterIds.to]?.data) === 'C'
          && !candidate.source?.branchId;
      });
      await window.ASMTraceRenderers.renderFrame(document, twoDiskFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const twoDiskColors = [...window.document.querySelectorAll(
        '[data-layout="disk"] [data-trace-visual-continuity-key]'
      )].map(cell => ({
        value: Number(cell.dataset.traceDataValue),
        fill: cell.querySelector('rect')?.getAttribute('fill') || ''
      })).sort((left, right) => left.value - right.value);
      const finalFrame = document.frames.at(-1);
      await window.ASMTraceRenderers.renderFrame(document, finalFrame, null, {
        animatePositions: false,
        animateEvents: false
      });
      const disks = [...window.document.querySelectorAll('[data-layout="disk"]')].map(group => {
        const object = group.closest('[data-trace-object-key]');
        const key = object?.dataset.traceObjectKey || '';
        return {
          key,
          name: document.variables[key]?.name || key,
          cells: group.querySelectorAll('[id^="cell-"]').length,
          hasBase: Boolean(group.querySelector('.disk-base')),
          hasPeg: Boolean(group.querySelector('.disk-peg')),
          backgroundOrder: [...group.children].slice(0, 2).map(child => child.classList[0]),
          pegHeight: Number(group.querySelector('.disk-peg')?.getAttribute('height')),
          placement: window.ASMTraceRenderers.currentPlacement(key)
        };
      });
      const snapshots = [...window.document.querySelectorAll('.asm-trace-snapshot')]
        .map(element => {
          const key = element.dataset.traceObjectKey;
          const topLeft = window.ASMTraceRenderers.currentAnchorForKey(key, 'top-left');
          const bottomRight = window.ASMTraceRenderers.currentAnchorForKey(key, 'bottom-right');
          return topLeft && bottomRight ? {
            x: topLeft.x,
            y: topLeft.y,
            width: bottomRight.x - topLeft.x,
            height: bottomRight.y - topLeft.y
          } : null;
        }).filter(Boolean);
      const snapshotById = new Map(document.snapshots.map(snapshot => [snapshot.id, snapshot]));
      const visibleSnapshots = finalFrame.snapshotIds.map(id => snapshotById.get(id)).filter(Boolean);
      const nodeVisuals = visibleSnapshots.map(snapshot => {
        const element = window.document.querySelector(`[data-trace-object-key="${snapshot.objectId}"]`);
        return {
          label: snapshot.label,
          texts: [...(element?.querySelectorAll('text') || [])].map(text => text.textContent),
          fills: [...(element?.querySelectorAll('rect') || [])].map(rect => rect.getAttribute('fill'))
        };
      });
      const rootSnapshot = visibleSnapshots.find(snapshot => !snapshot.layoutNode?.parentSnapshotId);
      const rootPlacement = window.ASMTraceRenderers.currentPlacement(rootSnapshot?.objectId || '');
      const rootAnchor = window.ASMTraceRenderers.currentAnchorForKey(
        rootSnapshot?.objectId || '', 'left'
      );
      const ansId = Object.entries(document.variables)
        .find(([, variable]) => variable.name === 'ans')?.[0] || '';
      const answerPlacements = (finalFrame.state?.[ansId]?.data?.items || []).map((_, index) => (
        window.ASMTraceRenderers.currentPlacement(`${ansId}#${index}`)
      ));
      const answerPlacement = window.ASMTraceRenderers.currentPlacement(ansId);
      const directiveArrows = [...window.document.querySelectorAll('.asm-trace-directive-arrows .asm-trace-arrow')];
      const diskFills = [...window.document.querySelectorAll('[data-layout="disk"] [data-trace-visual-continuity-key] rect')]
        .map(rect => rect.getAttribute('fill'));
      const finalHighlights = window.document.querySelectorAll('.asm-trace-style-highlight').length;
      const finalPoints = window.document.querySelectorAll('.asm-trace-style-point').length;
      return {
        disks,
        treeLeft: Math.min(...snapshots.map(box => box.x)),
        treeTop: Math.min(...snapshots.map(box => box.y)),
        treeRight: Math.max(...snapshots.map(box => box.x + box.width)),
        rootPlacement,
        rootAnchor,
        nodeCount: snapshots.length,
        rootObjectId: rootDefinition.objectId,
        edgeCount: window.document.querySelectorAll('.asm-trace-layout-edge').length,
        flowCount: window.document.querySelectorAll('.asm-trace-recursion-flow-arrow').length,
        nodeVisuals,
        answerPlacements,
        answerPlacement,
        answerArrowCount: directiveArrows.length,
        answerArrowSources: directiveArrows.map(arrow => arrow.dataset.traceArrowFromKey),
        answerArrowTargets: directiveArrows.map(arrow => arrow.dataset.traceArrowToKey),
        diskFills,
        finalHighlights,
        finalPoints,
        twoDiskColors,
        transfer,
        styleTransfer,
        synchronizedDiskPaints,
        playerSynchronizedDiskPaints,
        crossPegLayering,
        previewStyleSamples,
        previousDiskFourFill,
        rootEntry,
        rootKeepHandoff,
        rootProcessing,
        rootPreviews,
        actualDepthOneNarrative,
        handoff,
        restoredPegs,
        transition31to32,
        transition16to17MovingFills,
        transition11to12Paint,
        player21to22,
        rapid14to16,
        recursionNameEntrances,
        rapid18to20,
        frameSixId: document.frames[5].id,
        frameSixCodeLayout: frameSixCodePlan.layoutKey,
        frameSevenCodeLayout: frameSevenCodePlan.layoutKey,
        frameSevenCodeFragments: frameSevenCodePlan.fragments.length,
        frameSevenInheritedFrom: frameSevenCodePlan.inheritedFromFrameId || '',
        frameSevenCodeDelay
      };
    }, trace);

    assert.deepEqual(scene.disks.map(disk => disk.name).sort(), ['Peg_A', 'Peg_B', 'Peg_C']);
    assert.deepEqual(Object.fromEntries(scene.disks.map(disk => [disk.name, disk.cells])), {
      Peg_A: 0,
      Peg_B: 0,
      Peg_C: 4
    });
    assert.ok(scene.disks.every(disk => disk.hasBase && disk.hasPeg),
      `empty and populated disk objects retain their peg geometry: ${JSON.stringify(scene)}`);
    assert.ok(scene.disks.every(disk => (
      disk.backgroundOrder[0] === 'disk-base' && disk.backgroundOrder[1] === 'disk-peg'
    )), `disk base and peg stay below every cell and decoration: ${JSON.stringify(scene.disks)}`);
    assert.deepEqual([...new Set(scene.disks.map(disk => disk.pegHeight))], [200],
      `capacity(N) keeps all three peg heights fixed: ${JSON.stringify(scene)}`);
    const pegALeft = scene.disks.find(disk => disk.name === 'Peg_A').placement.x;
    assert.ok(Math.abs((scene.treeLeft - pegALeft) - (360 - 70)) < 0.1,
      `Peg_A and the tree preserve their exact canvas-relative offsets: ${JSON.stringify(scene)}`);
    assert.ok(scene.disks.every(disk => disk.placement.x + disk.placement.width < scene.treeLeft),
      `all three disk objects remain left of the recursion tree: ${JSON.stringify(scene)}`);
    assert.ok(Math.abs(scene.rootAnchor.x - (90 + 360)) < 0.1,
      `root left stays on the authored x anchor: ${JSON.stringify(scene.rootAnchor)}`);
    assert.ok(Math.abs(scene.rootAnchor.y - (80 + 410)) < 0.1,
      `canvas.left + offset(360,100) pins the root center-left: ${JSON.stringify(scene.rootAnchor)}`);
    assert.ok(scene.answerPlacements.every(Boolean));
    assert.ok(scene.answerPlacements.slice(1).every((box, index) => (
      Math.abs(box.y - scene.answerPlacements[index].y) >= 107
    )), `answer rows retain a 68px vertical gap: ${JSON.stringify(scene.answerPlacements)}`);
    assert.ok(Math.abs(scene.answerPlacement.y - scene.treeTop) < 0.1,
      `ans aligns with the complete tree top: ${JSON.stringify(scene)}`);
    assert.ok(Math.abs(scene.answerPlacement.x - (scene.treeRight + 150)) < 0.1,
      `ans follows the complete tree right edge: ${JSON.stringify(scene)}`);
    assert.equal(scene.answerArrowCount, 15);
    assert.ok(scene.answerArrowSources.every(key => /#0$/.test(key)),
      `every Move arrow starts at cell 0: ${JSON.stringify(scene.answerArrowSources)}`);
    assert.ok(scene.answerArrowTargets.every(key => /#\d+$/.test(key)),
      `every retained Move arrow targets one answer row: ${JSON.stringify(scene.answerArrowTargets)}`);
    const moveNodes = scene.nodeVisuals.filter(node => node.label === 'Move');
    const otherNodes = scene.nodeVisuals.filter(node => node.label !== 'Move');
    assert.equal(moveNodes.length, 15);
    assert.ok(moveNodes.every(node => node.fills.includes('#a5d6a7')
      && node.texts.some(text => /^1, [ABC]→[ABC]$/.test(text))), JSON.stringify(moveNodes));
    assert.ok(otherNodes.every(node => node.fills.includes('#ef9a9a')),
      JSON.stringify(otherNodes));
    assert.deepEqual(scene.twoDiskColors, [
      { value: 1, fill: '#ef9a9a' },
      { value: 2, fill: '#a5d6a7' },
      { value: 3, fill: '#fff' },
      { value: 4, fill: '#fff' }
    ]);
    assert.ok(scene.diskFills.every(fill => fill === '#fff'), JSON.stringify(scene.diskFills));
    assert.deepEqual(scene.rootPreviews.map(preview => preview.pegs), [
      [[4], [1, 2, 3], []],
      [[], [1, 2, 3], [4]],
      [[], [], [1, 2, 3, 4]]
    ]);
    assert.deepEqual(scene.rootPreviews[0].diskColors, [
      { owner: 'Peg_A', value: 4, fill: '#a5d6a7' },
      { owner: 'Peg_B', value: 1, fill: '#ef9a9a' },
      { owner: 'Peg_B', value: 2, fill: '#ef9a9a' },
      { owner: 'Peg_B', value: 3, fill: '#ef9a9a' }
    ], 'the move-away preview colors the remaining bottom disk green and the three moved disks red');
    assert.deepEqual(scene.rootPreviews[2].diskColors, [
      { owner: 'Peg_C', value: 1, fill: '#ef9a9a' },
      { owner: 'Peg_C', value: 2, fill: '#ef9a9a' },
      { owner: 'Peg_C', value: 3, fill: '#ef9a9a' },
      { owner: 'Peg_C', value: 4, fill: '#a5d6a7' }
    ], 'the reconnect preview colors the upper three disks red and the bottom disk green');
    assert.match(scene.rootPreviews[0].nodeText, /3,A→B/);
    assert.match(scene.rootPreviews[1].nodeText, /1, A→C/);
    assert.match(scene.rootPreviews[2].nodeText, /3,B→C/);
    assert.match(scene.rootPreviews[0].narrative, /移花/);
    assert.match(scene.rootPreviews[1].narrative, /搬動底盤/);
    assert.match(scene.rootPreviews[2].narrative, /接木/);
    assert.doesNotMatch(scene.actualDepthOneNarrative, /河內塔遞迴的核心概念/,
      'the core concept appears only in the three initial root previews');
    assert.match(scene.rootEntry.narrative, /這是河內塔的遞迴範例/);
    assert.ok(Math.abs(scene.rootKeepHandoff.beforeY - scene.rootKeepHandoff.duringY) < 0.1,
      `adding highlight/point must not move the kept root: ${JSON.stringify(scene.rootKeepHandoff)}`);
    assert.equal(scene.rootKeepHandoff.motion, '',
      `the live-to-snapshot handoff needs no corrective translation: ${JSON.stringify(scene.rootKeepHandoff)}`);
    assert.ok(scene.rootKeepHandoff.nonRootNames.length > 0
      && scene.rootKeepHandoff.nonRootNames.every(name => (
        name.opacity === '1' && name.appearing === ''
      )), `unchanged non-root names must not re-enter: ${JSON.stringify(scene.rootKeepHandoff)}`);
    assert.equal(scene.rootEntry.isFirstFrame, true,
      'the preserved introduction is the first frame and already contains the root');
    assert.ok(scene.rootEntry.textPlacement.y + scene.rootEntry.textPlacement.height
      < scene.rootEntry.rootPlacement.y,
    `the first recursion text stays above the root: ${JSON.stringify(scene.rootEntry)}`);
    assert.match(scene.rootProcessing.narrative.replace(/\s+/g, ' '),
      /現在要處理將 4 個盤子從 A 移到 C/);
    assert.ok(scene.rootProcessing.textPlacement.y + scene.rootProcessing.textPlacement.height
      < scene.rootProcessing.rootPlacement.y,
    `the root processing text stays above the root: ${JSON.stringify(scene.rootProcessing)}`);
    assert.ok(scene.rootPreviews.every(preview => (
      preview.narrativeTarget === scene.rootObjectId
        && preview.narrativePlacement.y + preview.narrativePlacement.height < preview.rootPlacement.y
    )), `root previews stay fixed above their parent root: ${JSON.stringify(scene.rootPreviews)}`);
    assert.ok(scene.rootPreviews.every(preview => preview.narrativeTarget !== preview.childObjectId),
      JSON.stringify(scene.rootPreviews));
    assert.ok(scene.rootPreviews[0].narrativeBackgrounds.includes('#ef9a9a'));
    assert.ok(scene.rootPreviews[1].narrativeBackgrounds.includes('#a5d6a7'));
    assert.ok(scene.rootPreviews[2].narrativeBackgrounds.includes('#ef9a9a'));
    assert.ok(scene.rootPreviews.every(preview => preview.highlights === 1 && preview.points === 1),
      JSON.stringify(scene.rootPreviews));
    assert.deepEqual(scene.handoff.pegs, [[], [], [1, 2, 3, 4]]);
    assert.ok(scene.handoff.fills.every(fill => fill === '#fff'), JSON.stringify(scene.handoff));
    assert.match(scene.handoff.narrative.replace(/\s+/g, ' '), /由於沒辦法直接搬 3 個盤子/);
    assert.equal(scene.handoff.highlights, 1, JSON.stringify(scene.handoff));
    assert.equal(scene.handoff.points, 1, JSON.stringify(scene.handoff));
    assert.deepEqual(scene.restoredPegs, [[1, 2, 3, 4], [], []]);
    assert.equal(scene.finalHighlights, 0, 'highlight is not retained after processing ends');
    assert.equal(scene.finalPoints, 0, 'point is not retained after processing ends');
    assert.deepEqual(scene.transfer.map(item => item.continuity), ['disk:1', 'disk:1']);
    assert.notEqual(scene.transfer[0].owner, scene.transfer[1].owner,
      `the same disk identity moves between different peg objects: ${JSON.stringify(scene.transfer)}`);
    assert.deepEqual([scene.styleTransfer.fromFrame, scene.styleTransfer.toFrame], [18, 19]);
    assert.equal(scene.styleTransfer.diskOneFill, 'rgb(165, 214, 167)',
      `the moving disk keeps its green style: ${JSON.stringify(scene.styleTransfer)}`);
    assert.equal(scene.styleTransfer.diskTwoFill, 'rgb(255, 255, 255)',
      `the next disk must not inherit the departed cell's green style: ${JSON.stringify(scene.styleTransfer)}`);
    assert.equal(scene.styleTransfer.diskTwoFinalFill, 'rgb(255, 255, 255)');
    assert.notDeepEqual(scene.synchronizedDiskPaints.start, scene.synchronizedDiskPaints.final,
      `disk paint starts from the visible source color: ${JSON.stringify(scene.synchronizedDiskPaints)}`);
    assert.notDeepEqual(scene.synchronizedDiskPaints.middle, scene.synchronizedDiskPaints.start,
      `disk paint visibly interpolates after motion: ${JSON.stringify(scene.synchronizedDiskPaints)}`);
    assert.notDeepEqual(scene.synchronizedDiskPaints.middle, scene.synchronizedDiskPaints.final,
      `disk paint does not jump directly to its target: ${JSON.stringify(scene.synchronizedDiskPaints)}`);
    assert.deepEqual(scene.synchronizedDiskPaints.final, {
      'Peg_A:2': 'rgb(165, 214, 167)',
      'Peg_B:1': 'rgb(239, 154, 154)'
    }, 'all disk paints in frame 19→20 finish at the authored colors');
    assert.notEqual(scene.playerSynchronizedDiskPaints.middle['Peg_A:2'],
      scene.playerSynchronizedDiskPaints.start['Peg_A:2'],
      `the full player starts disk 2 paint with the frame: ${JSON.stringify(scene.playerSynchronizedDiskPaints)}`);
    assert.notEqual(scene.playerSynchronizedDiskPaints.middle['Peg_B:1'],
      scene.playerSynchronizedDiskPaints.start['Peg_B:1'],
      `the full player starts disk 1 paint with the same frame: ${JSON.stringify(scene.playerSynchronizedDiskPaints)}`);
    assert.deepEqual(scene.playerSynchronizedDiskPaints.final, {
      'Peg_A:2': 'rgb(165, 214, 167)',
      'Peg_B:1': 'rgb(239, 154, 154)'
    });
    assert.ok(scene.crossPegLayering.movedDisks.length > 0
      && scene.crossPegLayering.effectLayerIndex > scene.crossPegLayering.pegCIndex,
    `cross-peg disks stay above the destination peg while moving: ${JSON.stringify(scene.crossPegLayering)}`);
    assert.ok(scene.crossPegLayering.movingFills.length === scene.crossPegLayering.movedDisks.length
      && scene.crossPegLayering.movingFills.every(Boolean),
    `handoff disks keep valid interpolated paint while moving: ${JSON.stringify(scene.crossPegLayering)}`);
    assert.deepEqual(scene.crossPegLayering.finalFills, [
      'rgb(165, 214, 167)',
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)'
    ], `destination styles commit after the disks land: ${JSON.stringify(scene.crossPegLayering)}`);
    assert.ok(scene.previewStyleSamples.every(sample => sample.fill === scene.previousDiskFourFill),
      `disk 4 keeps its unchanged authored green style: ${JSON.stringify(scene.previewStyleSamples)}`);
    assert.ok(scene.transition31to32.samples.filter(sample => sample.diskOneMoving)
      .every(sample => sample.diskOneFill !== 'rgb(165, 214, 167)'),
    `frame 31→32 must not apply disk 1's destination green while it is moving: ${JSON.stringify(scene.transition31to32)}`);
    assert.ok(scene.transition31to32.motionEvents.some(event => (
      event.kind === 'visual-move' && event.subtype === 'cross-container'
    )), `frame 31→32 exposes cross-container visual-move events: ${JSON.stringify(scene.transition31to32.motionEvents)}`);
    assert.equal(scene.transition31to32.samples.at(-1).diskOneFill, 'rgb(165, 214, 167)',
      'disk 1 becomes green after the visual-move event finishes');
    assert.equal(scene.transition31to32.samples.at(-1).fill, 'rgb(255, 255, 255)',
      'disk 2 reaches the destination frame paint');
    assert.ok(scene.transition16to17MovingFills.length === 2
      && scene.transition16to17MovingFills.every(Boolean),
    `both Peg_C disks keep valid interpolated paint during frame 16→17: ${JSON.stringify(scene.transition16to17MovingFills)}`);
    assert.ok(scene.transition11to12Paint.samples.some(sample => (
      sample.one.moving && sample.one.fill === 'rgb(255, 255, 255)'
        && sample.two.moving && sample.two.fill === 'rgb(255, 255, 255)'
    )), `frame 11→12 carries both source paints during visual-move events: ${JSON.stringify(scene.transition11to12Paint)}`);
    assert.ok(scene.transition11to12Paint.samples.some(sample => (
      !sample.one.moving
        && !['rgb(255, 255, 255)', 'rgb(239, 154, 154)'].includes(sample.one.fill)
    )), `disk 1 interpolates after its visual-move event: ${JSON.stringify(scene.transition11to12Paint)}`);
    assert.ok(scene.transition11to12Paint.samples.some(sample => (
      !sample.two.moving
        && !['rgb(255, 255, 255)', 'rgb(165, 214, 167)'].includes(sample.two.fill)
    )), `disk 2 interpolates after its visual-move event: ${JSON.stringify(scene.transition11to12Paint)}`);
    assert.deepEqual(scene.transition11to12Paint.settled, {
      one: { fill: 'rgb(239, 154, 154)', moving: false },
      two: { fill: 'rgb(165, 214, 167)', moving: false }
    });
    assert.equal(scene.transition11to12Paint.paintPhase?.durationMs, 180,
      'visual-move events schedule one blocking post-motion paint phase');
    assert.ok(scene.transition11to12Paint.motionPhase?.steps?.every(step => (
      step.kind === 'visual-move' && step.targetKeys.length === 1
    )), JSON.stringify(scene.transition11to12Paint.motionPhase));
    assert.equal(scene.synchronizedDiskPaints.motionEvents.filter(event => (
      event.targetKeys?.some(key => /Peg_[AB].*#/.test(key))
    )).length, 0, 'frame 19→20 emits no disk visual-move event');
    assert.ok(scene.player21to22.every(sample => sample.ansRect
      && sample.ansRect.x < 1600 && sample.ansRect.x + sample.ansRect.width > 0
      && sample.ansRect.y < 1000 && sample.ansRect.y + sample.ansRect.height > 0),
    `ans remains inside the viewport throughout frame 21→22: ${JSON.stringify(scene.player21to22)}`);
    assert.ok(scene.player21to22.every(sample => sample.arrows === 2
      && sample.arrowOpacities.every(opacity => opacity === '1')),
    `retained arrows remain visible with ans throughout frame 21→22: ${JSON.stringify(scene.player21to22)}`);
    assert.notEqual(scene.player21to22[2].viewportTransform,
      scene.player21to22[0].viewportTransform,
      'auto camera starts with the frame transition instead of waiting for the code phase');
    assert.equal(scene.rapid14to16.during.frame, 16);
    assert.equal(scene.rapid14to16.settled.frame, 16);
    assert.ok(scene.rapid14to16.settled.pegCFills.length === 2
      && scene.rapid14to16.settled.pegCFills.every(fill => fill === 'rgb(255, 255, 255)'),
    `rapid next finishes frame 16 with both Peg_C paints settled: ${JSON.stringify(scene.rapid14to16)}`);
    assert.ok(scene.recursionNameEntrances.filter(name => name.existed).every(name => (
      name.appearing === '' && name.labelOpacity === '1'
        && name.ownerOpacity === '1' && name.motionOpacity === '1'
    )), `entering another recursion must not restart existing object names: ${JSON.stringify(scene.recursionNameEntrances)}`);
    assert.deepEqual(scene.rapid18to20.settled, {
      frame: 20,
      pegA2: 'rgb(165, 214, 167)',
      pegB1: 'rgb(239, 154, 154)'
    }, `rapid next commits Peg_A/Peg_B paint together: ${JSON.stringify(scene.rapid18to20)}`);
    assert.ok(scene.frameSevenCodeFragments > 0,
      'eventless frame 7 keeps the preceding code snippet visible');
    assert.equal(scene.frameSevenInheritedFrom, scene.frameSixId);
    assert.equal(scene.frameSevenCodeLayout, scene.frameSixCodeLayout);
    assert.equal(scene.frameSevenCodeDelay, 0,
      'eventless frame 7 must not delay the disk transition for a code page jump');
    assert.deepEqual({
      nodes: scene.nodeCount,
      edges: scene.edgeCount,
      flow: scene.flowCount
    }, { nodes: 30, edges: 29, flow: 0 });
  } finally {
    await browser.close();
  }
});
