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
  
      // 3) 原生雙擊監聽器，確保左鍵兩下 100% 穩定選取與編輯
      svg.addEventListener('dblclick', e => this.onDblClick(e), false);
  
      // 4) 插入選中樣式 (箭頭不再使用簡單虛線外框，改由 SVG 控制點繪製，這樣更容易對齊且精緻)
      const style = document.createElement('style');
      style.textContent = `
        .draggable-object.selected > rect {
          stroke: #3d85c6;
          stroke-width: 2px;
        }
      `;
      document.head.appendChild(style);

      // 5) 監聽 viewport transform 屬性變化，自動更新選取框
      const setupViewportObserver = () => {
        const vp = window.getViewport ? window.getViewport() : svg.querySelector('#viewport');
        if (vp) {
          const observer = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
              if (mutation.attributeName === 'transform') {
                this.updateSelectionOverlay();
              }
            });
          });
          observer.observe(vp, { attributes: true, attributeFilter: ['transform'] });
        } else {
          // 如果 viewport 還沒建立，等一下再試
          setTimeout(setupViewportObserver, 50);
        }
      };
      setupViewportObserver();
    }
  
    // 點擊事件：點空白處取消選取（選中邏輯在 onPointerDown 處理）
    onClick(evt) {
      // 藉由相同的滑鼠位置判斷是否有點到物件，若無則取消選取
      const pt = this.svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      let cursor = pt;
      const vp = window.getViewport ? window.getViewport() : this.svg;
      try {
        cursor = pt.matrixTransform(vp.getScreenCTM().inverse());
      } catch(e) {}

      // 檢查附近是否有箭頭
      const lines = Array.from(this.svg.querySelectorAll('line.draggable-object'));
      let bestLine = null;
      let minDist = Infinity;
      for (const line of lines) {
        const x1 = parseFloat(line.getAttribute('x1') || 0);
        const y1 = parseFloat(line.getAttribute('y1') || 0);
        const x2 = parseFloat(line.getAttribute('x2') || 0);
        const y2 = parseFloat(line.getAttribute('y2') || 0);
        const dist = this.getDistanceToSegment(cursor.x, cursor.y, x1, y1, x2, y2);
        if (dist < minDist) {
          minDist = dist;
          bestLine = line;
        }
      }

      const s = window.getScale ? window.getScale() : 1;
      const threshold = 15 / s;
      let clickedObj = null;
      if (minDist < threshold && bestLine) {
        clickedObj = bestLine;
      } else {
        clickedObj = evt.target.closest('.draggable-object');
      }

      if (!clickedObj || !this.svg.contains(clickedObj)) {
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
      this.updateSelectionOverlay();
    }

    // 重繪後 DOM 元素會被替換，用 ID 重新綁定選取
    refreshSelection() {
      if (!this.selected) return;
      const id = this.selected.getAttribute('id');
      if (!id) { this.selected = null; this.updateSelectionOverlay(); return; }
      const newEl = this.svg.querySelector('#' + CSS.escape(id) + '.draggable-object');
      if (newEl) {
        this.selected = newEl;
        newEl.classList.add('selected');
      } else {
        this.selected = null;
      }
      this.updateSelectionOverlay();
    }
  
    // 原生雙擊事件處理，100% 穩定
    onDblClick(evt) {
      const obj = evt.target.closest('.draggable-object');
      if (obj && this.svg.contains(obj)) {
        // 雙擊發生時，立刻將可能已經觸發的拖曳狀態徹底中斷
        this._pendingDrag = false;
        this.mode = null;
        if (window.onObjectDoubleClick) {
          window.onObjectDoubleClick(obj);
        }
      }
    }

    // 計算點到線段的最短距離
    getDistanceToSegment(px, py, x1, y1, x2, y2) {
      const dx = x2 - x1;
      const dy = y2 - y1;
      const l2 = dx * dx + dy * dy;
      if (l2 === 0) return Math.hypot(px - x1, py - y1);
      let t = ((px - x1) * dx + (py - y1) * dy) / l2;
      t = Math.max(0, Math.min(1, t));
      return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
    }

    // 動態更新選取輔助框/控制點 (對齊更方便，視覺效果類似 Draw.io)
    updateSelectionOverlay() {
      let overlay = this.svg.querySelector('#selection-overlay');
      if (overlay) overlay.remove();

      if (!this.selected) return;

      const grp = this.selected;
      if (grp.tagName.toLowerCase() === 'line') {
        const vp = window.getViewport ? window.getViewport() : this.svg;
        overlay = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        overlay.setAttribute('id', 'selection-overlay');
        overlay.setAttribute('style', 'pointer-events: none;'); // 不影響滑鼠穿透

        const x1 = parseFloat(grp.getAttribute('x1') || 0);
        const y1 = parseFloat(grp.getAttribute('y1') || 0);
        const x2 = parseFloat(grp.getAttribute('x2') || 0);
        const y2 = parseFloat(grp.getAttribute('y2') || 0);

        const hasHeadStart = grp.hasAttribute('marker-start');
        const hasHeadEnd = grp.hasAttribute('marker-end');
        const strokeW_line = parseFloat(grp.getAttribute('stroke-width') || 4);
        const shrinkStart = hasHeadStart ? (12 + (strokeW_line - 4) * 3) : 0;
        const shrinkEnd = hasHeadEnd ? (12 + (strokeW_line - 4) * 3) : 0;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.hypot(dx, dy);
        let ux = 0, uy = 0;
        if (len > 0) {
          ux = dx / len;
          uy = dy / len;
        }

        const tipX1 = x1 - ux * shrinkStart;
        const tipY1 = y1 - uy * shrinkStart;
        const tipX2 = x2 + ux * shrinkEnd;
        const tipY2 = y2 + uy * shrinkEnd;

        const s = window.getScale ? window.getScale() : 1;
        const boxSize = 8 / s;
        const boxHalf = 4 / s;
        const strokeW = 1.5 / s;
        const strokeW2 = 2 / s;

        // 畫一條藍色虛線重疊在箭頭上作為選取標記（從起點尖端畫到終點尖端）
        const helperLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        helperLine.setAttribute('x1', tipX1);
        helperLine.setAttribute('y1', tipY1);
        helperLine.setAttribute('x2', tipX2);
        helperLine.setAttribute('y2', tipY2);
        helperLine.setAttribute('stroke', '#3d85c6');
        helperLine.setAttribute('stroke-width', strokeW);
        helperLine.setAttribute('stroke-dasharray', `${3/s},${3/s}`);
        overlay.appendChild(helperLine);

        // 畫起點控制方格
        const h1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        h1.setAttribute('x', tipX1 - boxHalf);
        h1.setAttribute('y', tipY1 - boxHalf);
        h1.setAttribute('width', boxSize);
        h1.setAttribute('height', boxSize);
        h1.setAttribute('fill', '#ffffff');
        h1.setAttribute('stroke', '#3d85c6');
        h1.setAttribute('stroke-width', strokeW2);
        overlay.appendChild(h1);

        // 畫終點控制方格
        const h2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        h2.setAttribute('x', tipX2 - boxHalf);
        h2.setAttribute('y', tipY2 - boxHalf);
        h2.setAttribute('width', boxSize);
        h2.setAttribute('height', boxSize);
        h2.setAttribute('fill', '#ffffff');
        h2.setAttribute('stroke', '#3d85c6');
        h2.setAttribute('stroke-width', strokeW2);
        overlay.appendChild(h2);

        vp.appendChild(overlay);
      }
    }
  
    // pointerdown：記錄起始位置，等 pointermove 確認有移動才真正啟動拖曳
    onPointerDown(evt) {
      if (evt.button !== 0) return; // 僅處理左鍵
      
      // 如果目前正在進行文字內聯編輯，不允許拖曳 any 物件以防止干擾選取
      if (window.isInlineEditing) {
        this._pendingDrag = false;
        this.mode = null;
        return;
      }

      // 取得在 SVG 空間的滑鼠點
      let pt = this.svg.createSVGPoint();
      pt.x = evt.clientX; pt.y = evt.clientY;
      let cursor = pt;
      const vp = window.getViewport ? window.getViewport() : this.svg;
      try {
        cursor = pt.matrixTransform(vp.getScreenCTM().inverse());
      } catch(e) {}

      // 優先檢查滑鼠點擊是否在任何箭頭 (line.draggable-object) 附近
      const lines = Array.from(this.svg.querySelectorAll('line.draggable-object'));
      let bestLine = null;
      let minDist = Infinity;

      for (const line of lines) {
        const x1 = parseFloat(line.getAttribute('x1') || 0);
        const y1 = parseFloat(line.getAttribute('y1') || 0);
        const x2 = parseFloat(line.getAttribute('x2') || 0);
        const y2 = parseFloat(line.getAttribute('y2') || 0);
        const dist = this.getDistanceToSegment(cursor.x, cursor.y, x1, y1, x2, y2);
        if (dist < minDist) {
          minDist = dist;
          bestLine = line;
        }
      }

      const s = window.getScale ? window.getScale() : 1;
      const threshold = 15 / s;

      let obj = null;
      // 點擊距離小於 threshold，優先選取箭頭
      if (minDist < threshold && bestLine) {
        obj = bestLine;
      } else {
        obj = evt.target.closest('.draggable-object');
      }

      if (obj && this.svg.contains(obj)) {
        // 先選中物件（不管之前有沒有選中）
        if (this.selected && this.selected !== obj) {
          this.selected.classList.remove('selected');
        }
        this.selected = obj;
        obj.classList.add('selected');
        this.updateSelectionOverlay();

        // 區分拖曳行為：如果是箭頭 (line)，點擊兩頭是拉單邊，點中間是整體拖曳
        this._dragType = null;
        if (obj.tagName.toLowerCase() === 'line') {
          const x1 = parseFloat(obj.getAttribute('x1') || 0);
          const y1 = parseFloat(obj.getAttribute('y1') || 0);
          const x2 = parseFloat(obj.getAttribute('x2') || 0);
          const y2 = parseFloat(obj.getAttribute('y2') || 0);

          const hasHeadStart = obj.hasAttribute('marker-start');
          const hasHeadEnd = obj.hasAttribute('marker-end');
          const strokeW_line = parseFloat(obj.getAttribute('stroke-width') || 4);
          const shrinkStart = hasHeadStart ? (12 + (strokeW_line - 4) * 3) : 0;
          const shrinkEnd = hasHeadEnd ? (12 + (strokeW_line - 4) * 3) : 0;

          const dx = x2 - x1;
          const dy = y2 - y1;
          const len = Math.hypot(dx, dy);
          let ux = 0, uy = 0;
          if (len > 0) {
            ux = dx / len;
            uy = dy / len;
          }

          const tipX1 = x1 - ux * shrinkStart;
          const tipY1 = y1 - uy * shrinkStart;
          const tipX2 = x2 + ux * shrinkEnd;
          const tipY2 = y2 + uy * shrinkEnd;
          
          const distStart = Math.hypot(cursor.x - tipX1, cursor.y - tipY1);
          const distEnd = Math.hypot(cursor.x - tipX2, cursor.y - tipY2);
          
          if (distStart < threshold) {
            this._dragType = 'start';
          } else if (distEnd < threshold) {
            this._dragType = 'end';
          } else {
            this._dragType = 'all';
          }
          
          this._origX1 = x1;
          this._origY1 = y1;
          this._origX2 = x2;
          this._origY2 = y2;
        }

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

      if (grp.tagName.toLowerCase() === 'line') {
        if (this._dragType === 'start') {
          grp.setAttribute('x1', this._origX1 + ntx);
          grp.setAttribute('y1', this._origY1 + nty);
        } else if (this._dragType === 'end') {
          grp.setAttribute('x2', this._origX2 + ntx);
          grp.setAttribute('y2', this._origY2 + nty);
        } else {
          // 'all'
          grp.setAttribute('x1', this._origX1 + ntx);
          grp.setAttribute('y1', this._origY1 + nty);
          grp.setAttribute('x2', this._origX2 + ntx);
          grp.setAttribute('y2', this._origY2 + nty);
        }
        this.updateSelectionOverlay();
      } else {
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
            window.onObjectDragEnd(id, ntx, nty, this._dragType);
          }
          grp.setAttribute('data-translate', '0,0');
        }
      }
    }
}
