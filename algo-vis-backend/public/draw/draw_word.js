// draw_word.js
// 在畫布上直接畫出純文字，無視 TTS 規則且無背景框

/**
 * 取得文字寬度
 */
function getTextWidthLocal(text, fontSize = 16, fontFace = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif') {
    const canvas = getTextWidthLocal._canvas || (getTextWidthLocal._canvas = document.createElement('canvas'));
    const ctx = canvas.getContext('2d');
    ctx.font = fontSize + "px " + fontFace;
    const metrics = ctx.measureText(text);
    return metrics.width;
}

; (function () {
    let wordCounter = 0;
    window.resetWordCounter = function () {
        wordCounter = 0;
    };
    function getNextWordID() {
        wordCounter++;
        return `word-auto-${wordCounter}`;
    }

    /**
     * 在畫布上畫出文字
     * @param {string} content - 文字內容
     * @param {object} posSpec - 位置規格 (Pos)
     */
    window.drawWord = function (content, posSpec) {
        const vp = window.getViewport && window.getViewport();
        if (!vp) return;

        const NS = 'http://www.w3.org/2000/svg';
        if (content == null) content = '';
        const raw = String(content);
        const lines = raw.split(/\r?\n/);

        // 1. 解析座標
        const pos = window.resolvePos(posSpec);
        const anchor = pos.anchor || 'center';
        const x = pos.x;
        const y = pos.y;

        const fontSize = 14;
        const fontColor = '#374151';
        const lineHeight = fontSize * 1.3;

        // 2. 計算邊框寬高以進行 anchor 對齊
        let maxW = 0;
        lines.forEach(line => {
            const displayLine = line.replace(/ /g, '\u00A0');
            const w = getTextWidthLocal(displayLine, fontSize);
            maxW = Math.max(maxW, w);
        });
        const totalH = lines.length * lineHeight;

        // 3. 套用自偏移 (Self Anchor Offset)
        const apos = window.applySelfAnchorOffset(x, y, maxW, totalH, anchor);

        // 4. 建立 SVG 群組
        const g = document.createElementNS(NS, 'g');
        g.classList.add('draggable-object');
        g.setAttribute('id', getNextWordID());
        g.setAttribute('data-base-offset', apos.x + "," + apos.y);
        g.setAttribute('transform', "translate(" + apos.x + "," + apos.y + ")");
        vp.appendChild(g);

        // 5. 建立文字節點
        const text = document.createElementNS(NS, 'text');
        text.setAttribute('x', 0);
        text.setAttribute('y', fontSize * 0.85);
        text.setAttribute('fill', fontColor);
        text.setAttribute('font-size', fontSize);
        text.setAttribute('font-family', 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif');
        text.setAttribute('xml:space', 'preserve');

        lines.forEach((line, idx) => {
            const tspan = document.createElementNS(NS, 'tspan');
            tspan.setAttribute('x', 0);
            tspan.setAttribute('dy', idx === 0 ? 0 : lineHeight);
            tspan.textContent = line.replace(/ /g, '\u00A0') || '\u00A0';
            text.appendChild(tspan);
        });

        g.appendChild(text);
    };
})();
