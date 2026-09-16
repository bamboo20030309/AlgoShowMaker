(() => {
  const query = window.matchMedia('(max-width: 760px), (pointer: coarse) and (max-width: 900px)');
  const body = document.body;
  if (!body) return;

  const mobileClasses = [
    'asm-mobile-code-open',
    'asm-mobile-more-open',
    'asm-mobile-studio-rail-open',
    'asm-mobile-studio-inspector-open',
    'asm-mobile-slide-tools-open',
    'asm-mobile-slide-controls-open'
  ];

  const closeAlgorithmDrawers = except => {
    ['asm-mobile-code-open', 'asm-mobile-more-open', 'asm-mobile-studio-rail-open', 'asm-mobile-studio-inspector-open']
      .filter(name => name !== except)
      .forEach(name => body.classList.remove(name));
  };

  const notifyLayout = () => requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));

  function sourcePositionAt(text, offset) {
    const before = text.slice(0, Math.max(0, offset)).split('\n');
    return { row: before.length - 1, column: before[before.length - 1].length };
  }

  function installAceNativeMobileInput() {
    const container = document.getElementById('editor');
    const editor = container?.env?.editor;
    if (!container || !editor) return null;
    let input = container.querySelector('.asm-mobile-code-input');
    if (input) return input;

    input = document.createElement('textarea');
    input.className = 'asm-mobile-code-input';
    input.value = editor.getValue();
    input.setAttribute('aria-label', 'C++ 程式碼編輯器');
    input.setAttribute('autocomplete', 'off');
    input.setAttribute('autocapitalize', 'off');
    input.setAttribute('autocorrect', 'off');
    input.setAttribute('spellcheck', 'false');
    input.setAttribute('wrap', 'soft');

    let syncingFromNative = false;
    input.addEventListener('input', () => {
      const selectionStart = input.selectionStart;
      const selectionEnd = input.selectionEnd;
      syncingFromNative = true;
      editor.session.setValue(input.value);
      const start = sourcePositionAt(input.value, selectionStart);
      const end = sourcePositionAt(input.value, selectionEnd);
      editor.selection?.setSelectionRange?.({ start, end });
      syncingFromNative = false;
    });
    input.addEventListener('focus', () => {
      if (input.value !== editor.getValue()) input.value = editor.getValue();
    });
    editor.session.on('change', () => {
      if (syncingFromNative || document.activeElement === input) return;
      input.value = editor.getValue();
    });
    container.appendChild(input);
    return input;
  }

  function syncAceMobileClipboard() {
    const editor = document.getElementById('editor')?.env?.editor;
    if (!editor) return;
    // ACE renders source text in positioned layers, which some iOS webviews do
    // not expose to the native selection menu. A synchronized real textarea is
    // used only on mobile so long-press selection and paste remain native.
    editor.setOption('enableMobileMenu', !query.matches);
    const input = installAceNativeMobileInput();
    if (input) input.hidden = !query.matches;
  }

  const button = (label, action, className = '') => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.dataset.mobileAction = action;
    if (className) element.className = className;
    element.setAttribute('aria-pressed', 'false');
    return element;
  };

  function syncAlgorithmDock(dock) {
    if (!dock) return;
    const state = {
      code: body.classList.contains('asm-mobile-code-open'),
      more: body.classList.contains('asm-mobile-more-open'),
      frames: body.classList.contains('asm-mobile-studio-rail-open'),
      inspector: body.classList.contains('asm-mobile-studio-inspector-open')
    };
    dock.querySelectorAll('[data-mobile-action]').forEach(element => {
      element.setAttribute('aria-pressed', String(Boolean(state[element.dataset.mobileAction])));
    });
  }

  function installAlgorithmDock() {
    if (!document.getElementById('arraySvg')) return;
    // Embedded slide animations already receive their transport from the parent slide.
    if (new URLSearchParams(location.search).has('asmEmbed')) return;
    const dock = document.createElement('nav');
    dock.className = 'asm-mobile-dock asm-mobile-algorithm-dock';
    dock.setAttribute('aria-label', '手機版工作區切換');
    dock.append(
      button('程式碼', 'code', 'asm-mobile-standard-only'),
      button('畫布', 'canvas'),
      button('輸入', 'input', 'asm-mobile-standard-only'),
      button('更多', 'more', 'asm-mobile-standard-only'),
      button('幀', 'frames', 'asm-mobile-studio-only'),
      button('屬性', 'inspector', 'asm-mobile-studio-only')
    );

    const tabs = document.getElementById('subTabs');
    const extraActions = [
      ['範例', 'algoSamplesBtn'],
      ['編輯動畫', 'editAnimationBtn'],
      ['事件設定', 'eventSettingsBtn']
    ];
    extraActions.forEach(([label, targetId]) => {
      if (!tabs) return;
      const wrapper = document.createElement('div');
      wrapper.className = 'subTab asm-mobile-extra-tab';
      const extra = document.createElement('button');
      extra.type = 'button';
      extra.className = 'tab-btn';
      extra.textContent = label;
      extra.addEventListener('click', () => {
        body.classList.remove('asm-mobile-more-open');
        document.getElementById(targetId)?.click();
        syncAlgorithmDock(dock);
      });
      wrapper.appendChild(extra);
      tabs.appendChild(wrapper);
    });
    dock.addEventListener('click', event => {
      const control = event.target.closest('[data-mobile-action]');
      if (!control || !query.matches) return;
      const action = control.dataset.mobileAction;
      if (action === 'canvas') {
        closeAlgorithmDrawers();
        document.querySelector('.tab-btn[data-tab="tab-canvas"]')?.click();
      } else if (action === 'input') {
        closeAlgorithmDrawers();
        document.querySelector('.tab-btn[data-tab="tab-input"]')?.click();
      } else {
        const className = {
          code: 'asm-mobile-code-open',
          more: 'asm-mobile-more-open',
          frames: 'asm-mobile-studio-rail-open',
          inspector: 'asm-mobile-studio-inspector-open'
        }[action];
        if (!className) return;
        const open = !body.classList.contains(className);
        closeAlgorithmDrawers(className);
        body.classList.toggle(className, open);
        if (action === 'code' && open) document.getElementById('codePanel')?.classList.remove('collapsed');
      }
      syncAlgorithmDock(dock);
      notifyLayout();
    });
    body.appendChild(dock);
    new MutationObserver(() => syncAlgorithmDock(dock)).observe(body, { attributes: true, attributeFilter: ['class'] });
    syncAlgorithmDock(dock);
  }

  function syncSlidesDock(dock) {
    if (!dock) return;
    const state = {
      tools: body.classList.contains('asm-mobile-slide-tools-open'),
      controls: body.classList.contains('asm-mobile-slide-controls-open')
    };
    dock.querySelectorAll('[data-mobile-action]').forEach(element => {
      element.setAttribute('aria-pressed', String(Boolean(state[element.dataset.mobileAction])));
    });
    const mode = dock.querySelector('[data-mobile-action="mode"]');
    if (mode) mode.textContent = body.classList.contains('asm-edit-mode') ? '播放模式' : '編輯模式';
  }

  function installSlidesDock() {
    if (!document.getElementById('slidesRoot')) return;
    const dock = document.createElement('nav');
    dock.className = 'asm-mobile-dock asm-mobile-slides-dock';
    dock.setAttribute('aria-label', '手機版投影片工具');
    dock.append(
      button('畫布', 'canvas'),
      button('元件', 'tools', 'asm-mobile-slide-edit-only'),
      button('控制', 'controls'),
      button('播放模式', 'mode')
    );
    dock.addEventListener('click', event => {
      const control = event.target.closest('[data-mobile-action]');
      if (!control || !query.matches) return;
      const action = control.dataset.mobileAction;
      if (action === 'canvas') {
        body.classList.remove('asm-mobile-slide-tools-open', 'asm-mobile-slide-controls-open');
      } else if (action === 'tools') {
        const open = !body.classList.contains('asm-mobile-slide-tools-open');
        body.classList.toggle('asm-mobile-slide-tools-open', open);
        body.classList.remove('asm-mobile-slide-controls-open');
      } else if (action === 'controls') {
        const open = !body.classList.contains('asm-mobile-slide-controls-open');
        body.classList.toggle('asm-mobile-slide-controls-open', open);
        body.classList.remove('asm-mobile-slide-tools-open');
      } else if (action === 'mode') {
        body.classList.remove('asm-mobile-slide-tools-open', 'asm-mobile-slide-controls-open');
        document.getElementById('modeToggleBtn')?.click();
      }
      syncSlidesDock(dock);
      notifyLayout();
    });
    body.appendChild(dock);
    new MutationObserver(() => syncSlidesDock(dock)).observe(body, { attributes: true, attributeFilter: ['class'] });
    syncSlidesDock(dock);
  }

  function syncMode() {
    body.classList.toggle('asm-mobile-ui', query.matches);
    if (!query.matches) mobileClasses.forEach(name => body.classList.remove(name));
    syncAceMobileClipboard();
    notifyLayout();
  }

  installAlgorithmDock();
  installSlidesDock();
  syncMode();
  query.addEventListener?.('change', syncMode);
})();
