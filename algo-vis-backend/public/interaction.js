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
  
    // 點擊事件：點空白處取消選取（選中邏輯在 onPointerDown 處理）
    onClick(evt) {
      const obj = evt.target.closest('.draggable-object');
      if (!obj || !this.svg.contains(obj)) {
        // 點到空白處 → 取消選取並關閉面板
        this.clearSelection();
        if (window.GuiEditor) {
          window.GuiEditor.hidePropPanel();
          window.GuiEditor.hideCtxMenu();
        }
      }
    }
  
    clearSelection() {
      if (this.selected) {
        this.selected.classList.remove('selected');
        this.selected = null;
      }
    }

    // 重繪後 DOM 元素會被替換，用 ID 重新綁定選取
    refreshSelection() {
      if (!this.selected) return;
      const id = this.selected.getAttribute('id');
      if (!id) { this.selected = null; return; }
      const newEl = this.svg.querySelector('#' + CSS.escape(id) + '.draggable-object');
      if (newEl) {
        this.selected = newEl;
        newEl.classList.add('selected');
      } else {
        this.selected = null;
      }
    }
  
    // pointerdown：記錄起始位置，等 pointermove 確認有移動才真正啟動拖曳
    onPointerDown(evt) {
      if (evt.button !== 0) return; // 僅處理左鍵
      const obj = evt.target.closest('.draggable-object');
      if (obj && this.svg.contains(obj)) {
        // 先選中物件（不管之前有沒有選中）
        if (this.selected && this.selected !== obj) {
          this.selected.classList.remove('selected');
        }
        this.selected = obj;
        obj.classList.add('selected');

        // 進入「準備拖曳」模式，等 pointermove 確認
        this._pendingDrag = true;
        this._dragPointerId = evt.pointerId;
        this.mode = null;
        this.last = { x: evt.clientX, y: evt.clientY };
        this._downPos = { x: evt.clientX, y: evt.clientY };
        evt.stopPropagation();
        evt.preventDefault();
      } else {
        this._pendingDrag = false;
        this.mode = null;
      }
    }
  
    // pointermove：先偵測是否要升級為拖曳，再處理物件位移
    onPointerMove(evt) {
      // 從 pendingDrag 升級為真正的 drag
      if (this._pendingDrag && !this.mode) {
        const dx = evt.clientX - this._downPos.x;
        const dy = evt.clientY - this._downPos.y;
        if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
          // 超過閾值，正式進入拖曳
          this.mode = 'drag';
          this._pendingDrag = false;
          try { this.svg.setPointerCapture(this._dragPointerId); } catch {}
        } else {
          return; // 還沒超過閾值，等待
        }
      }

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
      this._pendingDrag = false; // 清除待拖曳狀態
      if (this.mode === 'drag') {
        const grp = this.selected;
        try { this.svg.releasePointerCapture(evt.pointerId); } catch {}
        this.mode = null;
        evt.stopPropagation();

        // [新增] 拖曳結束後，通知 GUI 編輯器更新 C++
        if (window.onObjectDragEnd && grp) {
          const id = grp.getAttribute('id');
          const [ntx, nty] = (grp.getAttribute('data-translate') || '0,0')
                              .split(',').map(Number);
          // 沒有實際移動就不觸發回寫
          if (Math.abs(ntx) > 0.01 || Math.abs(nty) > 0.01) {
            window.onObjectDragEnd(id, ntx, nty);
          }
          grp.setAttribute('data-translate', '0,0');
        }
      }
    }
}