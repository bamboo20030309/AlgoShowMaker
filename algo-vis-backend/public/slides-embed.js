(function () {
  const mode = new URLSearchParams(window.location.search).get('asmEmbed');
  if (!mode) return;

  document.body.classList.add(`asm-embed-${mode}`);
  let currentAnimation = {
    code: '',
    input: '',
    scriptContent: ''
  };

  function snapshotAnimation() {
    const input = document.getElementById('inputArea');
    return {
      code: typeof aceEditor !== 'undefined' ? aceEditor.getValue() : currentAnimation.code,
      input: input ? input.value : currentAnimation.input,
      scriptContent: currentAnimation.scriptContent
    };
  }

  function applyAnimation(animation = {}) {
    currentAnimation = {
      code: typeof animation.code === 'string' ? animation.code : '',
      input: typeof animation.input === 'string' ? animation.input : '',
      scriptContent: typeof animation.scriptContent === 'string' ? animation.scriptContent : ''
    };
    if (animation.code && typeof aceEditor !== 'undefined') {
      window.__asmEmbeddedAnimationPayload = animation;
      aceEditor.setValue(animation.code, -1);
      if (typeof foldDrawBlocks === 'function') setTimeout(foldDrawBlocks, 0);
    }
    const input = document.getElementById('inputArea');
    if (input && typeof animation.input === 'string') input.value = animation.input;
    if (animation.scriptContent && typeof window.asmApplyAnimationScript === 'function') {
      window.asmApplyAnimationScript(animation.scriptContent);
    }
  }

  window.addEventListener('message', event => {
    if (event.origin !== window.location.origin || !event.data) return;
    if (event.data.type === 'asm-load-animation') {
      applyAnimation(event.data.animation);
      return;
    }
    if (event.data.type === 'asm-request-save-animation' && mode === 'editor' && window.parent !== window) {
      window.parent.postMessage({
        type: 'asm-save-animation',
        animation: snapshotAnimation()
      }, window.location.origin);
    }
  });

  window.addEventListener('asm:compiled-animation', event => {
    if (mode !== 'editor' || window.parent === window) return;
    currentAnimation = {
      code: typeof event.detail?.code === 'string' ? event.detail.code : '',
      input: typeof event.detail?.input === 'string' ? event.detail.input : '',
      scriptContent: typeof event.detail?.scriptContent === 'string' ? event.detail.scriptContent : ''
    };
    window.parent.postMessage({
      type: 'asm-animation-compiled',
      animation: currentAnimation
    }, window.location.origin);
  });

  window.addEventListener('load', () => {
    if (window.parent === window) return;
    window.parent.postMessage({ type: 'asm-embed-ready', mode }, window.location.origin);
  });
})();
