/**
 * 模組：共用色彩選擇器
 *
 * 責任：為 trace 與 Studio 的顏色控制項提供單一 popup、即時預覽及變更事件。
 * 資料流：控制項開啟 picker 時同步目前值；輸入後更新 swatch 與文字值，關閉前提交仍在編輯的欄位。
 * 重要不變條件：頁面只維持一個 active control 與一個 popup，避免多個選色器同時改寫不同規則。
 * 相容性：無效或舊式色彩字串會回退為可供 input[type=color] 使用的值。
 */
(function () {
  let popup = null;
  let picker = null;
  let activeControl = null;
  let activeDirty = false;
  let syncingPicker = false;
  let refreshSwatches = () => {};

  // ---------------------------------------------------------------------------
  // 區段：色彩值與控制項同步
  // ---------------------------------------------------------------------------
  function normalizeColor(value) {
    const color = String(value || '').trim();
    if (/^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return `#${color.slice(1).split('').map(character => character + character).join('')}`.toLowerCase();
    }
    if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+\s*)?\)$/i.test(color)) return color;
    return '#ffffff';
  }

  function updateControl(control, value, emit = false) {
    const color = normalizeColor(value);
    control.dataset.color = color;
    control.style.setProperty('--trace-picker-color', color);
    control.querySelector('.trace-color-value').textContent = color;
    if (emit) control.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function commitActiveControl() {
    if (!activeControl || !activeDirty) return false;
    activeDirty = false;
    activeControl.dispatchEvent(new Event('change', { bubbles: true }));
    return true;
  }

  function closePopup() {
    if (!popup || popup.hidden) return;
    commitActiveControl();
    popup.hidden = true;
    activeControl = null;
  }

  // ---------------------------------------------------------------------------
  // 區段：Popup 建立與生命週期
  // ---------------------------------------------------------------------------
  function ensurePicker() {
    if (popup) return !!picker;
    popup = document.createElement('div');
    popup.className = 'trace-iro-popup';
    popup.hidden = true;
    const mount = document.createElement('div');
    refreshSwatches = ASMColorPickerPolicy.swatches(popup, (alias, value) => {
      if (!activeControl) return;
      activeDirty = true; updateControl(activeControl, value, true); commitActiveControl(); closePopup();
    });
    popup.append(mount);
    document.body.append(popup);

    if (!window.iro?.ColorPicker) return false;
    picker = new window.iro.ColorPicker(mount, {
      width: 210,
      color: '#ffffff',
      layout: [
        { component: window.iro.ui.Box },
        { component: window.iro.ui.Slider, options: { sliderType: 'hue', sliderHeight: 18, handleRadius: 7 } },
        { component: window.iro.ui.Slider, options: { sliderType: 'alpha', sliderHeight: 18, handleRadius: 7 } }
      ]
    });
    picker.on('color:change', color => {
      if (!activeControl || syncingPicker) return;
      activeDirty = true;
      ASMColorPickerPolicy.remember(color.rgbaString);
      updateControl(activeControl, color.alpha < 1 ? color.rgbaString : color.hexString, true);
    });
    picker.on('input:end', color => { ASMColorPickerPolicy.remember(color.rgbaString, true); refreshSwatches(); commitActiveControl(); });
    popup.addEventListener('pointerup', () => queueMicrotask(commitActiveControl), true);
    return true;
  }

  // ---------------------------------------------------------------------------
  // 區段：開啟、定位與公開控制項
  // ---------------------------------------------------------------------------
  function open(control) {
    if (!ensurePicker()) return;
    if (!popup.hidden && activeControl === control) return;
    commitActiveControl();
    activeControl = control;
    activeDirty = false;
    syncingPicker = true;
    try { picker.color.set(ASMColorPickerPolicy.last(control.value)); } finally { syncingPicker = false; }
    popup.hidden = false;
    refreshSwatches();
    const rect = control.getBoundingClientRect();
    const width = 230;
    const height = popup.getBoundingClientRect().height || 315;
    popup.style.left = `${Math.max(8, Math.min(rect.left, window.innerWidth - width - 8))}px`;
    popup.style.top = `${Math.max(8, Math.min(rect.bottom + 6, window.innerHeight - height - 8))}px`;
  }

  function create(initialColor = '#ffffff', title = '選擇顏色') {
    const control = document.createElement('button');
    control.type = 'button';
    control.className = 'trace-color-control';
    control.title = title;
    control.append(
      Object.assign(document.createElement('span'), { className: 'trace-color-swatch' }),
      Object.assign(document.createElement('span'), { className: 'trace-color-value' })
    );
    Object.defineProperty(control, 'value', {
      get: () => control.dataset.color || '#ffffff',
      set: value => updateControl(control, value)
    });
    control.value = initialColor;
    ASMColorPickerPolicy.bind(control, {
      open: () => open(control),
      apply: value => {
        commitActiveControl(); activeControl = control; activeDirty = true;
        updateControl(control, value, true); commitActiveControl();
      },
      paint: value => control.style.setProperty('--trace-picker-color', value)
    });
    return control;
  }

  document.addEventListener('pointerdown', event => {
    if (!popup || popup.hidden || event.target.closest('.trace-iro-popup, .trace-color-control')) return;
    closePopup();
  }, true);

  window.addEventListener('blur', commitActiveControl);

  window.ASMTraceColorPicker = { create };
})();
