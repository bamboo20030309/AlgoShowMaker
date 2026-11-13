// -----------------------------------------------------------------------------
// 投影片封面產生器
// 以第一張投影片的 Fabric 與 widget 資料產生固定比例縮圖，供首頁與排序總覽快取。
// -----------------------------------------------------------------------------
(function () {
  const OUTPUT_WIDTH = 640;
  const OUTPUT_HEIGHT = 360;
  const SLIDE_WIDTH = 1280;
  const SCALE = OUTPUT_WIDTH / SLIDE_WIDTH;

  // -----------------------------------------------------------------------------
  // 封面來源與固定輸出尺寸
  // 只取 deck 的第一張有效 slide，所有 renderer 都畫到 16:9 固定畫布以利快取。
  // -----------------------------------------------------------------------------
  function firstSlide(deck) {
    if (!deck || !Array.isArray(deck.groups)) return null;
    for (const group of deck.groups) {
      if (group && Array.isArray(group.slides) && group.slides.length) {
        return group.slides[0];
      }
    }
    return null;
  }

  function drawAlgorithmCover(context, slide) {
    context.fillStyle = '#172025';
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);
    context.fillStyle = '#26343a';
    context.fillRect(34, 38, 572, 284);
    context.fillStyle = '#d07b31';
    context.fillRect(34, 38, 8, 284);
    context.fillStyle = '#f3f6f7';
    context.font = 'bold 28px Arial, sans-serif';
    context.fillText('演算法動畫', 70, 92);

    const code = String(slide?.animation?.code || 'Algorithm visualization');
    const lines = code.split(/\r?\n/).filter(Boolean).slice(0, 8);
    context.font = '15px Consolas, monospace';
    lines.forEach((line, index) => {
      context.fillStyle = index % 2 ? '#9bcbbf' : '#c8d6d3';
      context.fillText(line.slice(0, 62), 72, 140 + index * 22);
    });
  }

  function drawCodeWidget(context, widget) {
    const x = Number(widget.x || 0) * SCALE;
    const y = Number(widget.y || 0) * SCALE;
    const width = Math.max(1, Number(widget.w || 0) * SCALE);
    const height = Math.max(1, Number(widget.h || 0) * SCALE);
    const fontSize = Math.max(7, Number(widget.fontSize || 20) * SCALE);
    const lineHeight = fontSize * 1.42;

    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#1e2225';
    context.fillRect(x, y, width, height);
    context.font = `${fontSize}px Consolas, monospace`;
    String(widget.content || '').split(/\r?\n/).forEach((line, index) => {
      const baseline = y + fontSize * 1.35 + index * lineHeight;
      if (baseline > y + height) return;
      context.fillStyle = index % 3 === 0 ? '#9cdcfe' : '#d4d4d4';
      context.fillText(line.slice(0, 100), x + fontSize, baseline);
    });
    context.restore();
  }

  function drawLatexWidget(context, widget) {
    const x = Number(widget.x || 0) * SCALE;
    const y = Number(widget.y || 0) * SCALE;
    const width = Math.max(1, Number(widget.w || 0) * SCALE);
    const height = Math.max(1, Number(widget.h || 0) * SCALE);
    const fontSize = Math.max(9, Number(widget.fontSize || 34) * SCALE);
    const formula = String(widget.content || '')
      .replace(/\\\(|\\\)|\\\[|\\\]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    context.save();
    context.beginPath();
    context.rect(x, y, width, height);
    context.clip();
    context.fillStyle = '#1f282d';
    context.font = `${fontSize}px Cambria Math, Times New Roman, serif`;
    context.fillText(formula.slice(0, 100), x, y + fontSize * 1.15);
    context.restore();
  }

  // -----------------------------------------------------------------------------
  // Widget 圖層繪製
  // 依 layerIndex 排序 code、LaTeX 與 structure，未知類型略過而不讓整張縮圖失敗。
  // -----------------------------------------------------------------------------
  async function drawWidgets(context, widgets) {
    if (!Array.isArray(widgets)) return;
    const orderedWidgets = widgets
      .slice()
      .sort((a, b) => Number(a.layerIndex || 0) - Number(b.layerIndex || 0));
    for (const widget of orderedWidgets) {
      if (widget?.type === 'code') drawCodeWidget(context, widget);
      else if (widget?.type === 'latex') drawLatexWidget(context, widget);
      else if (widget?.type === 'structure' && window.AlgoStructureRenderer) {
        await window.AlgoStructureRenderer.drawCanvas(context, widget, SCALE);
      } else if (widget?.type === 'video') await drawVideoWidget(context, widget);
      else if (widget?.type && !['latex', 'code', 'structure', 'table'].includes(widget.type)) drawUnsupportedWidget(context, widget);
    }
  }

  // CORS 模式載入海報：伺服器未允許時只會載入失敗，不會汙染畫布而讓 toDataURL 拋錯。
  function loadPoster(videoId) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(String(videoId || ''))) return Promise.resolve(null);
    return new Promise(resolve => {
      const image = new Image();
      const timer = setTimeout(() => resolve(null), 2500);
      image.crossOrigin = 'anonymous';
      image.onload = () => { clearTimeout(timer); resolve(image); };
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.src = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    });
  }

  async function drawVideoWidget(context, widget) {
    const x = Number(widget.x || 0) * SCALE;
    const y = Number(widget.y || 0) * SCALE;
    const width = Math.max(1, Number(widget.w || 0) * SCALE);
    const height = Math.max(1, Number(widget.h || 0) * SCALE);
    context.save();
    context.fillStyle = '#111518';
    context.fillRect(x, y, width, height);
    const poster = await loadPoster(widget.videoId);
    if (poster) {
      // hqdefault 為 4:3 並含黑邊；以 cover 填滿影片框。
      const ratio = Math.max(width / poster.width, height / poster.height);
      const drawWidth = poster.width * ratio, drawHeight = poster.height * ratio;
      context.beginPath();
      context.rect(x, y, width, height);
      context.clip();
      try { context.drawImage(poster, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight); } catch {}
    }
    const radius = Math.max(6, Math.min(width, height) * 0.12);
    context.fillStyle = 'rgba(0, 0, 0, 0.6)';
    context.beginPath();
    context.arc(x + width / 2, y + height / 2, radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffffff';
    context.beginPath();
    context.moveTo(x + width / 2 - radius * 0.35, y + height / 2 - radius * 0.5);
    context.lineTo(x + width / 2 + radius * 0.55, y + height / 2);
    context.lineTo(x + width / 2 - radius * 0.35, y + height / 2 + radius * 0.5);
    context.closePath();
    context.fill();
    context.restore();
  }

  function drawUnsupportedWidget(context, widget) {
    const x = Number(widget.x || 0) * SCALE;
    const y = Number(widget.y || 0) * SCALE;
    const width = Math.max(1, Number(widget.w || 0) * SCALE);
    const height = Math.max(1, Number(widget.h || 0) * SCALE);
    context.save();
    context.fillStyle = '#eef1f2';
    context.strokeStyle = '#9aa5a9';
    context.setLineDash([4, 3]);
    context.fillRect(x, y, width, height);
    context.strokeRect(x + 0.5, y + 0.5, width - 1, height - 1);
    context.restore();
  }

  // -----------------------------------------------------------------------------
  // Fabric 與演算法封面
  // Fabric JSON 先載入離屏 canvas，再與 widget 合成；演算法投影片則使用專用摘要封面。
  // -----------------------------------------------------------------------------
  async function renderFabricSlide(output, slide) {
    const Fabric = window.fabric;
    if (!Fabric?.StaticCanvas) return;

    const fabricElement = document.createElement('canvas');
    const fabricCanvas = new Fabric.StaticCanvas(fabricElement, {
      width: OUTPUT_WIDTH,
      height: OUTPUT_HEIGHT,
      backgroundColor: '#ffffff',
      renderOnAddRemove: false
    });

    try {
      await new Promise(resolve => {
        fabricCanvas.loadFromJSON(slide?.canvas || { objects: [] }, () => {
          fabricCanvas.setViewportTransform([SCALE, 0, 0, SCALE, 0, 0]);
          fabricCanvas.renderAll();
          resolve();
        });
      });
      output.getContext('2d').drawImage(fabricElement, 0, 0);
    } finally {
      fabricCanvas.dispose();
    }
  }

  async function createSlide(slide) {
    const output = document.createElement('canvas');
    output.width = OUTPUT_WIDTH;
    output.height = OUTPUT_HEIGHT;
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    if (!slide) return output.toDataURL('image/jpeg', 0.82);
    if (slide.kind === 'algorithm-animation') {
      drawAlgorithmCover(context, slide);
    } else {
      await renderFabricSlide(output, slide);
      await drawWidgets(context, slide.widgets);
    }
    return output.toDataURL('image/jpeg', 0.82);
  }

  // -----------------------------------------------------------------------------
  // 公開縮圖入口
  // 建立失敗時回傳空值交由卡片使用色塊退路，避免縮圖錯誤中斷 deck 清單。
  // -----------------------------------------------------------------------------
  async function create(deck) {
    return createSlide(firstSlide(deck));
  }

  window.AlgoDeckThumbnail = { create, createSlide };
})();
