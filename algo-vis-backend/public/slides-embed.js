// -----------------------------------------------------------------------------
// 演算法頁嵌入橋接器
// 在 iframe 模式接收父頁命令、回報就緒與播放狀態，並限制嵌入時不需要的編輯介面。
// -----------------------------------------------------------------------------
(function () {
  // 投影片上的動畫（runtime）與編輯動畫（editor）是同一個 iframe：父頁以 asm-embed-set-mode 切換，
  // 不重新載入，畫面與目前幀都保留。
  let mode = new URLSearchParams(window.location.search).get('asmEmbed');
  if (!mode) return;

  document.body.classList.add(`asm-embed-${mode}`);
  const normalize = window.ASMAlgorithmAnimation.normalize;
  let currentAnimation = normalize();
  let runtimeVisible = mode !== 'runtime';
  let runtimeGeometryRequest = 0;

  // -----------------------------------------------------------------------------
  // 嵌入畫面穩定化
  // 套用動畫前先完成進行中的過渡並清除暫時層，父頁收到完成通知時畫面已可擷取。
  // -----------------------------------------------------------------------------
  function settleAnimationVisuals() {
    // Event tweens use temporary SVG layers (moving values, comparison cards,
    // arrows and resize ghosts). A save/load may happen while one is active,
    // so settle and remove those layers before taking or applying a snapshot.
    window.ASMTraceFrameTween?.cancel?.();
    window.resetArrows?.();
  }

  function notifyAnimationApplied() {
    if (window.parent === window) return;
    const notify = () => window.parent.postMessage({
      type: 'asm-animation-applied',
      mode
    }, window.location.origin);
    if (typeof window.requestAnimationFrame !== 'function') {
      setTimeout(notify, 0);
      return;
    }
    // Let the initial canvas render and Trace Studio layout settle before the
    // parent reveals the editor iframe. This prevents partially built scenes
    // and thumbnail layers from flashing while the modal opens.
    window.requestAnimationFrame(() => window.requestAnimationFrame(notify));
  }

  // 重新排版後，結構格子裡的數字由 trace-structure-lod 在下一幀非同步補上（data-asm-lod-pending）。
  // 等補完再回報就緒，父頁才顯示，否則會看到一幀空格子。最多等 10 幀。
  function lodSettled(maxFrames = 10) {
    if (typeof window.requestAnimationFrame !== 'function') return Promise.resolve();
    return new Promise(resolve => {
      let frames = 0;
      const check = () => {
        if (!document.querySelector('[data-asm-lod-pending]') || ++frames >= maxFrames) resolve();
        else window.requestAnimationFrame(check);
      };
      window.requestAnimationFrame(check);
    });
  }

  function prepareRuntimeGeometry() {
    if (mode !== 'runtime' || !runtimeVisible || !currentAnimation.traceDocument?.frames?.length) {
      return Promise.resolve(false);
    }
    const request = ++runtimeGeometryRequest;
    return new Promise(resolve => {
      const run = () => Promise.resolve(window.ASMTracePlayer?.rebaseCurrentFrame?.({
        confirmVisible: true
      })).then(ready => (ready ? lodSettled().then(() => ready) : ready)).then(ready => {
        if (request !== runtimeGeometryRequest || !ready) return resolve(false);
        if (window.parent !== window) {
          window.parent.postMessage({
            type: 'asm-animation-geometry-ready',
            mode
          }, window.location.origin);
        }
        resolve(true);
      }).catch(error => {
        console.error('Algorithm slide geometry preparation failed', error);
        resolve(false);
      });
      if (typeof window.requestAnimationFrame !== 'function') {
        setTimeout(run, 0);
        return;
      }
      window.requestAnimationFrame(() => window.requestAnimationFrame(run));
    });
  }

  // -----------------------------------------------------------------------------
  // 編輯器快照與來源新鮮度
  // 匯出時讀取目前 Ace、輸入與 trace；若來源已變更則標記舊 trace，避免把它誤當可播放結果。
  // -----------------------------------------------------------------------------
  function snapshotAnimation() {
    window.ASMTraceStudio?.flushSourceSettings?.();
    const input = document.getElementById('inputArea');
    const traceSettings = window.ASMTraceEditor?.snapshot?.() || {};
    // TraceEditor.snapshot() already returns a compact, detached trace and
    // postMessage performs the cross-frame structured clone. Avoid cloning the
    // same large frame list once more inside the editor before sending it.
    return {
      mode: traceSettings.mode || currentAnimation.mode || 'legacy',
      code: typeof aceEditor !== 'undefined' ? aceEditor.getValue() : currentAnimation.code,
      input: input ? input.value : currentAnimation.input,
      scriptContent: currentAnimation.scriptContent,
      sliceMode: traceSettings.sliceMode || currentAnimation.sliceMode || 'auto',
      watches: traceSettings.watches || currentAnimation.watches || [],
      skins: traceSettings.skins || currentAnimation.skins || {},
      rules: traceSettings.rules || currentAnimation.rules || [],
      traceDocument: Object.hasOwn(traceSettings, 'traceDocument')
        ? traceSettings.traceDocument : currentAnimation.traceDocument || null,
      ...(traceSettings.rebuild ? { rebuild: traceSettings.rebuild,
        rebuildError: traceSettings.rebuildError } : {})
    };
  }

  // -----------------------------------------------------------------------------
  // 父子頁資料套用
  // 先更新來源與輸入，再選擇 trace 或傳統腳本播放，最後重設畫布及導覽狀態。
  // -----------------------------------------------------------------------------
  function applyAnimation(animation = {}, editorSessionKey = null, cameraSurface = editorSessionKey) {
    settleAnimationVisuals();
    currentAnimation = normalize(animation);
    window.setLocalCameraSurface?.(`slides:${cameraSurface || 'default'}`);
    if (typeof aceEditor !== 'undefined') {
      window.__asmEmbeddedAnimationPayload = currentAnimation;
      if (mode === 'editor' && editorSessionKey != null) {
        window.asmUseEditorSession(editorSessionKey, currentAnimation.code);
      }
      window.asmReplaceEditorCode(currentAnimation.code, -1);
      if (typeof foldDrawBlocks === 'function') setTimeout(foldDrawBlocks, 0);
    }
    const input = document.getElementById('inputArea');
    if (input) input.value = currentAnimation.input;
    window.ASMTraceEditor?.loadAnimation?.(currentAnimation);
    if (currentAnimation.traceDocument?.frames?.length) {
      if (!window.ASMTraceEditor) window.asmApplyTraceDocument?.(currentAnimation.traceDocument);
      // 新鮮度模組統一處理，避免此處與載入監聽重複提交 RUN。
      return null;
    }
    if (currentAnimation.scriptContent && typeof window.asmApplyAnimationScript === 'function') {
      window.asmApplyAnimationScript(currentAnimation.scriptContent);
    }
  }

  // -----------------------------------------------------------------------------
  // 模式切換（同一個 iframe）
  // 進入編輯時顯示左側編輯區並接上設定標籤；回到投影片時先把設定寫回 @asm-view。
  // 版面穩定後回報畫布位置，父頁用它把展開過場的第一幀對齊投影片上的畫布。
  // -----------------------------------------------------------------------------
  function canvasRect() {
    const rect = document.getElementById('tab-canvas')?.getBoundingClientRect();
    return rect ? { left: rect.left, top: rect.top, width: rect.width, height: rect.height } : null;
  }

  // 組裝式過場，分兩段：
  //   打開：畫布從投影片上的位置移到右側定位，右側分頁在畫布就定位時剛好從上方落下完畢，接著左側編輯區從左邊展開；
  //   返回：反過來，先收起左側，畫布開始移回投影片時分頁同時收起。
  // 畫布移動時框與內容分開處理：框（transform＋clip-path）從投影片的框連續變成編輯頁的框；
  // 內容由鏡頭覆寫逐幀決定，世界中心固定在框的中心，縮放倍率以等比（對數）連續插值，
  // 起點是投影片上實際的取景（打開前記下的 runtime 鏡頭），終點是編輯頁目前的鏡頭。
  // from 是投影片上的畫布在這個 iframe 座標中的位置；過場中頁面背景透明，看得到後面的投影片。
  const ASSEMBLE_CANVAS_MS = 420;
  const ASSEMBLE_PANEL_MS = 300;
  const ASSEMBLE_MS = ASSEMBLE_CANVAS_MS + ASSEMBLE_PANEL_MS;
  const ASSEMBLE_EASING = 'cubic-bezier(.22, 1, .36, 1)';
  let assemblyAnimations = [];
  let assemblyFrame = null;
  let assemblyControls = null;
  let assemblyCodePanel = null;
  let runtimeSnapshot = null;

  function cameraWorldCenter(camera, width, height) {
    const scale = Math.max(0.0001, camera.physicalScale);
    return { x: (width / 2 - camera.translateX) / scale, y: (height / 2 - camera.translateY) / scale };
  }

  // 投影片上的取景：打開前在 runtime 版面記下，供打開的起點與返回的終點使用。
  function captureRuntimeSnapshot() {
    const svg = document.getElementById('arraySvg');
    const canvas = canvasRect();
    const rect = svg?.getBoundingClientRect();
    const camera = window.getCameraState?.();
    if (!canvas?.width || !rect?.width || !rect.height || !camera) return null;
    return {
      canvas,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      size: { width: svg.clientWidth || rect.width, height: svg.clientHeight || rect.height },
      scale: camera.physicalScale,
      world: cameraWorldCenter(camera, rect.width, rect.height),
      base: window.getBaseCamera?.() || null,
      codePanel: visibleCodePanelRect()
    };
  }

  // 畫布左上角的程式碼框（HTML，不在鏡頭裡）：過場中要和內容一樣，從投影片上的位置與大小連續變到編輯頁。
  // 對齊的是文字區（.asm-trace-code-page）而不是外框：外框的內距是固定像素，不跟字級等比，
  // 用外框對齊會讓文字在到位前偏右、偏大，到位後才往左縮回。
  function visibleCodePanelRect() {
    const panel = document.getElementById('traceCodePanel');
    if (!panel || panel.hidden) return null;
    const outer = panel.getBoundingClientRect();
    const rect = (panel.querySelector('.asm-trace-code-page') || panel).getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? {
      left: rect.left, top: rect.top, width: rect.width, height: rect.height,
      offset: { x: rect.left - outer.left, y: rect.top - outer.top }
    } : null;
  }

  // 編輯頁打開完成時的基準鏡頭；返回時用它和現在的差（換幀、重新取景）推算投影片上的基準鏡頭。
  let editorBaseAtOpen = null;

  // 回到投影片後的取景：投影片的基準鏡頭（依編輯頁裡的變化調整）＋現在共用的手動偏移，
  // 算法與 canva.js presentationCameraTarget 相同。
  function predictedRuntimeCamera(snapshot) {
    const base = snapshot.base;
    const now = window.getBaseCamera?.();
    if (!base || !now || !(base.factor > 0) || !snapshot.size?.width) return snapshot;
    let { x, y, scale } = base;
    if (editorBaseAtOpen?.scale > 0) {
      x += now.x - editorBaseAtOpen.x;
      y += now.y - editorBaseAtOpen.y;
      scale *= now.scale / editorBaseAtOpen.scale;
    }
    const modifier = now.modifier;
    const physicalScale = Math.max(0.05, scale) * modifier.zoomFactor * base.factor;
    return {
      scale: physicalScale,
      world: {
        x: x - modifier.panXRatio * snapshot.size.width / physicalScale,
        y: y - modifier.panYRatio * snapshot.size.height / physicalScale
      }
    };
  }

  function cancelAssembly() {
    if (assemblyFrame != null) window.cancelAnimationFrame?.(assemblyFrame);
    assemblyFrame = null;
    assemblyAnimations.forEach(animation => animation.cancel());
    assemblyAnimations = [];
    const canvas = document.getElementById('tab-canvas');
    if (canvas) {
      canvas.style.transform = '';
      canvas.style.clipPath = '';
      canvas.style.transformOrigin = '';
    }
    if (assemblyControls) {
      assemblyControls.placeholder.remove();
      ['position', 'left', 'top', 'width', 'transform', 'transformOrigin', 'zIndex', 'margin']
        .forEach(name => { assemblyControls.controls.style[name] = ''; });
      assemblyControls = null;
    }
    if (assemblyCodePanel) {
      assemblyCodePanel.style.transform = '';
      assemblyCodePanel.style.transformOrigin = '';
      assemblyCodePanel = null;
    }
    window.setViewportTransformOverride?.(null);
    document.documentElement.classList.remove('asm-embed-assembling');
  }

  function playAssembly(from, direction) {
    cancelAssembly();
    const canvas = document.getElementById('tab-canvas');
    const svg = document.getElementById('arraySvg');
    const target = canvas?.getBoundingClientRect();
    if (!from || !target?.width || !target.height || typeof canvas.animate !== 'function') {
      document.documentElement.classList.remove('asm-embed-assembly-pending');
      return Promise.resolve();
    }
    document.documentElement.classList.add('asm-embed-assembling');
    document.documentElement.classList.remove('asm-embed-assembly-pending');
    const opening = direction === 'open';
    const lerp = (a, b, e) => a + (b - a) * e;

    // 框：可見範圍從 from 連續變成 target。k 讓可見範圍不超出畫布本身，可見範圍貼齊上緣（播放列在上方）。
    const geometry = e => {
      const box = {
        left: lerp(from.left, target.left, e), top: lerp(from.top, target.top, e),
        width: lerp(from.width, target.width, e), height: lerp(from.height, target.height, e)
      };
      const k = Math.max(box.width / target.width, box.height / target.height);
      const width = box.width / k;
      const height = box.height / k;
      const x = (target.width - width) / 2;
      const y = 0;
      return { k, x, y, width, height, box, origin: { x: box.left - k * x, y: box.top - k * y } };
    };

    // 內容：svg 在畫布中的位置用過場前的版面量，過場中不改變版面，不會觸發重新排版。
    const svgRect = svg?.getBoundingClientRect();
    const svgOffset = svgRect ? { x: svgRect.left - target.left, y: svgRect.top - target.top } : null;
    const svgWidth = svg?.clientWidth || svgRect?.width || 0;
    const svgHeight = svg?.clientHeight || svgRect?.height || 0;
    const snapshot = runtimeSnapshot;
    const ratio = snapshot?.canvas?.width ? from.width / snapshot.canvas.width : 0;
    // 打開：用記下的投影片取景。返回：投影片會以「當時的基準鏡頭＋現在的手動偏移」重新取景，
    // 所以終點用現在的偏移推算（在編輯頁拖動、換幀後，回到投影片也不會跳）。
    const slideCamera = snapshot && !opening ? predictedRuntimeCamera(snapshot) : snapshot;
    const slideView = snapshot && ratio > 0 ? {
      center: {
        x: from.left + (snapshot.center.x - snapshot.canvas.left) * ratio,
        y: from.top + (snapshot.center.y - snapshot.canvas.top) * ratio
      },
      scale: slideCamera.scale * ratio,
      world: slideCamera.world
    } : null;

    // 播放列：一直貼在框的上緣，寬度跟著框重新排版（不是跟著縮放拉伸），
    // 高度與按鈕大小從投影片上的大小連續變成編輯頁的大小。
    // 以同高的佔位元素留在原位，播放列改成絕對定位，畫布版面與 svg 大小都不變。
    const controls = canvas.querySelector(':scope > .controls');
    if (controls && controls.offsetHeight > 0) {
      const placeholder = document.createElement('div');
      placeholder.className = 'asm-assembly-controls-placeholder';
      // 佔位要和播放列佔一樣的空間：精確高度（offsetHeight 會取整數），以及寬度——
      // 視窗較窄時播放列的最小寬度會撐寬畫布，少了它 svg 就變窄、鏡頭重新取景而跳動。
      const size = controls.getBoundingClientRect();
      placeholder.style.cssText = `flex:0 0 auto;height:${size.height}px;width:${size.width}px;min-width:${size.width}px;`;
      controls.before(placeholder);
      Object.assign(controls.style, { position: 'absolute', left: '0px', top: '0px', margin: '0px', zIndex: '2', transformOrigin: '0 0' });
      assemblyControls = { controls, placeholder };
    }
    const startControlsScale = ratio > 0 ? ratio : geometry(0).k;

    // 程式碼框：投影片上的框（記下的位置換算到這裡的座標）到編輯頁的框之間連續移動與縮放。
    const codePanel = document.getElementById('traceCodePanel');
    const codeLocal = codePanel && !codePanel.hidden ? visibleCodePanelRect() : null;
    const codeSlide = codeLocal && snapshot?.codePanel && ratio > 0 ? {
      left: from.left + (snapshot.codePanel.left - snapshot.canvas.left) * ratio,
      top: from.top + (snapshot.codePanel.top - snapshot.canvas.top) * ratio,
      width: snapshot.codePanel.width * ratio
    } : null;
    if (codeSlide) {
      codeLocal.left -= target.left;
      codeLocal.top -= target.top;
      assemblyCodePanel = codePanel;
      // 以文字區左上角為縮放原點：下面的 translate 就是文字區本身的位移。
      codePanel.style.transformOrigin = `${codeLocal.offset.x}px ${codeLocal.offset.y}px`;
    }

    let progress = opening ? 0 : 1;
    let current = geometry(progress);
    const override = camera => {
      if (!svgOffset || !(svgWidth > 0) || !(svgHeight > 0)) return null;
      const e = progress;
      const editorWorld = cameraWorldCenter(camera, svgWidth, svgHeight);
      const editorCenter = { x: target.left + svgOffset.x + svgWidth / 2, y: target.top + svgOffset.y + svgHeight / 2 };
      const startGeometry = geometry(0);
      const start = slideView || {
        center: {
          x: startGeometry.origin.x + startGeometry.k * (svgOffset.x + svgWidth / 2),
          y: startGeometry.origin.y + startGeometry.k * (svgOffset.y + svgHeight / 2)
        },
        scale: camera.physicalScale * startGeometry.k,
        world: editorWorld
      };
      const endScale = Math.max(0.0001, camera.physicalScale);
      const startScale = Math.max(0.0001, start.scale);
      const scale = startScale * Math.pow(endScale / startScale, e);
      const center = { x: lerp(start.center.x, editorCenter.x, e), y: lerp(start.center.y, editorCenter.y, e) };
      const world = { x: lerp(start.world.x, editorWorld.x, e), y: lerp(start.world.y, editorWorld.y, e) };
      const physicalScale = scale / current.k;
      return {
        translateX: (center.x - current.origin.x) / current.k - svgOffset.x - world.x * physicalScale,
        translateY: (center.y - current.origin.y) / current.k - svgOffset.y - world.y * physicalScale,
        physicalScale
      };
    };
    const paint = () => {
      current = geometry(progress);
      canvas.style.transformOrigin = '0 0';
      canvas.style.transform = `translate(${current.origin.x - target.left}px, ${current.origin.y - target.top}px) scale(${current.k})`;
      canvas.style.clipPath = `inset(${current.y}px ${target.width - current.x - current.width}px `
        + `${target.height - current.y - current.height}px ${current.x}px)`;
      if (assemblyControls) {
        const size = lerp(startControlsScale, 1, progress);
        assemblyControls.controls.style.width = `${current.box.width / size}px`;
        assemblyControls.controls.style.transform = `translate(${current.x}px, ${current.y}px) scale(${size / current.k})`;
      }
      if (codeSlide) {
        // 畫面上的文字區目標（以寬度決定縮放，文字等比），換回畫布內的座標再設定 transform。
        const e = progress;
        const left = lerp(codeSlide.left, target.left + codeLocal.left, e);
        const top = lerp(codeSlide.top, target.top + codeLocal.top, e);
        const width = lerp(codeSlide.width, codeLocal.width, e);
        const scale = width / (current.k * codeLocal.width);
        const x = (left - current.origin.x) / current.k - codeLocal.left;
        const y = (top - current.origin.y) / current.k - codeLocal.top;
        codePanel.style.transform = `translate(${x}px, ${y}px) scale(${scale})`;
      }
      if (window.updateTransform) window.updateTransform();
    };

    // 時間軸（打開）：畫布 0→CANVAS；右側分頁在畫布就定位時剛好展開完畢；左側在畫布就定位後才展開。
    // 返回完全倒過來：左側先收，畫布開始移動時分頁同時收起。
    const canvasDelay = opening ? 0 : ASSEMBLE_PANEL_MS;
    const sideDelay = opening ? ASSEMBLE_CANVAS_MS : 0;
    const tabsDelay = opening ? Math.max(0, ASSEMBLE_CANVAS_MS - ASSEMBLE_PANEL_MS) : ASSEMBLE_PANEL_MS;
    const panelOptions = delay => ({ duration: ASSEMBLE_PANEL_MS, delay, easing: ASSEMBLE_EASING, fill: 'both' });
    const pair = (start, end) => opening ? [start, end] : [end, start];
    const panels = [
      [document.getElementById('codePanel'), pair({ transform: 'translateX(-100%)' }, { transform: 'translateX(0)' }), sideDelay],
      [document.getElementById('divider'), pair({ opacity: 0 }, { opacity: 1 }), sideDelay],
      [document.getElementById('subTabs'), pair({ transform: 'translateY(-100%)', opacity: 0 }, { transform: 'translateY(0)', opacity: 1 }), tabsDelay]
    ].filter(([element]) => element);
    // 畫布的進度來源：空轉的動畫只提供套用 easing 後的進度，實際畫面由 paint 逐幀設定。
    const timing = canvas.animate([{ opacity: 1 }, { opacity: 1 }],
      { duration: ASSEMBLE_CANVAS_MS, delay: canvasDelay, easing: ASSEMBLE_EASING, fill: 'both' });
    assemblyAnimations = [timing, ...panels.map(([element, frames, delay]) => element.animate(frames, panelOptions(delay)))];
    window.setViewportTransformOverride?.(override);
    paint();
    const tick = () => {
      const value = Number(timing.effect?.getComputedTiming?.().progress);
      const eased = Number.isFinite(value) ? value : (timing.playState === 'finished' ? 1 : 0);
      progress = opening ? eased : 1 - eased;
      paint();
      if (timing.playState !== 'finished') assemblyFrame = window.requestAnimationFrame(tick);
    };
    assemblyFrame = window.requestAnimationFrame(tick);
    return Promise.all(assemblyAnimations.map(animation => animation.finished.catch(() => {}))).then(() => {
      if (assemblyFrame != null) window.cancelAnimationFrame(assemblyFrame);
      assemblyFrame = null;
      progress = opening ? 1 : 0;
      paint();
      // 打開完成：拿掉覆寫，畫面就是編輯頁的鏡頭（最後一幀已與它相同）。
      // 返回完成：停在投影片的框與取景，直到父頁搬回投影片並切回 runtime。
      if (opening) {
        cancelAssembly();
        editorBaseAtOpen = window.getBaseCamera?.() || null;
      }
    });
  }

  function setEmbedMode(next, cameraSurface = null, assembleFrom = null) {
    if (!['runtime', 'editor'].includes(next)) return;
    if (next === 'editor' && assembleFrom) document.documentElement.classList.add('asm-embed-assembly-pending');
    else document.documentElement.classList.remove('asm-embed-assembly-pending');
    if (next === 'runtime') cancelAssembly();
    if (next !== mode) {
      if (mode === 'editor') window.ASMTraceStudio?.flushSourceSettings?.();
      document.body.classList.remove(`asm-embed-${mode}`);
      mode = next;
      document.body.classList.add(`asm-embed-${mode}`);
    }
    if (mode === 'editor') {
      runtimeVisible = true;
      runtimeGeometryRequest += 1;
      const trace = window.ASMTraceEditor?.getTraceDocument?.();
      if (trace) window.ASMTraceStudio?.attach?.(trace);
      document.querySelector('.tab-btn[data-tab="tab-canvas"]')?.click();
    }
    if (cameraSurface) window.setLocalCameraSurface?.(`slides:${cameraSurface}`);
    if (typeof aceEditor !== 'undefined') aceEditor.resize?.();
    window.dispatchEvent(new Event('resize'));
    const report = () => {
      if (window.parent === window) return;
      window.parent.postMessage({ type: 'asm-embed-mode-changed', mode, canvasRect: canvasRect() },
        window.location.origin);
    };
    // 組裝過場立即開始：量位置會強制排版，鏡頭在上面的 resize 已同步更新；之後的鏡頭變化由覆寫即時跟上。
    if (mode === 'editor' && assembleFrom) {
      playAssembly(assembleFrom, 'open').then(report);
      return;
    }
    const settled = report;
    if (typeof window.requestAnimationFrame !== 'function') setTimeout(settled, 0);
    else window.requestAnimationFrame(() => window.requestAnimationFrame(settled));
  }

  // RUN 同步：編輯頁的 RUN 開始／結束時告訴父頁（投影片編輯欄的 RUN 與狀態跟著變）；
  // 編輯欄的 RUN 執行中時，父頁送 asm-runtime-run-state，這裡的 RUN 也顯示執行中。
  let externalRunState = '';
  const runButton = document.getElementById('runBtn');
  function editorRunResult() {
    const trace = window.ASMTraceEditor?.getTraceDocument?.();
    const code = typeof aceEditor !== 'undefined' ? aceEditor.getValue() : '';
    const input = document.getElementById('inputArea')?.value || '';
    const fresh = Boolean(trace) && window.ASMTraceProvenance?.status?.(trace, code, input)?.kind === 'current';
    const message = fresh ? '' : (document.getElementById('outputArea')?.textContent || '執行失敗').trim();
    return { ok: fresh, message };
  }
  if (runButton && typeof MutationObserver === 'function') {
    let wasLoading = runButton.classList.contains('loading');
    new MutationObserver(() => {
      const loading = runButton.classList.contains('loading');
      if (loading === wasLoading) return;
      wasLoading = loading;
      if (externalRunState || window.parent === window) return;
      const result = loading ? { state: 'running' } : { state: 'done', ...editorRunResult() };
      window.parent.postMessage({ type: 'asm-embed-run-state', ...result }, window.location.origin);
    }).observe(runButton, { attributes: true, attributeFilter: ['class'] });
  }
  function setExternalRunState(state) {
    if (!runButton) return;
    externalRunState = state === 'running' ? 'running' : '';
    runButton.classList.toggle('loading', state === 'running');
    runButton.disabled = state === 'running';
  }

  // 編輯頁裡改了輸入：讓投影片編輯欄的輸入框保持同一份。
  document.getElementById('inputArea')?.addEventListener('input', event => {
    if (mode !== 'editor' || window.parent === window || !event.isTrusted) return;
    window.parent.postMessage({ type: 'asm-embed-input-changed', input: event.target.value },
      window.location.origin);
  });

  // -----------------------------------------------------------------------------
  // postMessage 協定
  // 只接受父視窗的已知命令；runtime 可見性與 editor 儲存請求分開處理並回傳對應 requestId。
  // -----------------------------------------------------------------------------
  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'asm-load-animation') {
      const refresh = applyAnimation(event.data.animation, event.data.editorSessionKey, event.data.cameraSurface);
      const applied = refresh && typeof refresh.finally === 'function'
        ? refresh.finally(notifyAnimationApplied)
        : (notifyAnimationApplied(), Promise.resolve());
      if (mode === 'runtime' && runtimeVisible) Promise.resolve(applied).then(prepareRuntimeGeometry);
      return;
    }
    if (event.data.type === 'asm-embed-set-mode') {
      setEmbedMode(event.data.mode, event.data.cameraSurface || null, event.data.assembleFrom || null);
      return;
    }
    if (event.data.type === 'asm-embed-capture-runtime') {
      // 父頁在把 iframe 搬進編輯頁之前送來：記下投影片上的取景（搬動後版面就變了）。
      if (mode === 'runtime') runtimeSnapshot = captureRuntimeSnapshot();
      // 搬動到切換版面之間先隱藏，避免以 runtime 版面在全頁大小閃一下；playAssembly 開始時再顯示。
      document.documentElement.classList.add('asm-embed-assembly-pending');
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'asm-embed-runtime-captured', ok: Boolean(runtimeSnapshot) },
          window.location.origin);
      }
      return;
    }
    if (event.data.type === 'asm-embed-disassemble') {
      playAssembly(event.data.to || null, 'close').then(() => {
        if (window.parent !== window) {
          window.parent.postMessage({ type: 'asm-embed-disassembled' }, window.location.origin);
        }
      });
      return;
    }
    if (event.data.type === 'asm-runtime-run-state') {
      setExternalRunState(event.data.state);
      return;
    }
    if (event.data.type === 'asm-runtime-set-input') {
      // 投影片編輯欄的輸入框：寫入同一份輸入，觸發新鮮度檢查讓紅點亮起。
      const input = document.getElementById('inputArea');
      const value = String(event.data.input ?? '');
      currentAnimation = { ...currentAnimation, input: value };
      if (input && input.value !== value) {
        input.value = value;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      return;
    }
    if (event.data.type === 'asm-editor-hidden' && mode === 'editor') {
      window.ASMPlaybackNavigation?.pause?.();
      settleAnimationVisuals();
      return;
    }
    if (event.data.type === 'asm-runtime-visibility' && mode === 'runtime') {
      runtimeVisible = event.data.visible === true;
      if (event.data.cameraSurface) window.setLocalCameraSurface?.(`slides:${event.data.cameraSurface}`);

      if (!runtimeVisible) {
        runtimeGeometryRequest += 1;
        return;
      }
      prepareRuntimeGeometry();
      return;
    }
    if (event.data.type === 'asm-request-save-animation' && mode === 'editor' && window.parent !== window) {
      settleAnimationVisuals();
      window.parent.postMessage({
        type: 'asm-save-animation',
        animation: snapshotAnimation()
      }, window.location.origin);
    }
    if (event.data.type === 'asm-request-export-animation-snapshot' && mode === 'editor' && window.parent !== window) {
      window.parent.postMessage({
        type: 'asm-export-animation-snapshot',
        requestId: event.data.requestId,
        animation: snapshotAnimation()
      }, window.location.origin);
    }
  });

  window.addEventListener('asm:compiled-animation', event => {
    if (mode !== 'editor' || window.parent === window) return;
    currentAnimation = normalize(event.detail || {});
    window.parent.postMessage({
      type: 'asm-animation-compiled',
      animation: currentAnimation
    }, window.location.origin);
  });

  window.addEventListener('load', () => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'asm-embed-ready', mode }, window.location.origin);
  });
})();
