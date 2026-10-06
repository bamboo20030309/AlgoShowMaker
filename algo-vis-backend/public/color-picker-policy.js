// Shared picker policy: preferences belong to the browser, never to saved objects.
(function () {
  const lastKey = 'asm_slide_last_picked_color_v1', historyKey = 'asm_slide_custom_colors_v1';
  const styleKey = 'asm_slide_style_colors_v1';
  const buttons = new Set(), painters = new WeakMap();
  // The previous global preference has no style identity: never copy it to every style.
  function styleColors() {
    try { const value = JSON.parse(localStorage.getItem(styleKey) || '{}'); return value && !Array.isArray(value) && typeof value === 'object' ? value : {}; } catch { return {}; }
  }
  function styleLast(type, fallback) { return normalize(styleColors()[type]) || fallback; }
  function rememberStyle(type, value) {
    const color = normalize(value); if (!color || !['highlight','focus','point','mark','background','annotation'].includes(type)) return;
    try { localStorage.setItem(styleKey, JSON.stringify({ ...styleColors(), [type]: color })); } catch {}
  }
  function refreshButtons() { const value = last(); for (const reference of buttons) { const button = reference.deref(); if (!button) buttons.delete(reference); else if (button.isConnected && value) painters.get(button)?.(value); } }
  function normalize(value) { if (typeof value !== 'string' || !value.trim()) return null; try { const c = new iro.Color(value); return c.alpha < 1 ? c.rgbaString : c.hexString; } catch { return null; } }
  function last(fallback = null) { try { return normalize(localStorage.getItem(lastKey)) || fallback; } catch { return fallback; } }
  function history() { try { const rows = JSON.parse(localStorage.getItem(historyKey) || '[]'); return Array.isArray(rows) ? rows.map(normalize).filter(Boolean).slice(0,16) : []; } catch { return []; } }
  function aliases() { return window.ASMArrowModel?.COLORS || {}; }
  function remember(value, final = false) {
    const color = normalize(value); if (!color) return;
    try {
      localStorage.setItem(lastKey, new iro.Color(color).rgbaString);
      if (final && !Object.values(aliases()).some(v => normalize(v) === color)) {
        localStorage.setItem(historyKey, JSON.stringify([color, ...history().filter(v => v !== color)].slice(0,16)));
      }
    } catch {} refreshButtons();
  }
  function bind(button, { apply, open, paint }) {
    if (!button) return;
    if (last()) paint?.(last());
    painters.set(button, paint); buttons.add(new WeakRef(button));
    // Keep the text/cell selection while applying a toolbar color.
    button.addEventListener('mousedown', e => e.preventDefault());
    button.addEventListener('pointerenter', open);
    button.addEventListener('click', e => { e.preventDefault(); const value = last(); if (value) { apply(value); remember(value, true); } else open(e); });
    button.addEventListener('keydown', e => { if (e.key === 'ArrowDown') { e.preventDefault(); open(e); } });
  }
  function swatches(parent, apply) {
    const area = document.createElement('div'); area.className = 'asm-shared-color-swatches';
    const draw = () => {
      area.replaceChildren();
      const add = (label, colors) => {
        if (!colors.length) return;
        const heading = document.createElement('div'); heading.textContent = label; heading.style.cssText='font-size:11px;color:#637577;margin:6px 0'; area.append(heading);
        const row = document.createElement('div'); row.style.cssText='display:flex;flex-wrap:wrap;gap:6px';
        colors.forEach(([alias,value]) => {
          const b=document.createElement('button'); b.type='button'; b.className='asm-shared-color-swatch';
          b.style.cssText='width:24px;height:24px;border:1px solid #adb6b5;border-radius:4px;background:'+value;
          b.dataset.color=value; b.setAttribute('aria-label','選擇顏色 '+value);
          b.addEventListener('mousedown', e=>e.preventDefault());
          b.addEventListener('click', e=>{e.preventDefault();apply(alias,value);remember(value,true);});row.append(b);
        });area.append(row);
      };
      add('常用顏色',Object.entries(aliases())); add('自訂顏色',history().map(v=>[v,v]));
    }; draw(); parent.append(area); return draw;
  }
  window.addEventListener('storage', e => { if ([lastKey,historyKey].includes(e.key)) refreshButtons(); });
  window.ASMColorPickerPolicy = { last, styleLast, rememberStyle, history, remember, bind, swatches, normalize };
})();
