// draw_text.js
// 在畫布上畫出一個可拖曳的對話框文字元件
  /**
   * 將原始文字拆成：
   *  - display：畫在畫布上的文字
   *  - tts    ：給 TTS 念的文字
   *
   * 規則：
   * 1. ( ... )  小括號整段不念，但仍顯示
   * 2. {A:B}    大括號中有冒號：
   *    - display 顯示 A
   *    - tts     念 B
   * 3. {xxx} 或 {沒有冒號} → 當一般文字處理
   */
function transformTextForDisplayAndTTS(raw) {
  const s = String(raw ?? "");
  let display = "";
  let tts     = "";

  let i = 0;
  const n = s.length;

  while (i < n) {
    const ch = s[i];

    // 規則 1：小括號 (...) → display 有，tts 不要
    if (ch === '(') {
      const close = s.indexOf(')', i + 1);
      if (close !== -1) {
        const segment = s.slice(i, close + 1);  // "( ... )"
        display += segment;    // 保留顯示
        // TTS 不加
        i = close + 1;
        continue;
      }
    }

    // 規則 2 & 3：大括號 {...}
    if (ch === '{') {
      const close = s.indexOf('}', i + 1);
      if (close !== -1) {
        const inner = s.slice(i + 1, close); // 大括號內容
        const colonPos = inner.indexOf(':');

        if (colonPos !== -1) {
          // 規則 2：有冒號 → display=左邊、tts=右邊
          const left  = inner.slice(0, colonPos);
          const right = inner.slice(colonPos + 1);

          display += left;
          tts     += right;
        } else {
          // ★ 規則 3：沒有冒號 → display 有，但 tts 不念
          display += inner;   // 顯示大括號內文字
          // tts 不加任何東西
        }

        i = close + 1;
        continue;
      }
    }

    // 規則 4：一般字元 → display / tts 都加
    display += ch;
    tts     += ch;
    i++;
  }

  tts = tts.replace(/\s+/g, ' ').trim();
  return { display, tts };
}


// 取得一段文字在某個字型下的「顯示寬度」
function getTextWidth(text, font = '14px system-ui, -apple-system') {
  const canvas = getTextWidth._canvas || (getTextWidth._canvas = document.createElement('canvas'));
  const ctx = canvas.getContext('2d');
  ctx.font = font;
  const metrics = ctx.measureText(text);
  return metrics.width;
}

// 判斷全形字（中文、日文、韓文）
function isFullWidth(char) {
  const code = char.codePointAt(0);
  return (
    (code >= 0x1100 && code <= 0x115F) || // 韓文 Jamo
    (code >= 0x2E80 && code <= 0xA4CF) || // CJK、日文、中文
    (code >= 0xAC00 && code <= 0xD7A3) || // 韓文音節
    (code >= 0xF900 && code <= 0xFAFF) || // CJK 相容表意文字
    (code >= 0xFE10 && code <= 0xFE19) || // 直書標點
    (code >= 0xFE30 && code <= 0xFE6F) || // 全形符號
    (code >= 0xFF00 && code <= 0xFF60) || // 全形 ASCII、全形標點
    (code >= 0xFFE0 && code <= 0xFFE6)    // 全形貨幣符號
  );
}


