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

  function prepareRuntimeGeometry() {
    if (mode !== 'runtime' || !runtimeVisible || !currentAnimation.traceDocument?.frames?.length) {
      return Promise.resolve(false);
    }
    const request = ++runtimeGeometryRequest;
    return new Promise(resolve => {
      const run = () => Promise.resolve(window.ASMTracePlayer?.rebaseCurrentFrame?.({
        confirmVisible: true
      })).then(ready => {
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
    window.setLocalCameraSurface?.(`slides:${mode}:${cameraSurface || 'default'}`);
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

  function setEmbedMode(next, cameraSurface = null) {
    if (!['runtime', 'editor'].includes(next)) return;
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
    if (cameraSurface) window.setLocalCameraSurface?.(`slides:${mode}:${cameraSurface}`);
    if (typeof aceEditor !== 'undefined') aceEditor.resize?.();
    window.dispatchEvent(new Event('resize'));
    const report = () => {
      if (window.parent === window) return;
      window.parent.postMessage({ type: 'asm-embed-mode-changed', mode, canvasRect: canvasRect() },
        window.location.origin);
    };
    if (typeof window.requestAnimationFrame !== 'function') setTimeout(report, 0);
    else window.requestAnimationFrame(() => window.requestAnimationFrame(report));
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
      setEmbedMode(event.data.mode, event.data.cameraSurface || null);
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
      if (event.data.cameraSurface) window.setLocalCameraSurface?.(`slides:${mode}:${event.data.cameraSurface}`);

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
