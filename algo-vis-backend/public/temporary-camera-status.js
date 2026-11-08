/** 本機鏡頭後偏移獨立於動畫新鮮度；只重設目前介面的暫時狀態。 */
(function () {
  function update() {
    const button = document.getElementById('temporaryCameraResetBtn');
    if (!button) return;
    const camera = window.getPresentationCameraTransform?.();
    const active = camera && (Math.abs(camera.zoomFactor - 1) > 0.0001
      || Math.abs(camera.panXRatio) > 0.0001 || Math.abs(camera.panYRatio) > 0.0001);
    button.hidden = !active;
    button.textContent = `鏡頭偏移 ${Math.round((camera?.zoomFactor || 1) * 100)}% · 重設`;
    button.title = '目前有本機暫時縮放或位移；按一下回到程式碼設定的鏡頭，不更動投影片。';
  }
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('temporaryCameraResetBtn')?.addEventListener('click', () => {
      window.resetTemporaryCamera?.();
      update();
    });
    update();
  });
  window.addEventListener('asm:camera-user-change', update);
  window.addEventListener('asm:temporary-camera-change', update);
})();
