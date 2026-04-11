// canva.js
// 畫布初始化、無限座標格、平移、縮放核心邏輯

(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let svg, viewport;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let animationId = null; // 用於追蹤正在進行的鏡頭動畫
  let isFirstCamera = true; // 新增：用於判斷是否為首次設定鏡頭
  const GRID_SPACING = 50;  // 格線間距
  const GRID_EXTENT = 10000; // 世界座標覆蓋範圍半徑

  function initCanvas() {
    svg = document.getElementById('arraySvg');

    // 1. 定義 <defs> 與無限格線 pattern
    const defs = document.createElementNS(NS, 'defs');
    const pat = document.createElementNS(NS, 'pattern');
    pat.setAttribute('id', 'gridPattern');
    pat.setAttribute('patternUnits', 'userSpaceOnUse');
    pat.setAttribute('width', GRID_SPACING);
    pat.setAttribute('height', GRID_SPACING);
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', `M ${GRID_SPACING} 0 L 0 0 0 ${GRID_SPACING}`);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', '#ddd');
    path.setAttribute('stroke-width', '0.5');
    pat.appendChild(path);
    defs.appendChild(pat);
    svg.appendChild(defs);

    // 2. 建立 viewport 群組並添加背景格線矩形
    viewport = document.createElementNS(NS, 'g');
    viewport.setAttribute('id', 'viewport');
    const bg = document.createElementNS(NS, 'rect');
    bg.setAttribute('x', -GRID_EXTENT);
    bg.setAttribute('y', -GRID_EXTENT);
    bg.setAttribute('width', GRID_EXTENT * 2);
    bg.setAttribute('height', GRID_EXTENT * 2);
    bg.setAttribute('fill', 'url(#gridPattern)');
    viewport.appendChild(bg);
    svg.appendChild(viewport);

    bindInteractions();
    updateTransform();
  }

  function updateTransform() {
    viewport.setAttribute(
      'transform',
      `translate(${translateX},${translateY}) scale(${scale})`
    );
  }

  function bindInteractions() {
    let dragging = false;
    let startX = 0, startY = 0;

    svg.addEventListener('mousedown', e => {
      // 判斷是否可拖曳：左鍵 (0) 要看是否為繪圖模式，右鍵 (2) 永遠允許拖曳
      if (e.button === 0) {
        if (window.isDrawingMode) return;
      } else if (e.button === 2) {
        // 右鍵允許拖曳
      } else {
        return; // 其他按鍵不處理
      }

      stopAnimation(); // 手動操作時停止動畫
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
    });

    // 禁用 SVG 上的右鍵選單，避免干擾右鍵拖曳
    svg.addEventListener('contextmenu', e => {
      e.preventDefault();
    });
    svg.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;
      translateX += dx;
      translateY += dy;
      updateTransform();
    });
    svg.addEventListener('mouseup', () => dragging = false);
    svg.addEventListener('mouseleave', () => dragging = false);

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      stopAnimation(); // 手動操作時停止動畫
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scale;
      scale *= (e.deltaY < 0 ? 1.1 : 1 / 1.1);
      const px = (mx - translateX) / oldScale;
      const py = (my - translateY) / oldScale;
      translateX = mx - scale * px;
      translateY = my - scale * py;
      updateTransform();
    });
  }

  window.resetCanvasView = () => {
    scale = 1;
    translateX = 40;
    translateY = 80;
    if (window.updateTransform) window.updateTransform();
  };

  // ===============================================
  // 清空畫布：保留格線背景（fill = url(#gridPattern)）
  // ===============================================
  window.clearCanvas = function (full = false) {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return;

    const children = Array.from(vp.children);
    children.forEach(node => {
      const tag = node.tagName.toLowerCase();
      const fill = node.getAttribute && node.getAttribute('fill');
      const id = node.getAttribute('id');

      // 保留格線背景 AND 保留箭頭圖層 (arrow-layer)
      if (tag === 'rect' && fill === 'url(#gridPattern)') return;
      if (id === 'arrow-layer') return; // 讓 draw_arrow.js 自己管理
      if (id === 'drawingLayer') return; // 保留塗鴉層

      vp.removeChild(node);
    });

    if (full) {
      vp.setAttribute("transform", "");
      vp.removeAttribute("data-translate");
      vp.removeAttribute("data-scale");
    }

    // 呼叫箭頭清除 (現在它會執行標記，而不是真刪除)
    if (window.clearArrows) {
      window.clearArrows();
    }
  };

  // 暴露給外部使用
  window.updateTransform = updateTransform;
  window.getViewport = () => viewport;
  window.getScale = () => scale;

  window.resetCameraState = () => {
    isFirstCamera = true;
    stopAnimation();
  };

  // ===============================================
  // 鏡頭控制 (Camera Control)
  // ===============================================

  let delayTimeoutId = null; // 用於延遲動畫開始的計時器

  /**
   * 停止目前的鏡頭動畫
   */
  function stopAnimation() {
    if (delayTimeoutId) {
      clearTimeout(delayTimeoutId);
      delayTimeoutId = null;
    }
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
  }

  /**
   * 平滑移動鏡頭到目標位置與縮放
   */
  function animateCamera(targetX, targetY, targetScale, duration = 400) {
    stopAnimation();

    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // 如果 SVG 還沒佈局好，直接立即設定並回傳
      scale = targetScale;
      translateX = 0 - targetX * scale;
      translateY = 0 - targetY * scale;
      updateTransform();
      return;
    }

    // 延遲 100ms 後開始動畫
    delayTimeoutId = setTimeout(() => {
      delayTimeoutId = null;

      // 計算當前視圖中心的世界座標
      const rect = svg.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const startX = (centerX - translateX) / scale;
      const startY = (centerY - translateY) / scale;
      const startScale = scale;
      const startTime = performance.now();

      function step(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // 使用 Ease-out 效果
        const ease = 1 - Math.pow(1 - progress, 3);

        const currentX = startX + (targetX - startX) * ease;
        const currentY = startY + (targetY - startY) * ease;
        const currentScale = startScale + (targetScale - startScale) * ease;

        // 更新全域狀態
        scale = currentScale;
        const rect = svg.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        translateX = centerX - currentX * scale;
        translateY = centerY - currentY * scale;

        updateTransform();

        if (progress < 1) {
          animationId = requestAnimationFrame(step);
        } else {
          animationId = null;
        }
      }

      animationId = requestAnimationFrame(step);
    }, 100);
  }

  /**
   * 將鏡頭定位到世界座標 (x, y)，並設置縮放比例
   */
  window.setCamera = function (x, y, newScale, animate = true) {
    if (!svg || !viewport) return;

    // 如果是第一次設定鏡頭，強制使用非動畫模式，避免從 (0,0) 飛入
    if (isFirstCamera) {
      animate = false;
      isFirstCamera = false;
    }

    if (animate) {
      animateCamera(x, y, newScale);
    } else {
      stopAnimation();

      let rect = svg.getBoundingClientRect();
      // 確保 SVG 尺寸有效，否則嘗試使用父容器尺寸
      if (rect.width === 0 || rect.height === 0) {
        const parent = svg.parentElement;
        const pw = parent ? parent.clientWidth : 800;
        const ph = parent ? parent.clientHeight : 600;
        rect = { width: pw, height: ph };
      }
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      scale = newScale;
      translateX = centerX - x * scale;
      translateY = centerY - y * scale;

      updateTransform();
    }
  };

  /**
   * 根據 Pos 結構定位鏡頭
   */
  window.setCameraByPos = function (posSpec, newScale, animate = true) {
    const pos = window.resolvePos(posSpec);
    window.setCamera(pos.x, pos.y, newScale, animate);
  };

  /**
   * 自動調整鏡頭以容納所有可見物件
   * @param {number} zoom 縮放倍率 (1.0 = 剛好容納, >1 放大, <1 縮小)
   * @param {boolean} animate 是否使用動畫
   * @param {number} offsetX 水平偏移 (正值鏡頭右移，物體左移)
   * @param {number} offsetY 垂直偏移
   */
  window.setAutoCamera = function (zoom = 1.0, animate = true, offsetX = 0, offsetY = 0) {
    const vp = window.getViewport();
    if (!vp) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let found = false;

    // 取得 viewport 下的所有子物件
    Array.from(vp.children).forEach(node => {
      const tag = (node.tagName || "").toLowerCase();
      const fill = node.getAttribute && node.getAttribute('fill');
      const id = node.getAttribute('id');

      // 排除背景格線與塗鴉層
      if (tag === 'rect' && fill === 'url(#gridPattern)') return;
      if (id === 'drawingLayer') return;

      // 排除箭頭層：箭頭的端點必然在已繪製物件之間，不會擴大邊界框
      // 且箭頭有 tween 動畫，在動畫完成前座標可能是舊值，會嚴重干擾鏡頭計算
      if (id === 'arrow-layer') return;

      // 排除 stepWithTween 產生的 ghost 物件（正在淡出的舊物件）
      if (node.getAttribute && node.getAttribute('data-ghost') === '1') return;

      // 進階檢查：如果 node 本身是待刪除的，直接跳過
      if (node.getAttribute && node.getAttribute('data-alive') === '0') return;

      // 如果 node 是容器，遞迴檢查子物件（避免容器內的 data-alive="0" 物件被 getBBox 計入）
      const processNode = (target, currentTX, currentTY) => {
        try {
          if (target.getAttribute && (target.getAttribute('data-alive') === '0' || target.style.display === 'none')) return;

          // 累加當前節點的 transform 位移
          let localTX = 0, localTY = 0;
          const transform = target.getAttribute('transform');
          if (transform) {
            const transMatch = /translate\s*\(\s*([+\-]?[\d\.]+)\s*[,\s]\s*([+\-]?[\d\.]+)\s*\)/.exec(transform);
            if (transMatch) {
              localTX = parseFloat(transMatch[1]);
              localTY = parseFloat(transMatch[2]);
            }
          }
          const totalTX = currentTX + localTX;
          const totalTY = currentTY + localTY;

          if (target.children.length === 0 || target.tagName.toLowerCase() === 'text' || target.tagName.toLowerCase() === 'circle') {
            const bbox = target.getBBox();
            if (bbox.width === 0 && bbox.height === 0) return;
            minX = Math.min(minX, bbox.x + totalTX);
            minY = Math.min(minY, bbox.y + totalTY);
            maxX = Math.max(maxX, bbox.x + totalTX + bbox.width);
            maxY = Math.max(maxY, bbox.y + totalTY + bbox.height);
            found = true;
          } else {
            Array.from(target.children).forEach(child => {
              processNode(child, totalTX, totalTY);
            });
          }
        } catch (e) { }
      };

      processNode(node, 0, 0);
    });

    if (!found) {
      window.resetCanvasView();
      return;
    }

    // 計算合適的縮放比例
    let rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) {
      // 嘗試從父容器獲取尺寸
      const parent = svg.parentElement;
      const pw = parent ? parent.clientWidth : 800;
      const ph = parent ? parent.clientHeight : 600;
      rect = { width: pw, height: ph };
    }

    const contentW = (maxX - minX);
    const contentH = (maxY - minY);

    // 避免除以零
    if (contentW <= 0 || contentH <= 0) return;

    const scaleW = rect.width / contentW;
    const scaleH = rect.height / contentH;
    let targetScale = Math.min(scaleW, scaleH) * zoom;

    // 限制最大縮放比例，避免只有一個小物件時放得太大
    if (targetScale > 2.0) targetScale = 2.0;
    if (targetScale < 0.05) targetScale = 0.05;

    const midX = (minX + maxX) / 2 + offsetX;
    const midY = (minY + maxY) / 2 + offsetY;

    window.setCamera(midX, midY, targetScale, animate);
  };

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
