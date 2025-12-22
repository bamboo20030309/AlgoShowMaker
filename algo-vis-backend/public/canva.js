// canva.js
// 畫布初始化、無限座標格、平移、縮放核心邏輯

(function() {
  const NS = 'http://www.w3.org/2000/svg';
  let svg, viewport;
  let scale = 1, translateX = 40, translateY = 80;
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
    svg.addEventListener('mouseup',   () => dragging = false);
    svg.addEventListener('mouseleave',() => dragging = false);

    svg.addEventListener('wheel', e => {
      e.preventDefault();
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const oldScale = scale;
      scale *= (e.deltaY < 0 ? 1.1 : 1/1.1);
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
  window.clearCanvas = function(full = false) {
      const vp = window.getViewport && window.getViewport();
      if (!vp) return;

      // 清除 viewport 裡的元素，但保留格線那個 rect
      const children = Array.from(vp.children);
      children.forEach(node => {
          // ★ 這就是格線背景：在 canva.js 裡是 bg，那個 fill 是 url(#gridPattern)
          const tag = node.tagName.toLowerCase();
          const fill = node.getAttribute && node.getAttribute('fill');

          if (tag === 'rect' && fill === 'url(#gridPattern)') {
              // 這個是無限格線背景 → 不刪
              return;
          }

          vp.removeChild(node);
      });

      // 若 full==true，重置畫布 transform（拖曳 / 縮放）
      if (full) {
          vp.setAttribute("transform", "");
          vp.removeAttribute("data-translate");
          vp.removeAttribute("data-scale");
      }

      // 確保所有箭頭動畫狀態也一併重置
      if (window.clearArrows) {
          window.clearArrows();
      }
  };

  // 暴露給外部使用
  window.updateTransform = updateTransform;
  window.getViewport = () => viewport;
  window.getScale = () => scale;

  document.addEventListener('DOMContentLoaded', initCanvas);
})();
