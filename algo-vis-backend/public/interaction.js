// interaction.js
// CanvasInteractionManager：使用 Pointer Events 實現「選取 + 拖曳物件，不干擾畫布平移」
// 支援縮放補償，拖曳物件時會考慮當前 scale

class CanvasInteractionManager {
    /**
     * @param {SVGSVGElement} svg      - 主 SVG 容器 (#arraySvg)
     */
    constructor(svg) {
      this.svg = svg;
      this.selected = null;     // 當前選中的 .draggable-object
      this.mode     = null;     // 'drag' 或 null
      this.last     = { x: 0, y: 0 };
  
      // 1) 點擊切換選取／取消
      svg.addEventListener('click', e => this.onClick(e), false);
  
      // 2) Pointer 事件處理拖曳
      svg.addEventListener('pointerdown',  e => this.onPointerDown(e),  false);
      svg.addEventListener('pointermove',  e => this.onPointerMove(e),  false);
      svg.addEventListener('pointerup',    e => this.onPointerUp(e),    false);
      svg.addEventListener('pointercancel', e => this.onPointerUp(e),    false);
      window.addEventListener('pointerup',    e => this.onPointerUp(e),  false);
      window.addEventListener('pointercancel', e => this.onPointerUp(e),  false);
  
      // 3) 插入選中樣式
      const style = document.createElement('style');
      style.textContent = `
        .draggable-object.selected > rect {
          stroke: #3d85c6;
          stroke-width: 2px;
        }
      `;
      document.head.appendChild(style);
    }
  
    // 點擊事件：選中或取消
    onClick(evt) {
      const obj = evt.target.closest('.draggable-object');
      if (obj && this.svg.contains(obj)) {
        if (this.selected !== obj) {
          this.clearSelection();
          this.selected = obj;
          obj.classList.add('selected');
        }
      } else {
        this.clearSelection();
      }
    }
  
    clearSelection() {
      if (this.selected) {
        this.selected.classList.remove('selected');
        this.selected = null;
      }
    }
  
    // pointerdown：若點在已選中的物件，啟動拖曳模式（攔截畫布平移）
    onPointerDown(evt) {
      if (evt.button !== 0) return; // 僅處理左鍵
      const obj = evt.target.closest('.draggable-object');
      if (obj && this.selected === obj) {
        // 開始拖曳物件
        this.svg.setPointerCapture(evt.pointerId);
        evt.stopPropagation();
        evt.preventDefault();
        this.mode = 'drag';
        this.last = { x: evt.clientX, y: evt.clientY };
      } else {
        // 沒有拖曳物件時不攔截，讓 canva.js 處理平移
        this.mode = null;
      }
    }
  
    // pointermove：僅在 drag 模式下處理物件拖曳，補償 scale
    onPointerMove(evt) {
      if (this.mode !== 'drag' || !this.selected) return;
      evt.stopPropagation();
      // 計算螢幕位移
      const dx = evt.clientX - this.last.x;
      const dy = evt.clientY - this.last.y;
      this.last = { x: evt.clientX, y: evt.clientY };
  
      // 補償當前 scale
      const s = window.getScale ? window.getScale() : 1;
      const wx = dx / s;
      const wy = dy / s;
  
      // 更新群組的 data-translate 與 transform
      const grp = this.selected;
      const [tx, ty] = (grp.getAttribute('data-translate') || '0,0')
                        .split(',').map(Number);
      const ntx = tx + wx, nty = ty + wy;
      
      grp.setAttribute('data-translate', `${ntx},${nty}`);
//      grp.setAttribute('transform', `translate(${ntx},${nty})`);
      // 讀 base-offset
      const [bx, by] = (grp.getAttribute('data-base-offset') || '0,0')
                        .split(',').map(Number);
      // 合併後設定 transform
      grp.setAttribute(
        'transform',
        `translate(${bx + ntx},${by + nty})`
      );      
      // 若有綁定箭頭，就更新它們的座標
      if (window.updateArrows) {
        window.updateArrows();
      }
    }
  
    // pointerup / pointercancel：結束拖曳並釋放 capture
    onPointerUp(evt) {
      if (this.mode === 'drag') {
        try { this.svg.releasePointerCapture(evt.pointerId); } catch {}
        this.mode = null;
        evt.stopPropagation();
      }
    }
}