;(function () {
  const NS = 'http://www.w3.org/2000/svg';
  let msgCounter = 0; // 全域計數器，確保 ID 唯一

  function getNextMessageID() {
    msgCounter++;
    return `msg-${msgCounter}`;
  }
  /**
   * 在畫布上畫一個文字框
   * @param {string} content   - 要顯示的文字，可以用 \n 換行
   * @param {object} pos       - 位置規格，支援絕對位置和相對位置（參考 resolvePos）
   */
  function drawText(
    content,
    pos,
  ) {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return;

    pos = window.resolvePos(pos);
    const offsetX = pos.x;
    const offsetY = pos.y;

    // 先把字串按行處理，得到顯示文字與 TTS 文字
    const raw        = String(content ?? "");
    const rawLines   = raw.split('\n');

    const displayLines = [];
    const ttsPieces    = [];

    rawLines.forEach(line => {
      const { display, tts } = transformTextForDisplayAndTTS(line);
      displayLines.push(display);
      if (tts && tts.trim()) ttsPieces.push(tts.trim());
    });

    const displayContent = displayLines.join('\n');
    const ttsContent     = ttsPieces.join('。'); // 行與行之間用句號隔開也可以依喜好改

    // 先把上一幀的所有 msg-* 氣泡清掉，確保「只存在當前這一幀」
    const oldBubbles = vp.querySelectorAll('g[id^="msg-"]');
    oldBubbles.forEach(node => node.remove());

    // 產生唯一 ID（這一幀如果你將來想畫多個，也還是保證不重複）
    const groupID = getNextMessageID();

    // 建立 <g>
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('id', groupID);
    g.classList.add('draggable-object');
    g.setAttribute('data-translate', '0,0');
    g.setAttribute('data-tts-text', ttsContent);
    vp.appendChild(g);

    if (content == null) content = '';
    content = String(content);

    // 以換行符號切成多行
    const lines = displayContent.split(/\r?\n/);

    const fontSize   = 14;
    const lineHeight = fontSize * 1.3;
    const padX       = 12;
    const padY       = 8;

    // 估算文字寬度（考慮全形 / 半形）
    let textWidth = 0;
    for (const line of lines) {
      let nowTextWidth = 0;
      for (const ch of line) {
        if(ch === ' ')nowTextWidth += getTextWidth(ch)*2.37;
        else nowTextWidth += getTextWidth(ch);
      }
      textWidth = Math.max(textWidth,nowTextWidth);
    }
    textWidth = Math.max(40, textWidth);

    const boxWidth  = textWidth + padX * 2;
    const boxHeight = padY * 2 + lineHeight * lines.length;

    // 建立陰影 filter（只建一次）
    const svg = vp.ownerSVGElement;
    if (svg && !svg.querySelector('#text-bubble-shadow')) {
      const defs =
        svg.querySelector('defs') ||
        svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);

      const filter = document.createElementNS(NS, 'filter');
      filter.setAttribute('id', 'text-bubble-shadow');
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');

      const feDrop = document.createElementNS(NS, 'feDropShadow');
      feDrop.setAttribute('dx', '0');
      feDrop.setAttribute('dy', '2');
      feDrop.setAttribute('stdDeviation', '2');
      feDrop.setAttribute('flood-color', '#000000');
      feDrop.setAttribute('flood-opacity', '0.25');
      filter.appendChild(feDrop);
      defs.appendChild(filter);
    }

    // 對話框本體
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', boxWidth);
    rect.setAttribute('height', boxHeight);
    rect.setAttribute('rx', 8);
    rect.setAttribute('ry', 8);
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#4b5563');
    rect.setAttribute('stroke-width', '1.2');
    rect.setAttribute('filter', 'url(#text-bubble-shadow)');
    g.appendChild(rect);

    // 小三角形（對話框尾巴）
    const pointer = document.createElementNS(NS, 'path');
    const pw = 12;
    const ph = 8;
    const px = boxWidth / 2;
    const py = boxHeight;
    pointer.setAttribute(
      'd',
      `M ${px - pw / 2} ${py} L ${px} ${py + ph} L ${px + pw / 2} ${py} Z`
    );
    pointer.setAttribute('fill', '#ffffff');
    pointer.setAttribute('stroke', '#4b5563');
    pointer.setAttribute('stroke-width', '1.2');
    g.appendChild(pointer);

    // 文字
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('x', padX);
    text.setAttribute('y', padY + fontSize);
    text.setAttribute('fill', '#111827');
    text.setAttribute('font-size', fontSize);
    text.setAttribute(
    'font-family',
    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    );
    text.setAttribute('xml:space', 'preserve');  // ★ 這行讓 SVG 保留所有空白

    lines.forEach((line, idx) => {
      const tspan = document.createElementNS(NS, 'tspan');
      // 把一般空白換成不斷行空白，避免被 SVG 壓縮
      const displayLine = line.replace(/ /g, '\u00A0\u00A0');
      tspan.setAttribute('x', padX);
      tspan.setAttribute('dy', idx === 0 ? 0 : lineHeight);
      tspan.textContent = displayLine;
      text.appendChild(tspan);
    });
    g.appendChild(text);

    // 設定位置
    g.setAttribute('data-base-offset', `${offsetX},${offsetY}`);
    g.setAttribute('transform', `translate(${offsetX},${offsetY})`);
  }

  // 暴露到全域，給 CodeScript / 你自己的 JS 用
  window.drawText = drawText;




















  

  /**
   * drawColoredText
   * segments = [
   *   { text: "123", bg_color: "purple", font_color: "black", font_size: 20 },
   *   { text: "456" } ← 其他欄位可省略
   * ]
   */
  function drawColoredText(
    segments, 
    pos
  ) {
    const vp = window.getViewport && window.getViewport();
    if (!vp) return;

    pos = window.resolvePos(pos);
    const offsetX = pos.x;
    const offsetY = pos.y;

    // === TTS：以「行」為單位收集 ===
    const ttsLines = [];

    // 暫存目前這一行的 TTS 片段
    let currentLinePieces = [];

    // 先把 segments 裡的 text 一個個轉換
    const processedSegments = (segments || []).map(seg => {
      const rawText = String(seg?.text ?? "");

      // 依照換行切開（保留語意上的「行」）
      const rawLines = rawText.split('\n');

      const displayLines = [];

      rawLines.forEach((lineText, idx) => {
        const { display, tts } = transformTextForDisplayAndTTS(lineText);

        displayLines.push(display);

        if (tts && tts.trim()) {
          currentLinePieces.push(tts.trim());
        }

        // 如果不是最後一行，代表「這裡換行了」
        if (idx < rawLines.length - 1) {
          if (currentLinePieces.length > 0) {
            ttsLines.push(currentLinePieces.join(''));
          }
          currentLinePieces = [];
        }
      });

      return {
        ...seg,
        text: displayLines.join('\n')
      };
    });

    // 收尾：最後一行
    if (currentLinePieces.length > 0) {
      ttsLines.push(currentLinePieces.join(''));
    }

    // 每一行之間自動加一句號
    const ttsContent = ttsLines.join('。');

    // 之後畫字全部改用 processedSegments
    segments = processedSegments;

    const oldBubbles = vp.querySelectorAll('g[id^="msg-"]');
    oldBubbles.forEach(node => node.remove());

    if (!Array.isArray(segments)) segments = [];
  
    // === 0. 先把含有 \n 的 segment 拆成多行 ===
    // lines: [ [seg, seg, ...], [seg, ...], ... ]
    const lines = [[]];
  
    segments.forEach(seg => {
      if (!seg) return;
      const base = { ...seg };
      const rawText = String(seg.text ?? "");
      const parts = rawText.split('\n');
  
      parts.forEach((part, idx) => {
        const cloned = { ...base, text: part };
        lines[lines.length - 1].push(cloned);
        // 不是最後一段 → 開啟新的一行
        if (idx < parts.length - 1) {
          lines.push([]);
        }
      });
    });
  
    // 避免全部都是空行，用 filter 清一下（保留至少一行）
    const normalizedLines = lines.filter((line, idx) => line.length > 0 || idx === 0);
  
    const padX = 12;
    const padY = 8;
    const lineGap = 4;
  
    let globalMaxFs = 14;
    const lineMetrics = []; // 每一行: { lineWidth, lineMaxFs, segWidths[] }
  
    normalizedLines.forEach(line => {
      let lineWidth = 0;
      let lineMaxFs = 14;
      const segWidths = [];
  
      line.forEach(seg => {
        const text = String(seg.text ?? "");
        const fs = Number(seg.font_size) || 14;
        lineMaxFs = Math.max(lineMaxFs, fs);
        globalMaxFs = Math.max(globalMaxFs, fs);
        let nowTextWidth = 0;
        for (const ch of text) {
          if (ch === ' ')nowTextWidth += getTextWidth(ch)*1.19;
          else nowTextWidth += getTextWidth(ch);
        }
        // 半形字稍微窄一點，不要那麼巨大
        segWidths.push(nowTextWidth);
        lineWidth += nowTextWidth;
      });
  
      lineMetrics.push({ lineWidth, lineMaxFs, segWidths });
    });
  
    // === 2. 算整個對話框寬高 ===
    let boxWidth = 40;
    let boxHeight = padY * 2 + globalMaxFs;
  
    if (normalizedLines.length > 0) {
      const maxLineWidth = Math.max(
        40,
        ...lineMetrics.map(m => m.lineWidth + padX * 2)
      );
      boxWidth = maxLineWidth;
  
      let totalTextHeight = 0;
      lineMetrics.forEach((m, idx) => {
        totalTextHeight += m.lineMaxFs * 1.3;
        if (idx < lineMetrics.length - 1) totalTextHeight += lineGap;
      });
  
      boxHeight = padY * 2 + totalTextHeight;
    }
  
    // === 3. 準備 group / 陰影 / 對話框本體 ===
    const svg = vp.ownerSVGElement;
    if (svg && !svg.querySelector('#text-bubble-shadow')) {
      const defs =
        svg.querySelector('defs') ||
        svg.insertBefore(document.createElementNS(NS, 'defs'), svg.firstChild);
  
      const filter = document.createElementNS(NS, 'filter');
      filter.setAttribute('id', 'text-bubble-shadow');
      filter.setAttribute('x', '-20%');
      filter.setAttribute('y', '-20%');
      filter.setAttribute('width', '140%');
      filter.setAttribute('height', '140%');
  
      const feDrop = document.createElementNS(NS, 'feDropShadow');
      feDrop.setAttribute('dx', '0');
      feDrop.setAttribute('dy', '2');
      feDrop.setAttribute('stdDeviation', '2');
      feDrop.setAttribute('flood-color', '#000000');
      feDrop.setAttribute('flood-opacity', '0.25');
      filter.appendChild(feDrop);
      defs.appendChild(filter);
    }
  
    // 產生唯一 ID（假設你已經有 getNextMessageID）
    const groupID = typeof getNextMessageID === 'function'
      ? getNextMessageID()
      : `msg-${Date.now()}`;
  
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('id', groupID);
    g.classList.add('draggable-object');
    g.setAttribute('data-translate', '0,0');
    g.setAttribute('data-tts-text', ttsContent);
    vp.appendChild(g);
  
    // 對話框底
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', 0);
    rect.setAttribute('y', 0);
    rect.setAttribute('width', boxWidth);
    rect.setAttribute('height', boxHeight);
    rect.setAttribute('rx', 8);
    rect.setAttribute('ry', 8);
    rect.setAttribute('fill', '#ffffff');
    rect.setAttribute('stroke', '#4b5563');
    rect.setAttribute('stroke-width', '1.2');
    rect.setAttribute('filter', 'url(#text-bubble-shadow)');
    g.appendChild(rect);
  
    // 小三角形
    const pointer = document.createElementNS(NS, 'path');
    const pw = 12;
    const ph = 8;
    const px = boxWidth / 2;
    const py = boxHeight;
    pointer.setAttribute(
      'd',
      `M ${px - pw / 2} ${py} L ${px} ${py + ph} L ${px + pw / 2} ${py} Z`
    );
    pointer.setAttribute('fill', '#ffffff');
    pointer.setAttribute('stroke', '#4b5563');
    pointer.setAttribute('stroke-width', '1.2');
    g.appendChild(pointer);
  
    // === 4. 每一行逐行畫：背景 + 文字 ===
    const paddingBgX = 2;
    const paddingBgY = 2;
  
    let lineTop = padY; // 每行的 top（非 baseline）
  
    normalizedLines.forEach((line, lineIndex) => {
      const { lineMaxFs, segWidths } = lineMetrics[lineIndex];
  
      const baselineY = lineTop + lineMaxFs; // 文字 baseline
  
      // 一行一個 <text> 比較好控制
      const textNode = document.createElementNS(NS, 'text');
      textNode.setAttribute('x', padX);
      textNode.setAttribute('y', baselineY);
      textNode.setAttribute('xml:space', 'preserve');
      textNode.setAttribute(
        'font-family',
        'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
      );
      g.appendChild(textNode);
  
      let cursorX = padX;
  
      line.forEach((seg, segIndex) => {
        const rawText = String(seg.text ?? "");
        const fs = Number(seg.font_size) || 14;
        const fg = seg.font_color || '#111827';
        const bg = seg.bg_color || null;
        const segWidth = segWidths[segIndex];
  
        // 背景色：稍微比文字寬 / 高一點
        if (bg) {
          const bgRect = document.createElementNS(NS, 'rect');
          bgRect.setAttribute('x', cursorX - paddingBgX);
          bgRect.setAttribute(
            'y',
            baselineY - fs * 0.85 - paddingBgY
          );
          bgRect.setAttribute('width', segWidth + paddingBgX * 2);
          bgRect.setAttribute('height', fs * 1.0 + paddingBgY * 2);
          bgRect.setAttribute('fill', bg);
          bgRect.setAttribute('rx', 2);
          bgRect.setAttribute('ry', 2);
          g.insertBefore(bgRect, textNode); // 背景在文字下面
        }
  
        // 文字 tspan（半形空白 → NBSP，避免被壓縮）
        const tspan = document.createElementNS(NS, 'tspan');
        tspan.setAttribute('x', cursorX);
        tspan.setAttribute('dy', 0);
        tspan.setAttribute('fill', fg);
        tspan.setAttribute('font-size', fs);
  
        tspan.textContent = rawText.replace(/ /g, '\u00A0');
        textNode.appendChild(tspan);
  
        cursorX += segWidth;
      });
  
      // 下一行 top：這行高度 + 行距
      lineTop += lineMaxFs * 1.3 + lineGap;
    });
  
    // 設定整個 group 的外部位置
    g.setAttribute('data-base-offset', `${offsetX},${offsetY}`);
    g.setAttribute('transform', `translate(${offsetX},${offsetY})`);
  }

  
  // 全域導出
  window.drawColoredText = drawColoredText;

})();
