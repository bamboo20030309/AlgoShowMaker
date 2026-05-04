/* gui_editor.js — 畫布 GUI 編輯器 Phase 1: 攔截 + 右鍵選單 + 屬性面板 */
; (function () {
  'use strict';

  // ============================================================
  //  1. Draw Call 攔截與記錄
  // ============================================================
  const _frameRegistry = {};   // frameNum -> [ {type, args, codeLine, groupID} ]
  let _recFrame = -1;
  let _recLine = -1;
  let _recording = false;

  function startRecording(frame) {
    _recFrame = frame;
    _recLine = -1;
    _recording = true;
    if (!_frameRegistry[frame]) _frameRegistry[frame] = [];
    else _frameRegistry[frame].length = 0;
  }
  function stopRecording() { _recording = false; }

  // Wrap addEditorHighlight
  const _origHL = window.addEditorHighlight;
  window.addEditorHighlight = function (line) {
    if (_recording) _recLine = line;
    if (_origHL) return _origHL.apply(this, arguments);
  };

  // Wrap drawArray
  const _origDA = window.drawArray;
  window.drawArray = function (groupID, pos, array, style, range, draw_type, itemsPerRow, index, gap) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'drawArray', groupID,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    if (_origDA) return _origDA.apply(this, arguments);
  };

  // Wrap draw2DArray
  const _origD2A = window.draw2DArray;
  window.draw2DArray = function (groupID, pos, matrix, style, range, draw_type, index) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'draw2DArray', groupID,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    if (_origD2A) return _origD2A.apply(this, arguments);
  };

  // Wrap drawArrow
  const _origAR = window.drawArrow;
  window.drawArrow = function (startSpec, endSpec, opt) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'drawArrow', groupID: null,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    return _origAR.apply(this, arguments);
  };

  // Wrap drawText
  const _origDT = window.drawText;
  window.drawText = function (content, pos) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'drawText', groupID: null,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    return _origDT.apply(this, arguments);
  };

  // Wrap drawColoredText
  const _origCT = window.drawColoredText;
  window.drawColoredText = function (segments, pos) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'drawColoredText', groupID: null,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    return _origCT.apply(this, arguments);
  };

  // Wrap drawCircle
  const _origDC = window.drawCircle;
  window.drawCircle = function (id, pos, value, style) {
    if (_recording) {
      _frameRegistry[_recFrame].push({
        type: 'drawCircle', groupID: id,
        args: Array.from(arguments),
        codeLine: _recLine
      });
    }
    return _origDC.apply(this, arguments);
  };

  // Hook into CodeScript rendering
  const _origClearCanvas = window.clearCanvas;
  window.clearCanvas = function (full) {
    // 在清畫布前開始記錄新的一幀
    if (window.CodeScript) {
      const f = window.CodeScript.get_current_frame_index();
      startRecording(f);
    }
    // 切換幀時自動關閉屬性面板與右鍵選單
    hidePropPanel();
    hideCtxMenu();
    return _origClearCanvas.apply(this, arguments);
  };

  // Hook sweepCanvas to stop recording
  const _origSweep = window.sweepCanvas;
  window.sweepCanvas = function () {
    stopRecording();
    if (_origSweep) return _origSweep.apply(this, arguments);
  };

  // ============================================================
  //  2. 工具函式
  // ============================================================
  function getCurrentFrameDrawCalls() {
    if (!window.CodeScript) return [];
    const f = window.CodeScript.get_current_frame_index();
    return _frameRegistry[f] || [];
  }

  function findDrawCallByGroupID(groupID) {
    const calls = getCurrentFrameDrawCalls();
    return calls.find(c => c.groupID === groupID) || null;
  }

  // 重新渲染當前幀（即時預覽）
  function replayCurrentFrame() {
    if (!window.CodeScript) return;
    const f = window.CodeScript.get_current_frame_index();
    const calls = _frameRegistry[f];
    if (!calls || calls.length === 0) return;

    // 暫停錄製以避免遞迴
    _recording = false;
    // 完整清空畫布（包含箭頭）
    const vp = window.getViewport();
    if (vp) {
      Array.from(vp.children).forEach(node => {
        const id = node.getAttribute('id');
        const fill = node.getAttribute('fill');
        if (fill && fill.includes('grid')) return;       // 保留背景格線
        if (id === 'drawingLayer') return;               // 保留塗鴉層
        vp.removeChild(node);                            // 刪掉包含 arrow-layer
      });
    }
    // 重置箭頭狀態
    if (window.resetArrows) window.resetArrows();
    _recording = false;

    calls.forEach(c => {
      switch (c.type) {
        case 'drawArray': _origDA.apply(null, c.args); break;
        case 'draw2DArray': _origD2A.apply(null, c.args); break;
        case 'drawArrow': _origAR.apply(null, c.args); break;
        case 'drawText': _origDT.apply(null, c.args); break;
        case 'drawColoredText': _origCT.apply(null, c.args); break;
        case 'drawCircle': _origDC.apply(null, c.args); break;
      }
    });

    if (window.sweepCanvas) window.sweepCanvas();

    // 重繪後 DOM 元素被替換，刷新選取狀態
    if (window._canvasInteraction && window._canvasInteraction.refreshSelection) {
      window._canvasInteraction.refreshSelection();
    }
  }

  /**
   * 拖曳結束的回呼 (由 interaction.js 觸發)
   */
  window.onObjectDragEnd = function (id, dx, dy) {
    const dc = findDrawCallByGroupID(id);
    if (!dc) return;

    const pos = dc.args[1];
    if (!pos) return;

    if (pos.type === 'rel' || pos.ref) {
      pos.dx = (pos.dx || 0) + dx;
      pos.dy = (pos.dy || 0) + dy;
      // 同步 x, y 以相容部分邏輯
      pos.x = pos.dx;
      pos.y = pos.dy;
    } else {
      pos.x = (pos.x || 0) + dx;
      pos.y = (pos.y || 0) + dy;
    }

    // 更新介面 (如果面板開著)
    if (_propPanel && _propPanel.style.display !== 'none' && _propDrawCall === dc) {
      showPropPanel(_currentPropSection);
    }

    replayCurrentFrame();
    syncPosToCpp(dc);
  };

  let _currentPropSection = 'all';

  // ============================================================
  //  3. 右鍵選單
  // ============================================================
  let _ctxMenu = null;
  let _ctxTarget = null;   // 右鍵點到的 .draggable-object
  let _ctxDrawCall = null;  // 對應的 draw call 記錄

  function createCtxMenu() {
    if (_ctxMenu) return _ctxMenu;
    _ctxMenu = document.createElement('div');
    _ctxMenu.className = 'gui-ctx-menu';
    _ctxMenu.style.display = 'none';
    document.body.appendChild(_ctxMenu);
    return _ctxMenu;
  }

  function hideCtxMenu() {
    if (_ctxMenu) _ctxMenu.style.display = 'none';
    _ctxTarget = null;
    _ctxDrawCall = null;
  }

  function showCtxMenu(e, obj, drawCall) {
    const menu = createCtxMenu();
    _ctxTarget = obj;
    _ctxDrawCall = drawCall;

    const id = obj.getAttribute('id') || '(無ID)';
    const type = drawCall ? drawCall.type : '未知';
    const line = drawCall ? drawCall.codeLine : -1;

    let html = `<div class="ctx-label">${type} — ${id}</div>`;

    if (drawCall && drawCall.type === 'drawArray') {
      html += `<div class="ctx-item" data-action="edit-pos"><span class="ctx-icon">📍</span>編輯位置</div>`;
      html += `<div class="ctx-item" data-action="edit-style"><span class="ctx-icon">🎨</span>編輯格子樣式</div>`;
      html += `<div class="ctx-item" data-action="edit-layout"><span class="ctx-icon">📐</span>編輯繪製參數</div>`;
    } else if (drawCall && drawCall.type === 'drawCircle') {
      html += `<div class="ctx-item" data-action="edit-pos"><span class="ctx-icon">📍</span>編輯位置</div>`;
      html += `<div class="ctx-item" data-action="edit-circle-style"><span class="ctx-icon">🎨</span>編輯樣式</div>`;
    } else {
      html += `<div class="ctx-item" data-action="edit-pos"><span class="ctx-icon">📍</span>編輯位置</div>`;
    }

    if (line >= 0) {
      html += `<div class="ctx-sep"></div>`;
      html += `<div class="ctx-item" data-action="goto-code"><span class="ctx-icon">📝</span>跳到程式碼 (行 ${line + 1})</div>`;
    }

    html += `<div class="ctx-sep"></div>`;
    html += `<div class="ctx-item" data-action="show-info"><span class="ctx-icon">ℹ️</span>顯示完整屬性</div>`;

    menu.innerHTML = html;
    menu.style.display = 'block';
    menu.style.left = Math.min(e.clientX, window.innerWidth - 200) + 'px';
    menu.style.top = Math.min(e.clientY, window.innerHeight - 300) + 'px';

    // 綁定事件
    menu.querySelectorAll('.ctx-item').forEach(item => {
      item.onclick = () => {
        const action = item.dataset.action;
        // 先保存引用，再隱藏選單
        const savedTarget = _ctxTarget;
        const savedDrawCall = _ctxDrawCall;
        hideCtxMenu();
        // 恢復引用供 handleCtxAction 使用
        _ctxTarget = savedTarget;
        _ctxDrawCall = savedDrawCall;
        handleCtxAction(action);
      };
    });
  }

  function handleCtxAction(action) {
    if (!_ctxDrawCall && action !== 'show-info') return;
    switch (action) {
      case 'edit-pos': _currentPropSection = 'pos'; showPropPanel('pos'); break;
      case 'edit-style': _currentPropSection = 'style'; showPropPanel('style'); break;
      case 'edit-layout': _currentPropSection = 'layout'; showPropPanel('layout'); break;
      case 'edit-circle-style': _currentPropSection = 'circle-style'; showPropPanel('circle-style'); break;
      case 'show-info': _currentPropSection = 'all'; showPropPanel('all'); break;
      case 'goto-code':
        if (_ctxDrawCall && _ctxDrawCall.codeLine >= 0) {
          const editor = getEditor();
          if (!editor) break;
          const line = _ctxDrawCall.codeLine; // 1-based
          // 先清除舊高亮，再加新的螢光色高亮
          if (typeof clearAllEditorHighlights === 'function') clearAllEditorHighlights();
          if (typeof addEditorHighlight === 'function') addEditorHighlight(line, true);
          editor.gotoLine(line, 0, true);
          editor.scrollToLine(line - 1, true, true, function () { });
          editor.focus();
        }
        break;
    }
  }

  // ============================================================
  //  4. 屬性面板
  // ============================================================
  let _propPanel = null;
  let _propDrawCall = null;
  let _propTarget = null;

  function createPropPanel() {
    if (_propPanel) return _propPanel;
    _propPanel = document.createElement('div');
    _propPanel.className = 'gui-prop-panel';
    _propPanel.style.display = 'none';
    document.body.appendChild(_propPanel);
    return _propPanel;
  }

  function hidePropPanel() {
    if (_propPanel) _propPanel.style.display = 'none';
  }

  function showPropPanel(section) {
    const panel = createPropPanel();
    _propDrawCall = _ctxDrawCall;
    _propTarget = _ctxTarget;

    if (!_propDrawCall) {
      const id = _propTarget ? _propTarget.getAttribute('id') : '?';
      panel.innerHTML = buildHeader('物件資訊 — ' + id) +
        `<div class="prop-section"><p style="color:#9ca3af;font-size:12px;">此物件無對應的繪圖呼叫記錄。<br>請先執行程式碼再嘗試編輯。</p></div>`;
      positionPanel(panel);
      // 綁定關閉
      const closeBtn = panel.querySelector('#prop-close-btn');
      if (closeBtn) closeBtn.onclick = hidePropPanel;
      return;
    }

    let content = '';
    const dc = _propDrawCall;
    const id = dc.groupID || _propTarget?.getAttribute('id') || '?';
    content += buildHeader(dc.type + ' — ' + id);

    if (section === 'all' || section === 'pos') {
      content += buildPosSection(dc);
    }
    if ((dc.type === 'drawArray' || dc.type === 'draw2DArray') && (section === 'all' || section === 'style')) {
      content += buildArrayStyleSection(dc);
    }
    if ((dc.type === 'drawArray' || dc.type === 'draw2DArray') && (section === 'all' || section === 'layout')) {
      content += buildArrayLayoutSection(dc);
    }
    if (dc.type === 'drawArrow' && (section === 'all' || section === 'style')) {
      content += buildArrowStyleSection(dc);
    }
    if (dc.type === 'drawCircle' && (section === 'all' || section === 'circle-style')) {
      content += buildCircleStyleSection(dc);
    }
    if (dc.codeLine >= 0) {
      content += `<div class="prop-section"><div class="prop-code-link" id="prop-goto-code">📝 跳到程式碼 (行 ${dc.codeLine + 1})</div></div>`;
    }

    panel.innerHTML = content;
    positionPanel(panel);
    bindPropEvents(panel, dc);
  }

  function positionPanel(panel) {
    panel.style.display = 'block';
    // 放在畫面右側
    panel.style.right = '20px';
    panel.style.left = 'auto';
    panel.style.top = '80px';
  }

  function buildHeader(title) {
    return `<div class="prop-header"><span>${title}</span><span class="prop-close" id="prop-close-btn">✕</span></div>`;
  }

  // --- 位置區塊 ---
  function buildPosSection(dc) {
    const posArg = (dc.type === 'drawArray' || dc.type === 'draw2DArray') ? dc.args[1] :
      dc.type === 'drawCircle' ? dc.args[1] :
        dc.type === 'drawText' ? dc.args[1] :
          dc.type === 'drawColoredText' ? dc.args[1] :
            dc.type === 'drawArrow' ? null : null;

    if (!posArg) return '';

    let rows = '';
    if (posArg.type === 'rel' || posArg.ref) {
      rows += propRow('模式', '<b>相對位置</b>', true);
      rows += propRow('參考 ID', inputField('pos-ref', posArg.ref || ''));

      // 處理 raw 定位偏移 (自動偏移)
      const isRaw = (posArg.anchor || '').includes('raw');
      const cleanAnchor = (posArg.anchor || '').replace('raw', '').trim() || 'center';

      rows += propRow('自動偏移', `
        <label class="gui-switch">
          <input type="checkbox" id="pos-raw-toggle" ${isRaw ? 'checked' : ''}>
          <span class="gui-slider"></span>
        </label>
        <span style="font-size:10px;color:#9ca3af;margin-left:5px"> (raw 語法)</span>
      `, true);

      // 錨點九宮格
      rows += propRow('對齊點', buildAnchorGrid(cleanAnchor), true);

      if (posArg.index !== undefined && posArg.index !== -1) {
        rows += propRow('格子索引', inputField('pos-index', posArg.index, 'number'));
      }
      rows += propRow('橫向偏移 (dx)', inputField('pos-dx', posArg.dx || posArg.x || 0, 'number'));
      rows += propRow('縱向偏移 (dy)', inputField('pos-dy', posArg.dy || posArg.y || 0, 'number'));
    } else {
      rows += propRow('模式', '<b>絕對位置</b>', true);
      rows += propRow('座標 X', inputField('pos-x', posArg.x || 0, 'number'));
      rows += propRow('座標 Y', inputField('pos-y', posArg.y || 0, 'number'));
    }

    return `<div class="prop-section"><div class="prop-section-title">定位與偏移</div>${rows}</div>`;
  }

  function buildAnchorGrid(activeAnchor) {
    const anchors = [
      'top left', 'top', 'top right',
      'left', 'center', 'right',
      'bottom left', 'bottom', 'bottom right'
    ];
    let html = '<div class="anchor-grid" id="pos-anchor-grid">';
    anchors.forEach(a => {
      const isActive = a === activeAnchor;
      html += `<div class="anchor-btn ${isActive ? 'active' : ''}" data-value="${a}" title="${a}"><div class="dot"></div></div>`;
    });
    html += '</div>';
    return html;
  }

  // --- 陣列樣式區塊 ---
  const AV_COLORS = [
    { name: 'AV_green', hex: 'rgba(165, 214, 167, 0.6)' },
    { name: 'AV_blue', hex: 'rgba(144, 202, 249, 0.6)' },
    { name: 'AV_red', hex: 'rgba(239, 154, 154, 0.6)' },
    { name: 'AV_yellow', hex: 'rgba(252, 255, 64, 0.46)' },
    { name: 'AV_orange', hex: 'orange' },
    { name: 'AV_node_green', hex: '#e8f5e9' },
    { name: 'AV_node_red', hex: '#ef9a9a' },
    { name: 'AV_node_grey', hex: '#cccccc' },
    { name: 'AV_black', hex: 'black' },
    { name: 'AV_white', hex: 'white' }
  ];

  function buildArrayStyleSection(dc) {
    const runtimeStyles = dc.args[3] || [];
    const actual = getActualParams(dc);
    const styleParamStr = (actual && actual[3] ? actual[3] : '').trim();
    const cppStyles = parseCppStyleLiteral(styleParamStr);

    const allArrayTypes = ['highlight', 'point', 'focus', 'mark', 'background'];
    const mergedStyles = [];
    allArrayTypes.forEach(t => {
      const existing = cppStyles.find(s => s.type === t) || runtimeStyles.find(s => (s.type || (Array.isArray(s) ? s[0] : '')) === t);
      if (existing) {
        mergedStyles.push({
          type: existing.type || (Array.isArray(existing) ? existing[0] : t),
          color: existing.color || '',
          elements: existing.elements || (Array.isArray(existing) ? existing.slice(2) : [])
        });
      } else {
        mergedStyles.push({ type: t, color: '', elements: [] });
      }
    });
    cppStyles.forEach(s => {
      if (!allArrayTypes.includes(s.type)) mergedStyles.push(s);
    });

    const typeBadgeColors = {
      highlight: '#ef4444', point: '#f59e0b', focus: '#3b82f6',
      mark: '#8b5cf6', background: '#10b981'
    };

    let items = '';
    mergedStyles.forEach((s, i) => {
      const sType = s.type;
      const sElements = s.elements;
      const badgeColor = typeBadgeColors[sType] || '#6b7280';

      let currentHex = '#d1d5db';
      const colorVal = s.color || '';
      const matchColor = AV_COLORS.find(c => colorVal.includes(c.name));
      if (matchColor) currentHex = matchColor.hex;
      else if (colorVal.startsWith('rgba') || colorVal.startsWith('#') || ['orange', 'black', 'white', 'red'].includes(colorVal)) currentHex = colorVal;

      const valText = sElements.join(', ');

      items += `<div class="cell-style-item array-style-item" style="display:flex; align-items:center; padding:6px 8px; border-bottom:1px solid #f3f4f6;" data-index="${i}" data-type="${sType}" data-color="${colorVal}">
        <div class="style-item-header" style="display:flex; align-items:center; gap:8px; width:85px; flex-shrink:0;">
          <span class="style-icon ${sType}"></span>
          <span style="color:${badgeColor}; font-weight:700; font-size:11px;">${sType}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex:1;">
          <input class="prop-input" style="flex:1; font-family:monospace; font-size:11px; background:#fff; height:24px; text-align:left;" 
                 data-style-idx="${i}" data-field="cpp-elements"
                 value="${valText}" title="元素列表 (C++ 索引)">
          <div class="color-picker-btn" style="width:20px; height:20px; border-radius:50%; cursor:pointer; background:${currentHex}; border:1px solid #d1d5db; flex-shrink:0;" title="選取樣式顏色" data-idx="${i}"></div>
        </div>
      </div>`;
    });

    return `<div class="prop-section">
      <div class="prop-section-title">格子樣式參數</div>
      <div class="cell-style-list">${items || '<div style="color:#9ca3af;padding:8px">無樣式變數</div>'}</div>
    </div>`;
  }

  function parseArrowStyleLiteral(str) {
    if (!str || !str.startsWith('{')) return [];
    let content = str.trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      content = content.substring(1, content.length - 1).trim();
    }
    const units = splitTopLevelArgs(content);
    return units.map(u => {
      u = u.trim();
      if (!u.startsWith('{')) return null;
      const inner = u.substring(1, u.length - 1).trim();
      const parts = splitTopLevelArgs(inner);
      if (parts.length < 2) return null;
      return {
        key: parts[0].replace(/"/g, '').trim(),
        value: parts[1].replace(/"/g, '').trim()
      };
    }).filter(x => x);
  }

  function buildArrowStyleSection(dc) {
    const actual = getActualParams(dc);
    const styleParamStr = (actual && actual.length > 2 ? actual[2] : '').trim();
    const cppStyles = parseArrowStyleLiteral(styleParamStr);

    const allArrowKeys = ['color', 'width', 'headStart', 'headEnd', 'animate', 'animateColor', 'tweenDuration', 'key'];
    const mergedStyles = [];
    allArrowKeys.forEach(k => {
      const existing = cppStyles.find(s => s.key === k);
      if (existing) mergedStyles.push(existing);
      else mergedStyles.push({ key: k, value: '' });
    });
    cppStyles.forEach(s => {
      if (!allArrowKeys.includes(s.key)) mergedStyles.push(s);
    });

    let items = '';
    mergedStyles.forEach((s, i) => {
      let currentHex = '#d1d5db';
      if (s.key === 'color' || s.key === 'animateColor') {
        const matchColor = AV_COLORS.find(c => s.value.includes(c.name));
        if (matchColor) currentHex = matchColor.hex;
        else if (s.value.startsWith('rgba') || s.value.startsWith('#') || ['orange', 'black', 'white', 'red'].includes(s.value)) currentHex = s.value;
      }

      items += `<div class="cell-style-item arrow-style-item" style="display:flex; align-items:center; padding:6px 8px; border-bottom:1px solid #f3f4f6;" data-index="${i}" data-key="${s.key}">
        <div class="style-item-header" style="display:flex; align-items:center; gap:8px; width:85px; flex-shrink:0;">
          <span style="color:#ef4444; font-weight:700; font-size:11px;">${s.key}</span>
        </div>
        <div style="display:flex; align-items:center; gap:6px; flex:1;">
          <input class="prop-input" style="flex:1; font-family:monospace; font-size:11px; background:#fff; height:24px; text-align:left;" 
                 data-arrow-style-idx="${i}" data-field="cpp-arrow-val"
                 value="${s.value}" title="值">
          ${(s.key === 'color' || s.key === 'animateColor') ? `<div class="color-picker-btn arrow-color-picker-btn" style="width:20px; height:20px; border-radius:50%; cursor:pointer; background:${currentHex}; border:1px solid #d1d5db; flex-shrink:0;" title="選取顏色" data-idx="${i}"></div>` : ''}
        </div>
      </div>`;
    });

    return `<div class="prop-section">
      <div class="prop-section-title">箭頭樣式參數</div>
      <div class="cell-style-list">${items || '<div style="color:#9ca3af;padding:8px">無樣式變數</div>'}</div>
    </div>`;
  }

  /**
   * 解析 C++ 樣式字面量: {{{"type"}, {v1, v2}}, {{"type2"}, {v3}}}
   * 回傳 [{type: "type", elements: ["v1", "v2"]}, ...]
   */
  function parseCppStyleLiteral(str) {
    if (!str || !str.startsWith('{')) return [];
    // 移除最外層大括號
    let content = str.trim();
    if (content.startsWith('{') && content.endsWith('}')) {
      content = content.substring(1, content.length - 1).trim();
    }

    // 拆分內部的 array_style 單元: {{"type", "color"}, {v1, v2}}
    const units = splitTopLevelArgs(content);
    return units.map(u => {
      u = u.trim();
      if (!u.startsWith('{')) return null;
      const inner = u.substring(1, u.length - 1).trim();
      const parts = splitTopLevelArgs(inner); // [ {"type","color"}, {v1,v2} ]
      if (parts.length < 2) return null;

      // 解析類型清單: {"highlight", "AV_red"}
      const typeListStr = parts[0].trim();
      let typeParts = [];
      if (typeListStr.startsWith('{')) {
        const tContent = typeListStr.substring(1, typeListStr.length - 1).trim();
        typeParts = splitTopLevelArgs(tContent).map(p => p.replace(/"/g, '').trim());
      } else {
        typeParts = [typeListStr.replace(/"/g, '').trim()];
      }

      const sType = typeParts[0];
      const sColor = typeParts[1] || '';

      const elementsStr = parts[1].trim();
      let elements = [];
      if (elementsStr.startsWith('{')) {
        const eContent = elementsStr.substring(1, elementsStr.length - 1).trim();
        elements = splitTopLevelArgs(eContent).map(e => e.trim());
      } else {
        elements = [elementsStr];
      }

      // 自動遷移邏輯：如果 elements 裡面藏了顏色常量，把它移到 color 欄位
      let foundColorInElements = '';
      elements = elements.filter(e => {
        if (e.includes('AV_')) {
          foundColorInElements = e;
          return false;
        }
        return true;
      });
      if (foundColorInElements && !sColor) {
        sColor = foundColorInElements;
      }

      return { type: sType, color: sColor, elements: elements };
    }).filter(x => x);
  }

  // --- 陣列繪製參數區塊 ---
  // --- 陣列佈局/參數區塊 ---
  function buildArrayLayoutSection(dc) {
    const drawType = dc.args[5] || 'normal';
    let itemsPerRow = 0, indexMode = 0, gap = 0;
    
    if (dc.type === 'draw2DArray') {
      indexMode = dc.args[6] || 0;
    } else {
      itemsPerRow = dc.args[6] || 0;
      indexMode = dc.args[7] || 0;
      gap = dc.args[8] || 0;
    }

    // 從 C++ 獲取實際參數字串 (包含變數名)
    const actual = getActualParams(dc);
    const dataVar = (actual && actual.length > 2 ? actual[2] : '').trim() || '(無法抓取)';
    const rangeStr = (actual && actual.length > 4 ? actual[4] : '').trim() || '{0}';

    let rangeHtml = '';

    if (dc.type === 'draw2DArray') {
      const matrix = dc.args[2] || [];
      const rowsCount = matrix.length;
      const colsCount = matrix.reduce((max, row) => Math.max(max, Array.isArray(row) ? row.length : 0), 0);
      const maxRow = rowsCount > 0 ? rowsCount - 1 : 0;
      const maxCol = colsCount > 0 ? colsCount - 1 : 0;
      
      let L_row = 0, L_col = 0, R_row = maxRow, R_col = maxCol;

      const match2 = rangeStr.match(/\{\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}\s*,\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}\s*\}/);
      if (match2) {
        L_col = isNaN(parseInt(match2[1])) ? 0 : parseInt(match2[1]);
        L_row = isNaN(parseInt(match2[2])) ? 0 : parseInt(match2[2]);
        R_col = isNaN(parseInt(match2[3])) ? maxCol : parseInt(match2[3]);
        R_row = isNaN(parseInt(match2[4])) ? maxRow : parseInt(match2[4]);
      } else {
        const match1 = rangeStr.match(/\{\s*\{\s*(\d+)\s*,\s*(\d+)\s*\}\s*\}/);
        if (match1) {
          L_col = isNaN(parseInt(match1[1])) ? 0 : parseInt(match1[1]);
          L_row = isNaN(parseInt(match1[2])) ? 0 : parseInt(match1[2]);
        }
      }

      rangeHtml = `
        <div class="dual-slider-container">
          <div style="font-size:10px; color:#6b7280; width:15px; flex-shrink:0;">X</div>
          <input type="text" class="prop-input dual-slider-input" id="range-L-x" value="${L_col}">
          <div class="slider-wrapper">
            <div class="slider-track"></div>
            <div class="slider-range-fill" id="range-fill-x"></div>
            <input type="range" class="dual-slider-range" id="slider-L-x" min="0" max="${maxCol}" value="${L_col}">
            <input type="range" class="dual-slider-range" id="slider-R-x" min="0" max="${maxCol}" value="${R_col}">
          </div>
          <input type="text" class="prop-input dual-slider-input" id="range-R-x" value="${R_col === maxCol ? '' : R_col}" placeholder="End">
        </div>
        <div class="dual-slider-container" style="margin-top:6px;">
          <div style="font-size:10px; color:#6b7280; width:15px; flex-shrink:0;">Y</div>
          <input type="text" class="prop-input dual-slider-input" id="range-L-y" value="${L_row}">
          <div class="slider-wrapper">
            <div class="slider-track"></div>
            <div class="slider-range-fill" id="range-fill-y"></div>
            <input type="range" class="dual-slider-range" id="slider-L-y" min="0" max="${maxRow}" value="${L_row}">
            <input type="range" class="dual-slider-range" id="slider-R-y" min="0" max="${maxRow}" value="${R_row}">
          </div>
          <input type="text" class="prop-input dual-slider-input" id="range-R-y" value="${R_row === maxRow ? '' : R_row}" placeholder="End">
        </div>
      `;
    } else {
      let L = 0, R = (dc.args[2] ? dc.args[2].length - 1 : 0);
      const maxIdx = R;

      const listMatch = rangeStr.match(/\{([^}]+)\}/);
      if (listMatch) {
        const parts = listMatch[1].split(',').map(s => s.trim());
        L = isNaN(parseInt(parts[0])) ? 0 : parseInt(parts[0]);
        if (parts.length > 1) {
          R = isNaN(parseInt(parts[1])) ? maxIdx : parseInt(parts[1]);
        } else {
          R = maxIdx;
        }
      }

      rangeHtml = `
        <div class="dual-slider-container">
          <input type="text" class="prop-input dual-slider-input" id="range-L" value="${L}">
          <div class="slider-wrapper">
            <div class="slider-track"></div>
            <div class="slider-range-fill" id="range-fill"></div>
            <input type="range" class="dual-slider-range" id="slider-L" min="0" max="${maxIdx}" value="${L}">
            <input type="range" class="dual-slider-range" id="slider-R" min="0" max="${maxIdx}" value="${R}">
          </div>
          <input type="text" class="prop-input dual-slider-input" id="range-R" value="${R === maxIdx ? '' : R}" placeholder="End">
        </div>
      `;
    }

    let drawTypeOptions = '';
    if (dc.type === 'draw2DArray') {
      drawTypeOptions = ['normal', 'clear', 'binary']
        .map(t => `<option value="${t}" ${t === drawType ? 'selected' : ''}>${t}</option>`).join('');
    } else {
      drawTypeOptions = ['normal', 'heap', 'segment_tree', 'BIT', 'disk', 'stack', 'queue']
        .map(t => `<option value="${t}" ${t === drawType ? 'selected' : ''}>${t}</option>`).join('');
    }

    let indexOptions = '';
    if (dc.type === 'draw2DArray') {
      indexOptions = [
        { v: 0, t: '0 (無索引)' },
        { v: 1, t: '1 (左方索引)' },
        { v: 2, t: '2 (上方索引)' },
        { v: 3, t: '3 (左上方索引)' }
      ].map(o => `<option value="${o.v}" ${Number(indexMode) === o.v ? 'selected' : ''}>${o.t}</option>`).join('');
    } else {
      indexOptions = [
        { v: 0, t: '0 (不顯示索引)' },
        { v: 1, t: '1 (顯示索引)' },
        { v: 2, t: '2 (只顯示索引)' },
        { v: 3, t: '3 (顯示二進位索引)' },
        { v: 4, t: '4 (顯示前導零二進位索引)' }
      ].map(o => `<option value="${o.v}" ${Number(indexMode) === o.v ? 'selected' : ''}>${o.t}</option>`).join('');
    }

    let rows = '';
    rows += propRow('資料變數', inputField('prop-data-var', dataVar, 'text', true));
    
    if (dc.type === 'draw2DArray') {
      const parts = rangeHtml.split('<div class="dual-slider-container" style="margin-top:6px;">');
      if (parts.length > 1) {
        rows += propRow('顯示範圍 (X)', parts[0], true);
        rows += propRow('顯示範圍 (Y)', '<div class="dual-slider-container">' + parts[1], true);
      } else {
        rows += propRow('顯示範圍', rangeHtml, true);
      }
    } else {
      rows += propRow('顯示範圍', rangeHtml, true);
    }
    rows += propRow('繪圖模式', `<select class="prop-input" id="prop-drawtype">${drawTypeOptions}</select>`, true);

    if (dc.type !== 'draw2DArray') {
      rows += propRow('每行格子數量', inputField('prop-ipr', itemsPerRow, 'number'));
    }

    rows += propRow('顯示索引', `<select class="prop-input" id="prop-index">${indexOptions}</select>`, true);
    
    if (dc.type !== 'draw2DArray') {
      rows += propRow('格子間距', inputField('prop-gap', gap, 'number'));
    }

    return `<div class="prop-section"><div class="prop-section-title">陣列參數</div>${rows}</div>`;
  }

  function getActualParams(dc) {
    const editor = getEditor();
    if (!editor || dc.codeLine < 0) return null;
    const session = editor.getSession();

    let groupID = dc.groupID || '';
    if (!groupID && dc.args && typeof dc.args[0] === 'string' && dc.type !== 'drawArrow') {
      groupID = dc.args[0];
    }

    const searchCenter = dc.codeLine - 1;
    let lineText = '';
    let lineIdx = -1;

    const fnRegex = /((?:key_)?(?:frame_draw|draw_2Darray|arrow|draw_array|draw_circle|draw_triangle))\s*\(/;

    // 優先搜尋：含有關鍵字且含有 ID
    for (let offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      const idx = searchCenter + offset;
      if (idx < 0) continue;
      const t = session.getLine(idx);
      if (t && fnRegex.test(t)) {
        if (groupID === '' || t.includes('"' + groupID + '"') || t.includes(groupID)) {
          lineText = t;
          lineIdx = idx;
          break;
        }
      }
    }

    // 次優先：只要有關鍵字即可 (可能是 ID 被變數化了，或箭頭無 ID)
    if (!lineText) {
      for (let offset of [0, -1, 1, -2, 2]) {
        const idx = searchCenter + offset;
        if (idx < 0) continue;
        const t = session.getLine(idx);
        if (t && fnRegex.test(t)) {
          lineText = t;
          lineIdx = idx;
          break;
        }
      }
    }

    if (!lineText) return null;

    const drawMatch = lineText.match(fnRegex);
    if (!drawMatch) return null;

    const fnName = drawMatch[1];
    const fnStart = lineText.indexOf(fnName + '(');
    if (fnStart === -1) return null;

    const argsStr = extractFnArgs(lineText, fnStart + fnName.length);
    if (!argsStr) return null;

    return splitTopLevelArgs(argsStr);
  }

  // --- 圓形樣式區塊 ---
  function buildCircleStyleSection(dc) {
    const style = dc.args[3] || [];
    let bg = '#ffffff', fc = '#000', fs = 14, r = 25;
    style.forEach(s => {
      if (s.type === 'background') bg = s.color || bg;
      if (s.type === 'font_color') fc = s.color || fc;
      if (s.type === 'font_size') fs = parseFloat(s.color) || fs;
      if (s.type === 'radius') r = parseFloat(s.color) || r;
    });

    // 從 C++ 獲取實際參數字串 (包含變數名)
    const actual = getActualParams(dc);
    const styleVar = (actual && actual[3] ? actual[3] : '').trim() || '(無法抓取)';

    let rows = '';
    rows += propRow('樣式變數', inputField('prop-circle-style-var', styleVar));
    rows += propRow('背景色', colorField('circle-bg', bg));
    rows += propRow('字體色', colorField('circle-fc', fc));
    rows += propRow('字體大小', inputField('circle-fs', fs, 'number'));
    rows += propRow('半徑', inputField('circle-r', r, 'number'));
    return `<div class="prop-section"><div class="prop-section-title">🎨 圓形樣式</div>${rows}</div>`;
  }

  // --- 小工具 ---
  function propRow(label, valueHtml, isRaw) {
    return `<div class="prop-row"><span class="prop-label">${label}</span>${isRaw ? valueHtml : valueHtml}</div>`;
  }
  function inputField(id, value, type, isRequired) {
    type = type || 'text';
    const reqClass = (isRequired && (!value || value === '(無法抓取)')) ? 'required-empty' : '';
    return `<input class="prop-input ${reqClass}" id="${id}" type="${type}" value="${value}" 
            ${type === 'number' ? 'step="1"' : ''} ${isRequired ? 'placeholder="必填"' : ''}>`;
  }
  function colorField(id, value) {
    return `<span class="prop-color-swatch" style="background:${value}"></span>` +
      `<input class="prop-input" id="${id}" type="text" value="${value}" style="flex:1">`;
  }

  // --- 綁定事件 ---
  function bindPropEvents(panel, dc) {
    // 關閉按鈕
    const closeBtn = panel.querySelector('#prop-close-btn');
    if (closeBtn) closeBtn.onclick = hidePropPanel;

    // 跳到程式碼
    const gotoBtn = panel.querySelector('#prop-goto-code');
    if (gotoBtn) {
      gotoBtn.onclick = () => {
        if (dc.codeLine >= 0 && window.aceEditor) {
          window.aceEditor.gotoLine(dc.codeLine + 1, 0, true);
          window.aceEditor.focus();
        }
      };
    }

    // 位置修改
    ['pos-x', 'pos-y', 'pos-dx', 'pos-dy', 'pos-ref', 'pos-index', 'pos-raw-toggle'].forEach(id => {
      const el = panel.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('change', () => {
        applyPosChange(dc, panel);
        validateRequiredFields(panel);
      });
    });

    // 九宮格錨點點擊
    panel.querySelectorAll('#pos-anchor-grid .anchor-btn').forEach(btn => {
      btn.onclick = () => {
        panel.querySelectorAll('#pos-anchor-grid .anchor-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        applyPosChange(dc, panel);
      };
    });

    // 繪製參數修改
    ['prop-drawtype', 'prop-ipr', 'prop-index', 'prop-gap', 'prop-data-var', 'prop-style-var', 'prop-circle-style-var'].forEach(id => {
      const el = panel.querySelector('#' + id);
      if (!el) return;
      el.addEventListener('change', () => {
        if (id === 'prop-circle-style-var') applyCircleStyleChange(dc, panel);
        else applyLayoutChange(dc, panel);
        validateRequiredFields(panel);
      });
    });



    // 範圍滑條事件
    function bindDualSlider(axis) {
      const postfix = axis ? `-${axis}` : '';
      const sL = panel.querySelector(`#slider-L${postfix}`);
      const sR = panel.querySelector(`#slider-R${postfix}`);
      const iL = panel.querySelector(`#range-L${postfix}`);
      const iR = panel.querySelector(`#range-R${postfix}`);
      const fill = panel.querySelector(`#range-fill${postfix}`);

      if (!sL || !sR) return;

      const updateUI = () => {
        const valL = parseInt(sL.value);
        const valR = parseInt(sR.value);
        const max = parseInt(sR.max);

        iL.value = valL;
        iR.value = (valR === max) ? '' : valR;

        const pL = max === 0 ? 0 : (valL / max) * 100;
        const pR = max === 0 ? 100 : (valR / max) * 100;
        if (fill) {
          fill.style.left = pL + '%';
          fill.style.width = (pR - pL) + '%';
        }
      };

      sL.addEventListener('input', () => {
        if (parseInt(sL.value) >= parseInt(sR.value)) {
          sL.value = sR.value;
          sL.style.zIndex = "4"; // 重疊時優先抓取被操作的
          sR.style.zIndex = "3";
        }
        updateUI();
      });
      sR.addEventListener('input', () => {
        if (parseInt(sR.value) <= parseInt(sL.value)) {
          sR.value = sL.value;
          sR.style.zIndex = "4";
          sL.style.zIndex = "3";
        }
        updateUI();
      });

      // Z-index 切換邏輯：確保使用者點擊時能抓到正確的滑塊
      sL.addEventListener('mousedown', () => {
        sL.style.zIndex = "5";
        sR.style.zIndex = "4";
      });
      sR.addEventListener('mousedown', () => {
        sR.style.zIndex = "5";
        sL.style.zIndex = "4";
      });

      // 放開滑鼠：才同步 C++
      sL.addEventListener('change', () => applyLayoutChange(dc, panel));
      sR.addEventListener('change', () => applyLayoutChange(dc, panel));

      // 文字輸入框：依然保持原本的 change 同步
      [iL, iR].forEach(input => input.addEventListener('change', () => {
        sL.value = parseInt(iL.value) || 0;
        sR.value = iR.value.trim() === '' ? sR.max : (parseInt(iR.value) || 0);
        updateUI();
        applyLayoutChange(dc, panel);
      }));

      // 初始化
      updateUI();
    }

    if (dc.type === 'draw2DArray') {
      bindDualSlider('x');
      bindDualSlider('y');
    } else {
      bindDualSlider('');
    }

    // 初始驗證
    validateRequiredFields(panel);

    // DOM 寫回 C++ 邏輯：陣列樣式
    function rebuildArrayStyleFromDOM() {
      const items = Array.from(panel.querySelectorAll('.array-style-item'));
      const activeStyles = items.map(item => {
        const type = item.dataset.type;
        const color = item.dataset.color || '';
        const inp = item.querySelector('input[data-field="cpp-elements"]');
        const elements = splitTopLevelArgs(inp.value).map(s => s.trim()).filter(s => s !== '');
        return { type, color, elements };
      }).filter(s => s.elements.length > 0);

      if (activeStyles.length === 0) return '{}';

      return '{ ' + activeStyles.map(s => {
        const colorPart = s.color ? `, ${s.color.includes('AV_') ? s.color : '"' + s.color + '"'}` : '';
        return `{{ "${s.type}"${colorPart} }, { ${s.elements.join(', ')} }}`;
      }).join(', ') + ' }';
    }

    // DOM 寫回 C++ 邏輯：箭頭樣式
    function rebuildArrowStyleFromDOM() {
      const items = Array.from(panel.querySelectorAll('.arrow-style-item'));
      const activeStyles = items.map(item => {
        const key = item.dataset.key;
        const inp = item.querySelector('input[data-field="cpp-arrow-val"]');
        const value = inp.value.trim();
        return { key, value };
      }).filter(s => s.value !== '');

      if (activeStyles.length === 0) return '{}';

      return '{ ' + activeStyles.map(s => {
        const valPart = s.value.includes('AV_') ? s.value : `"${s.value}"`;
        return `{"${s.key}", ${valPart}}`;
      }).join(', ') + ' }';
    }

    // 樣式字面量修改 (回寫 C++ 變數)
    panel.querySelectorAll('input[data-field="cpp-elements"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const newStyleLiteral = rebuildArrayStyleFromDOM();
        
        // 更新 JS 運行時狀態以立即反映在畫布
        const items = Array.from(panel.querySelectorAll('.array-style-item'));
        dc.args[3] = items.map(item => {
          const type = item.dataset.type;
          const color = item.dataset.color || '';
          const elements = splitTopLevelArgs(item.querySelector('input[data-field="cpp-elements"]').value).map(s => s.trim()).filter(s => s !== '');
          if (elements.length > 0) return { type, color, elements };
          return null;
        }).filter(x => x);

        replayCurrentFrame();
        syncLayoutToCpp(dc, { styleVar: newStyleLiteral });
        showToast(`樣式變數已更新`, 'success');
      });
    });

    // 顏色按鈕點擊事件
    panel.querySelectorAll('.color-picker-btn:not(.arrow-color-picker-btn)').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = btn.closest('.array-style-item');
        openColorPalette(e, btn, (colorName, hex, isFinal) => {
          btn.style.background = hex;
          item.dataset.color = colorName;

          const sType = item.dataset.type;
          const styles = dc.args[3];
          if (styles) {
            const existing = styles.find(s => (s.type || (Array.isArray(s) ? s[0] : '')) === sType);
            if (existing) {
              existing.color = colorName;
              if (Array.isArray(existing)) existing[1] = colorName;
            }
          }
          replayCurrentFrame();

          if (isFinal) {
            const newStyleLiteral = rebuildArrayStyleFromDOM();
            syncLayoutToCpp(dc, { styleVar: newStyleLiteral });
            showToast(`樣式顏色已更新`, 'success');
          }
        });
      });
    });

    // 箭頭樣式輸入框
    panel.querySelectorAll('input[data-field="cpp-arrow-val"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const newStyleLiteral = rebuildArrowStyleFromDOM();
        
        // 更新 JS 運行時狀態以立即反映在畫布
        const key = inp.closest('.arrow-style-item').dataset.key;
        if (dc.args[2] && typeof dc.args[2] === 'object') {
          dc.args[2][key] = inp.value.trim();
        } else if (!dc.args[2] || Array.isArray(dc.args[2])) {
          // If it was an array (from C++ pair vector), we just build an object for JS runtime
          const newOpt = {};
          if (Array.isArray(dc.args[2])) {
            dc.args[2].forEach(p => { if (p.key) newOpt[p.key] = p.value; });
          }
          newOpt[key] = inp.value.trim();
          dc.args[2] = newOpt;
        }

        replayCurrentFrame();
        syncLayoutToCpp(dc, { styleVar: newStyleLiteral });
        showToast(`箭頭樣式變數已更新`, 'success');
      });
    });

    // 箭頭顏色選取器
    panel.querySelectorAll('.arrow-color-picker-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const item = btn.closest('.arrow-style-item');
        openColorPalette(e, btn, (colorName, hex, isFinal) => {
          btn.style.background = hex;
          const inp = item.querySelector('input[data-field="cpp-arrow-val"]');
          inp.value = colorName; // 更新 UI

          if (dc.args[2] && typeof dc.args[2] === 'object') {
            dc.args[2][item.dataset.key] = colorName;
          }
          replayCurrentFrame();

          if (isFinal) {
            const newStyleLiteral = rebuildArrowStyleFromDOM();
            syncLayoutToCpp(dc, { styleVar: newStyleLiteral });
            showToast(`箭頭樣式顏色已更新`, 'success');
          }
        });
      });
    });

    // 原始格子樣式修改（僅影響即時預覽）
    panel.querySelectorAll('.cell-style-list input[data-field="elements"]').forEach(inp => {
      inp.addEventListener('change', () => {
        const idx = parseInt(inp.dataset.styleIdx);
        const newEls = inp.value.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
        const styles = dc.args[3];
        if (styles && styles[idx]) {
          if (styles[idx].elements) styles[idx].elements = newEls;
        }
        replayCurrentFrame();
        syncStyleToCpp(dc, idx);
      });
    });
  }

  function validateRequiredFields(panel) {
    const fields = [
      { id: 'prop-data-var', required: true },
      { id: 'prop-range-var', required: true },
      { id: 'pos-ref', required: true }
    ];
    fields.forEach(f => {
      const el = panel.querySelector('#' + f.id);
      if (!el) return;
      const val = el.value.trim();
      if (!val || val === '(無法抓取)') {
        el.classList.add('required-empty');
      } else {
        el.classList.remove('required-empty');
      }
    });
  }

  function applyPosChange(dc, panel) {
    const posArgIdx = 1;
    const pos = dc.args[posArgIdx];
    if (!pos) return;

    if (pos.type === 'rel' || pos.ref) {
      const ref = panel.querySelector('#pos-ref');
      const dx = panel.querySelector('#pos-dx');
      const dy = panel.querySelector('#pos-dy');
      const idx = panel.querySelector('#pos-index');
      const rawToggle = panel.querySelector('#pos-raw-toggle');
      const activeBtn = panel.querySelector('#pos-anchor-grid .anchor-btn.active');

      if (ref) pos.ref = ref.value;

      // 組合錨點字串 (處理 raw)
      let anchorStr = activeBtn ? activeBtn.dataset.value : 'center';
      if (rawToggle && rawToggle.checked) anchorStr = 'raw ' + anchorStr;
      pos.anchor = anchorStr;

      if (dx) { pos.dx = parseFloat(dx.value) || 0; pos.x = pos.dx; }
      if (dy) { pos.dy = parseFloat(dy.value) || 0; pos.y = pos.dy; }
      if (idx) pos.index = parseInt(idx.value);
      if (isNaN(pos.index)) pos.index = -1;
    } else {
      const x = panel.querySelector('#pos-x');
      const y = panel.querySelector('#pos-y');
      if (x) pos.x = parseFloat(x.value) || 0;
      if (y) pos.y = parseFloat(y.value) || 0;
    }

    // 確保所有數字欄位都是 Number 類型，避免字串拼接
    pos.x = Number(pos.x || 0);
    pos.y = Number(pos.y || 0);
    if (pos.dx !== undefined) pos.dx = Number(pos.dx || 0);
    if (pos.dy !== undefined) pos.dy = Number(pos.dy || 0);

    replayCurrentFrame();
    syncPosToCpp(dc);
  }

  function applyLayoutChange(dc, panel) {
    const dt = panel.querySelector('#prop-drawtype');
    const ipr = panel.querySelector('#prop-ipr');
    const idx = panel.querySelector('#prop-index');
    const gap = panel.querySelector('#prop-gap');
    const dv = panel.querySelector('#prop-data-var');
    const iL = panel.querySelector('#range-L');
    const iR = panel.querySelector('#range-R');
    const sR = panel.querySelector('#slider-R');

    if (dt) dc.args[5] = dt.value;
    if (dc.type === 'draw2DArray') {
      if (idx) dc.args[6] = parseInt(idx.value) || 0;
    } else {
      if (ipr) dc.args[6] = parseInt(ipr.value) || 0;
      if (idx) dc.args[7] = parseInt(idx.value) || 0;
      if (gap) dc.args[8] = parseInt(gap.value) || 0;
    }

    // 回寫保護
    let dataVarValue = dv ? dv.value.trim() : null;
    if (dataVarValue === '(無法抓取)' || dataVarValue === 'undefined') dataVarValue = undefined;

    // 處理範圍語法 {L, R} 或 {{Ly, Lx}, {Ry, Rx}}
    let rangeVarValue = undefined;
    if (dc.type === 'draw2DArray') {
      const iL_y = panel.querySelector('#range-L-y');
      const iR_y = panel.querySelector('#range-R-y');
      const sR_y = panel.querySelector('#slider-R-y');
      const iL_x = panel.querySelector('#range-L-x');
      const iR_x = panel.querySelector('#range-R-x');
      const sR_x = panel.querySelector('#slider-R-x');

      if (iL_y && iR_y && iL_x && iR_x) {
        const Ly = parseInt(iL_y.value) || 0;
        const maxY = sR_y ? parseInt(sR_y.max) : 0;
        const Ry = iR_y.value.trim() === '' ? maxY : parseInt(iR_y.value);

        const Lx = parseInt(iL_x.value) || 0;
        const maxX = sR_x ? parseInt(sR_x.max) : 0;
        const Rx = iR_x.value.trim() === '' ? maxX : parseInt(iR_x.value);

        if (Ry >= maxY && Rx >= maxX && Ly === 0 && Lx === 0) {
          rangeVarValue = `{}`; // 全部預設
        } else if (Ry >= maxY && Rx >= maxX) {
          rangeVarValue = `{{${Lx}, ${Ly}}}`;
        } else {
          rangeVarValue = `{{${Lx}, ${Ly}}, {${Rx}, ${Ry}}}`;
        }
        dc.args[4] = (Ry >= maxY && Rx >= maxX) ? [[Lx, Ly]] : [[Lx, Ly], [Rx, Ry]];
      }
    } else {
      const iL = panel.querySelector('#range-L');
      const iR = panel.querySelector('#range-R');
      const sR = panel.querySelector('#slider-R');
      if (iL && iR) {
        const LVal = parseInt(iL.value) || 0;
        const max = sR ? parseInt(sR.max) : 0;
        const RVal = iR.value.trim() === '' ? max : parseInt(iR.value);

        if (RVal >= max) {
          rangeVarValue = `{${LVal}}`;
        } else {
          rangeVarValue = `{${LVal}, ${RVal}}`;
        }
        dc.args[4] = RVal >= max ? [LVal] : [LVal, RVal];
      }
    }

    const overrides = {
      dataVar: dataVarValue,
      rangeVar: rangeVarValue,
      styleVar: undefined
    };

    replayCurrentFrame();
    syncLayoutToCpp(dc, overrides);
  }

  function applyCircleStyleChange(dc, panel) {
    const sv = panel.querySelector('#prop-circle-style-var');
    const overrides = {
      dataVar: null,
      styleVar: sv ? sv.value : null
    };
    // 圓形的樣式通常在 args[3]
    syncLayoutToCpp(dc, overrides);
  }

  // ============================================================
  //  5. C++ 程式碼回寫
  // ============================================================

  /**
   * 將 JS Pos JSON 轉回 C++ Pos(...) 字串
   * 支援四種建構子:
   *   Pos(x, y)                              — 絕對
   *   Pos("ref", "anchor", dx, dy)            — 相對物件
   *   Pos("ref", index, "anchor", dx, dy)     — 相對格子
   *   Pos("ref", row, col, "anchor", dx, dy)  — 相對 2D 格子
   */
  function posJsonToCpp(pos) {
    if (!pos) return null;
    if (pos.type === 'rel' || pos.ref) {
      const ref = pos.ref || '';
      const anchor = pos.anchor || 'center';
      const dx = pos.dx != null ? pos.dx : (pos.x || 0);
      const dy = pos.dy != null ? pos.dy : (pos.y || 0);
      const hasRow = (pos.row != null && pos.row !== -1);
      const hasIdx = (pos.index != null && pos.index !== -1);

      if (hasRow) {
        const col = pos.col != null ? pos.col : 0;
        // Pos("ref", row, col, "anchor", dx, dy)
        let s = `Pos("${ref}", ${pos.row}, ${col}, "${anchor}"`;
        if (dx !== 0 || dy !== 0) s += `, ${fmtNum(dx)}, ${fmtNum(dy)}`;
        return s + ')';
      } else if (hasIdx) {
        // Pos("ref", index, "anchor", dx, dy)
        let s = `Pos("${ref}", ${pos.index}, "${anchor}"`;
        if (dx !== 0 || dy !== 0) s += `, ${fmtNum(dx)}, ${fmtNum(dy)}`;
        return s + ')';
      } else {
        // Pos("ref", "anchor", dx, dy)
        let s = `Pos("${ref}", "${anchor}"`;
        if (dx !== 0 || dy !== 0) s += `, ${fmtNum(dx)}, ${fmtNum(dy)}`;
        return s + ')';
      }
    } else {
      // 絕對位置 Pos(x, y)
      return `Pos(${fmtNum(pos.x || 0)}, ${fmtNum(pos.y || 0)})`;
    }
  }

  function fmtNum(n) {
    if (Number.isInteger(n)) return String(n);
    // 最多 4 位小數，去除尾部多餘的 0
    return parseFloat(n.toFixed(4)).toString();
  }

  /**
   * 取得 Ace Editor 實例
   */
  function getEditor() {
    // aceEditor 在 front.js 是用 const 宣告的，不在 window 上
    // 必須透過 ace.edit 重新取得同一個實例
    if (window.aceEditor) return window.aceEditor;
    try {
      // ace.edit('editor') 如果已存在同 ID 的 editor，會回傳同一個實例
      const el = document.getElementById('editor');
      if (el && el.env && el.env.editor) return el.env.editor;
    } catch (e) { }
    return null;
  }

  /**
   * 在 C++ 行中找到 Pos(...) 並替換
   * 支援巢狀括號 (Pos 內可能有字串含括號)
   */
  function replacePosInLine(line, newPosCpp) {
    // 找到 Pos( 的位置
    const posStart = line.indexOf('Pos(');
    if (posStart === -1) return null;

    // 從 Pos( 開始，找到對應的結尾 )
    let depth = 0;
    let inStr = false;
    let strChar = '';
    let end = -1;
    for (let i = posStart + 3; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }  // 跳過轉義
        if (c === strChar) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
      if (c === '(') depth++;
      if (c === ')') {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end === -1) return null;

    return line.substring(0, posStart) + newPosCpp + line.substring(end + 1);
  }

  /**
   * 同步位置修改到 C++ 程式碼
   * 用 groupID + Pos( 雙重驗證確保回寫到正確的行
   */
  function syncPosToCpp(dc) {
    const editor = getEditor();
    if (!editor || dc.codeLine < 0) return;

    const pos = dc.args[1];
    const newPosCpp = posJsonToCpp(pos);
    if (!newPosCpp) return;

    const session = editor.getSession();
    const groupID = dc.groupID || '';

    // 在 codeLine 附近搜尋包含 groupID 和 Pos( 的行
    let lineIdx = -1;
    let lineText = '';
    const searchCenter = dc.codeLine - 1; // 1-based → 0-based

    // 優先搜尋包含 groupID 的行（更嚴謹）
    for (let offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      const idx = searchCenter + offset;
      if (idx < 0) continue;
      const t = session.getLine(idx);
      if (!t) continue;

      // 最嚴格：同時包含 groupID 和 Pos(
      if (groupID && t.includes('"' + groupID + '"') && t.includes('Pos(')) {
        lineIdx = idx;
        lineText = t;
        break;
      }
    }

    // 退而求其次：只找 Pos( 的行
    if (lineIdx === -1) {
      for (let offset of [0, -1, 1, -2, 2]) {
        const idx = searchCenter + offset;
        if (idx < 0) continue;
        const t = session.getLine(idx);
        if (t && t.includes('Pos(')) {
          lineIdx = idx;
          lineText = t;
          break;
        }
      }
    }

    if (lineIdx === -1) {
      showToast(`行 ${dc.codeLine} 附近找不到 "${groupID}" 的 Pos(...)，無法回寫`, 'error');
      return;
    }

    const newLine = replacePosInLine(lineText, newPosCpp);
    if (newLine && newLine !== lineText) {
      const Range = ace.require('ace/range').Range;
      session.replace(new Range(lineIdx, 0, lineIdx, lineText.length), newLine);
      showToast(`已回寫 "${groupID}" 位置到行 ${lineIdx + 1}`, 'success');
    } else if (newLine === lineText) {
      showToast(`位置未變更`, 'info');
    }
  }

  /**
   * 同步陣列參數 (包含變數名稱) 到 C++
   * @param {Object} dc 
   * @param {Object} overrides 覆寫的變數名稱內容 { dataVar, styleVar }
   */
  function syncLayoutToCpp(dc, overrides = {}) {
    const editor = getEditor();
    if (!editor || dc.codeLine < 0) return;
    if (!['drawArray', 'draw2DArray', 'drawArrow', 'drawCircle'].includes(dc.type)) return;

    const session = editor.getSession();
    const groupID = dc.groupID || '';
    const searchCenter = dc.codeLine - 1;

    let lineIdx = -1;
    let lineText = '';

    // 優先：同時包含繪圖函式和 groupID
    for (let offset of [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5]) {
      const idx = searchCenter + offset;
      if (idx < 0) continue;
      const t = session.getLine(idx);
      if (t && (t.includes('draw') || t.includes('arrow')) && (groupID === '' || t.includes('"' + groupID + '"'))) {
        lineIdx = idx;
        lineText = t;
        break;
      }
    }

    // 退而求其次：只找繪圖函式
    if (lineIdx === -1) {
      for (let offset of [0, -1, 1, -2, 2]) {
        const idx = searchCenter + offset;
        if (idx < 0) continue;
        const t = session.getLine(idx);
        if (t && (t.includes('draw') || t.includes('arrow'))) {
          lineIdx = idx;
          lineText = t;
          break;
        }
      }
    }

    const drawMatch = lineText ? lineText.match(/((?:key_)?(?:frame_draw|draw_2Darray|arrow|draw_array|draw_circle|draw_triangle))\s*\(/) : null;
    if (!drawMatch) {
      showToast(`行 ${dc.codeLine} 附近找不到對應的繪圖函式，無法回寫`, 'error');
      return;
    }

    const fnName = drawMatch[1];
    const fnStart = lineText.indexOf(fnName + '(');
    if (fnStart === -1) return;

    // 找到函式呼叫的完整括號範圍，解析參數
    const argsStr = extractFnArgs(lineText, fnStart + fnName.length);
    if (!argsStr) return;

    // frame_draw 參數順序: (id, pos, data, style, range, draw_type, itemsPerRow, index, gap)
    // 索引:                  0    1    2      3     4        5           6        7     8
    const args = splitTopLevelArgs(argsStr);
    
    if (dc.type === 'drawArrow') {
      if (args.length < 2) return;
      if (overrides.styleVar !== undefined) args[2] = ' ' + overrides.styleVar;
    } else if (dc.type === 'draw2DArray') {
      const newDT = `"${dc.args[5] || 'normal'}"`;
      const newIdx = String(dc.args[6] || 0);

      while (args.length < 7) {
        if (args.length === 3) args.push(' {}');
        else if (args.length === 4) args.push(' {}');
        else if (args.length === 5) args.push(' "normal"');
        else if (args.length === 6) args.push(' 0');
      }

      if (overrides.dataVar !== undefined) args[2] = ' ' + overrides.dataVar;
      if (overrides.styleVar !== undefined) args[3] = ' ' + overrides.styleVar;
      if (overrides.rangeVar !== undefined) args[4] = ' ' + overrides.rangeVar;
      
      args[5] = ' ' + newDT;
      args[6] = ' ' + newIdx;
    } else {
      if (dc.type !== 'drawCircle') {
        while (args.length < 9) {
          if (args.length === 3) args.push(' {}');
          else if (args.length === 4) args.push(' {0}');
          else if (args.length === 5) args.push(' "normal"');
          else if (args.length === 6) args.push(' 0');
          else if (args.length === 7) args.push(' 0');
          else if (args.length === 8) args.push(' 0');
        }
      }

      // 更新參數
      const newDT = `"${dc.args[5] || 'normal'}"`;
      const newIPR = String(dc.args[6] || 0);
      const newIdx = String(dc.args[7] || 0);
      const newGap = String(dc.args[8] || 0);

      if (overrides.dataVar !== undefined) args[2] = ' ' + overrides.dataVar;
      if (overrides.styleVar !== undefined) args[3] = ' ' + overrides.styleVar;
      if (overrides.rangeVar !== undefined) args[4] = ' ' + overrides.rangeVar;
      
      if (dc.type !== 'drawCircle') {
        args[5] = ' ' + newDT;
        args[6] = ' ' + newIPR;
        args[7] = ' ' + newIdx;
        args[8] = ' ' + newGap;
      }
    }

    const newArgsStr = args.join(',');
    const newLine = lineText.substring(0, fnStart) + fnName + '(' + newArgsStr + ')' +
      lineText.substring(fnStart + fnName.length + 1 + argsStr.length + 1);

    if (newLine !== lineText) {
      const Range = ace.require('ace/range').Range;
      session.replace(
        new Range(lineIdx, 0, lineIdx, lineText.length),
        newLine
      );
      showToast(`已回寫 "${groupID}" 參數到行 ${lineIdx + 1}`, 'success');
    }
  }

  /**
   * 同步格子樣式修改到 C++ (通知用戶，因為樣式通常在變數中)
   */
  function syncStyleToCpp(dc, styleIdx) {
    // 格子樣式通常是透過變數定義的（如 pre_st.push_back(...)），
    // 直接替換比較困難，用 Toast 提示使用者手動確認。
    if (dc.codeLine >= 0) {
      showToast(`樣式已套用預覽，請手動確認行 ${dc.codeLine} 的 C++`, 'info');
    }
  }

  /**
   * 提取函式呼叫的完整參數字串 (括號內容)
   * startIdx 應指向 '(' 的位置
   */
  function extractFnArgs(line, startIdx) {
    if (line[startIdx] !== '(') return null;
    let depth = 0;
    let inStr = false;
    let strChar = '';
    for (let i = startIdx; i < line.length; i++) {
      const c = line[i];
      if (inStr) {
        if (c === '\\') { i++; continue; }
        if (c === strChar) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; strChar = c; continue; }
      if (c === '(') depth++;
      if (c === ')') {
        depth--;
        if (depth === 0) return line.substring(startIdx + 1, i);
      }
    }
    return null;
  }

  /**
   * 將最外層以逗號分隔的參數拆開 (不深入括號、字串內的逗號)
   */
  function splitTopLevelArgs(argsStr) {
    const result = [];
    let current = '';
    let depth = 0;
    let inStr = false;
    let strChar = '';
    for (let i = 0; i < argsStr.length; i++) {
      const c = argsStr[i];
      if (inStr) {
        current += c;
        if (c === '\\') { current += argsStr[++i] || ''; continue; }
        if (c === strChar) inStr = false;
        continue;
      }
      if (c === '"' || c === "'") { inStr = true; strChar = c; current += c; continue; }
      if (c === '(' || c === '{' || c === '[') { depth++; current += c; continue; }
      if (c === ')' || c === '}' || c === ']') { depth--; current += c; continue; }
      if (c === ',' && depth === 0) {
        result.push(current);
        current = '';
        continue;
      }
      current += c;
    }
    result.push(current);
    return result;
  }

  // ============================================================
  //  6. 全域事件綁定
  // ============================================================
  document.addEventListener('DOMContentLoaded', () => {
    const svg = document.getElementById('arraySvg');
    if (!svg) return;

    // 右鍵選單
    svg.addEventListener('contextmenu', (e) => {
      const obj = e.target.closest('.draggable-object');
      if (!obj) { hideCtxMenu(); return; }

      e.preventDefault();
      e.stopPropagation();

      const id = obj.getAttribute('id');
      const dc = id ? findDrawCallByGroupID(id) : null;

      // 即使沒找到 drawCall，也可以顯示基本選單
      showCtxMenu(e, obj, dc);
    });

    // 點其他地方關閉選單
    document.addEventListener('mousedown', (e) => {
      if (_ctxMenu && !_ctxMenu.contains(e.target)) hideCtxMenu();
    });

    // ESC 關閉
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { hideCtxMenu(); hidePropPanel(); }
    });
  });

  // 暴露 API 供外部使用
  window.GuiEditor = {
    getFrameRegistry: () => _frameRegistry,
    getCurrentDrawCalls: getCurrentFrameDrawCalls,
    replayFrame: replayCurrentFrame,
    hidePropPanel,
    hideCtxMenu,
  };

  // ============================================================
  //  7. Toast 通知元件
  // ============================================================
  let _toastContainer = null;

  function ensureToastContainer() {
    if (_toastContainer) return _toastContainer;
    _toastContainer = document.createElement('div');
    _toastContainer.style.cssText =
      'position:fixed; bottom:20px; right:20px; z-index:10000;' +
      'display:flex; flex-direction:column-reverse; gap:8px; pointer-events:none;';
    document.body.appendChild(_toastContainer);
    return _toastContainer;
  }

  /**
   * 顯示一個短暫通知
   * @param {string} msg  - 訊息內容
   * @param {'success'|'error'|'info'} type
   * @param {number} duration - 毫秒
   */
  function showToast(msg, type = 'info', duration = 2500) {
    const container = ensureToastContainer();
    const toast = document.createElement('div');
    const colors = {
      success: { bg: '#065f46', border: '#10b981', icon: '✅' },
      error: { bg: '#7f1d1d', border: '#ef4444', icon: '❌' },
      info: { bg: '#1e3a5f', border: '#3b82f6', icon: 'ℹ️' }
    };
    const c = colors[type] || colors.info;
    toast.style.cssText =
      `padding:8px 16px; border-radius:8px; font-size:13px; color:#fff;` +
      `background:${c.bg}; border:1px solid ${c.border};` +
      `box-shadow:0 4px 12px rgba(0,0,0,.3); pointer-events:auto;` +
      `opacity:0; transform:translateY(10px); transition:all .25s ease;` +
      `font-family:system-ui,-apple-system,sans-serif;`;
    toast.textContent = `${c.icon} ${msg}`;
    container.appendChild(toast);
    // 動畫進入
    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    });
    const durationTime = 2000;
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(20px)';
      setTimeout(() => toast.remove(), 300);
    }, durationTime);
  }

  /**
   * 開啟顏色選取彈窗 (升級版：支援 iro.js)
   */
  function openColorPalette(e, anchorBtn, onSelect) {
    const old = document.querySelector('.color-palette-popover');
    if (old) old.remove();

    const palette = document.createElement('div');
    palette.className = 'color-palette-popover';
    palette.style.cssText = `
      position: absolute; background: #fff; border: 1px solid #e5e7eb;
      border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.2);
      padding: 12px; width: 200px; z-index: 10000;
      display: flex; flex-direction: column; gap: 10px;
    `;

    // 1. AV 常用常量區
    const constLabel = document.createElement('div');
    constLabel.innerText = '常用 AV 顏色';
    constLabel.style.cssText = 'font-size: 11px; color: #6b7280; font-weight: 600;';
    palette.appendChild(constLabel);

    const constGrid = document.createElement('div');
    constGrid.style.cssText = 'display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;';
    AV_COLORS.forEach(c => {
      const swatch = document.createElement('div');
      swatch.style.cssText = `
        width: 24px; height: 24px; border-radius: 4px; cursor: pointer;
        border: 1px solid rgba(0,0,0,0.1); background: ${c.hex};
      `;
      swatch.title = c.name;
      swatch.addEventListener('click', () => {
        onSelect(c.name, c.hex, true); // 快選按鈕：直接觸發 Final
        palette.remove();
      });
      constGrid.appendChild(swatch);
    });
    palette.appendChild(constGrid);

    // 2. 分隔線
    const divider = document.createElement('div');
    divider.style.cssText = 'height: 1px; background: #f3f4f6; margin: 4px 0;';
    palette.appendChild(divider);

    // 3. iro.js 選色輪區
    const pickerLabel = document.createElement('div');
    pickerLabel.innerText = '自定義顏色';
    pickerLabel.style.cssText = 'font-size: 11px; color: #6b7280; font-weight: 600;';
    palette.appendChild(pickerLabel);

    const pickerMount = document.createElement('div');
    pickerMount.id = 'gui-iro-picker';
    pickerMount.style.display = 'flex';
    pickerMount.style.justifyContent = 'center';
    palette.appendChild(pickerMount);

    document.body.appendChild(palette);

    // 計算位置
    const rect = anchorBtn.getBoundingClientRect();
    palette.style.top = (rect.bottom + window.scrollY + 5) + 'px';
    palette.style.left = Math.min(rect.left + window.scrollX - 80, window.innerWidth - 220) + 'px';

    // 初始化 iro.js (如果庫存在)
    if (window.iro) {
      const item = anchorBtn.closest('.cell-style-item');
      const inp = item ? item.querySelector('input[data-field="cpp-elements"]') : null;
      const initialColor = (inp && inp.value && !inp.value.includes('AV_')) ? inp.value : '#ff0000';

      const picker = new iro.ColorPicker(pickerMount, {
        width: 150,
        color: initialColor,
        borderWidth: 1,
        borderColor: "#e5e7eb",
        layout: [
          { component: iro.ui.Box },
          { component: iro.ui.Slider, options: { sliderType: 'hue' } },
          { component: iro.ui.Slider, options: { sliderType: 'alpha' } }
        ]
      });

      picker.on('color:change', (color) => {
        // 即時預覽：isFinal = false
        onSelect(color.rgbaString, color.rgbaString, false);
      });

      picker.on('input:end', (color) => {
        // 放開滑鼠：isFinal = true
        onSelect(color.rgbaString, color.rgbaString, true);
      });
    } else {
      pickerMount.innerHTML = '<div style="font-size:10px;color:#999;text-align:center">無法載入選色器庫</div>';
    }

    const closeHandler = (ev) => {
      // 點擊彈窗外部才關閉
      if (!palette.contains(ev.target) && ev.target !== anchorBtn) {
        palette.remove();
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(() => document.addEventListener('mousedown', closeHandler), 10);
  }

  // 暴露 showToast 供內部使用
  window._guiToast = showToast;

})();
