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
      if (e.button !== 0) return;
      stopAnimation(); // 手動操作時停止動畫
      dragging = true;
      startX = e.clientX;
      startY = e.clientY;
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
   * @param {number} padding 邊距 (預設 50)
   */
  window.setAutoCamera = function (padding = 50, animate = true) {
    const vp = window.getViewport();
    if (!vp) return;

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;
    let found = false;

    // 取得 viewport 下的所有子物件
    Array.from(vp.children).forEach(node => {
      const tag = node.tagName.toLowerCase();
      const fill = node.getAttribute && node.getAttribute('fill');
      const id = node.getAttribute('id');

      // 排除背景格線與箭頭層
      if (tag === 'rect' && fill === 'url(#gridPattern)') return;
      if (id === 'arrow-layer') return;

      try {
        const bbox = node.getBBox();
        // 考慮到物件本身可能有 transform (例如 translate)
        let tx = 0, ty = 0;
        const transform = node.getAttribute('transform');
        if (transform) {
          const match = /translate\s*\(\s*([+\-]?[\d\.]+)\s*[,\s]\s*([+\-]?[\d\.]+)\s*\)/.exec(transform);
          if (match) { tx = parseFloat(match[1]); ty = parseFloat(match[2]); }
        }

        minX = Math.min(minX, bbox.x + tx);
        minY = Math.min(minY, bbox.y + ty);
        maxX = Math.max(maxX, bbox.x + tx + bbox.width);
        maxY = Math.max(maxY, bbox.y + ty + bbox.height);
        found = true;
      } catch (e) { }
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

    const contentW = (maxX - minX) + padding * 2;
    const contentH = (maxY - minY) + padding * 2;

    const scaleW = rect.width / contentW;
    const scaleH = rect.height / contentH;
    let targetScale = Math.min(scaleW, scaleH);

    // 限制最大縮放比例，避免只有一個小物件時放得太大
    if (targetScale > 2.0) targetScale = 2.0;
    if (targetScale < 0.1) targetScale = 0.1;

    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    window.setCamera(midX, midY, targetScale, animate);
  };

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
