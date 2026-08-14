(function () {
  const OUTPUT_WIDTH = 640;
  const OUTPUT_HEIGHT = 360;
  const SLIDE_WIDTH = 1280;
  const SCALE = OUTPUT_WIDTH / SLIDE_WIDTH;

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
      }
    }
  }

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

  async function create(deck) {
    const output = document.createElement('canvas');
    output.width = OUTPUT_WIDTH;
    output.height = OUTPUT_HEIGHT;
    const context = output.getContext('2d');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, OUTPUT_WIDTH, OUTPUT_HEIGHT);

    const slide = firstSlide(deck);
    if (!slide) return output.toDataURL('image/jpeg', 0.82);
    if (slide.kind === 'algorithm-animation') {
      drawAlgorithmCover(context, slide);
    } else {
      await renderFabricSlide(output, slide);
      await drawWidgets(context, slide.widgets);
    }
    return output.toDataURL('image/jpeg', 0.82);
  }

  window.AlgoDeckThumbnail = { create };
})();
