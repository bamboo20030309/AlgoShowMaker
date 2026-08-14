(function () {
  let popup = null;
  let picker = null;
  let activeControl = null;

  function normalizeColor(value) {
    const color = String(value || '').trim();
    if (/^#[0-9a-f]{6}$/i.test(color)) return color.toLowerCase();
    if (/^#[0-9a-f]{3}$/i.test(color)) {
      return `#${color.slice(1).split('').map(character => character + character).join('')}`.toLowerCase();
    }
    return '#ffffff';
  }

  function updateControl(control, value, emit = false) {
    const color = normalizeColor(value);
    control.dataset.color = color;
    control.style.setProperty('--trace-picker-color', color);
    control.querySelector('.trace-color-value').textContent = color;
    if (emit) control.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function ensurePicker() {
    if (popup) return !!picker;
    popup = document.createElement('div');
    popup.className = 'trace-iro-popup';
    popup.hidden = true;
    const mount = document.createElement('div');
    popup.append(mount);
    document.body.append(popup);

    if (!window.iro?.ColorPicker) return false;
    picker = new window.iro.ColorPicker(mount, {
      width: 210,
      color: '#ffffff',
      layout: [
        { component: window.iro.ui.Box },
        { component: window.iro.ui.Slider, options: { sliderType: 'hue', sliderHeight: 18, handleRadius: 7 } }
      ]
    });
    picker.on('color:change', color => {
      if (activeControl) updateControl(activeControl, color.hexString, true);
    });
    return true;
  }

  function open(control) {
    if (!ensurePicker()) return;
    if (!popup.hidden && activeControl === control) {
      popup.hidden = true;
      activeControl = null;
      return;
    }
    activeControl = control;
    picker.color.set(control.value);
    popup.hidden = false;
    const rect = control.getBoundingClientRect();
    const width = 230;
    const height = 270;
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
    control.addEventListener('click', event => {
      event.stopPropagation();
      open(control);
    });
    return control;
  }

  document.addEventListener('pointerdown', event => {
    if (!popup || popup.hidden || event.target.closest('.trace-iro-popup, .trace-color-control')) return;
    popup.hidden = true;
    activeControl = null;
  }, true);

  window.ASMTraceColorPicker = { create };
})();
