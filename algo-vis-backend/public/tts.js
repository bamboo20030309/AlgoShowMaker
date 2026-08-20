// tts.js - 自動優先選「自然語音」(Microsoft Online Natural/Neural) 的免費方案
;(function () {
  const hasAPI =
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    "SpeechSynthesisUtterance" in window;

  let cachedVoices = [];
  const ALGOSHOW_TTS_VOICE_REGEX = /(Microsoft).*(Natural|Neural).*(Chinese|Taiwan|zh[-_]?TW)/i;
  const DISABLED_TTS_VOICE_NAMES = new Set([
    'microsoft hanhan - chinese (traditional, taiwan)'
  ]);

  function parseTTSMarkup(value) {
    const source = String(value ?? "");
    let display = "";
    let speech = "";
    let cursor = 0;
    while (cursor < source.length) {
      if (source[cursor] !== "{") {
        display += source[cursor];
        speech += source[cursor];
        cursor += 1;
        continue;
      }
      const end = source.indexOf("}", cursor + 1);
      if (end < 0) {
        display += source[cursor];
        speech += source[cursor];
        cursor += 1;
        continue;
      }
      const inner = source.slice(cursor + 1, end);
      const separator = inner.indexOf(":");
      if (separator >= 0) {
        display += inner.slice(0, separator);
        speech += inner.slice(separator + 1);
      } else {
        display += inner;
      }
      cursor = end + 1;
    }
    return { display, speech };
  }

  function refreshVoices() {
    if (!hasAPI) return [];
    cachedVoices = window.speechSynthesis.getVoices() || [];
    return cachedVoices;
  }
  if (hasAPI) {
    refreshVoices();
    window.speechSynthesis.onvoiceschanged = refreshVoices;
  }

  // 等待 voices 可用（Edge/Chrome 需要）
  function waitForVoices(timeoutMs = 2000, intervalMs = 100) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function tick() {
        const v = refreshVoices();
        if (v.length || Date.now() - start > timeoutMs) return resolve(v);
        setTimeout(tick, intervalMs);
      })();
    });
  }

  // 根據語言與偏好自動挑選最自然的 voice
  function pickBestVoice({ lang = "zh-TW", preferredVoiceRegex } = {}) {
    const voices = cachedVoices.length ? cachedVoices : refreshVoices();
    if (!voices.length) return null;
    const selectableVoices = voices.filter(voice => (
      !DISABLED_TTS_VOICE_NAMES.has(String(voice.name || '').trim().toLowerCase())
    ));
    if (!selectableVoices.length) return null;

    // 預設偏好：Microsoft 線上自然語音（名稱常含 Natural / Neural），且為非本機(localService=false)
    const defaultRegex =
      preferredVoiceRegex ||
      ALGOSHOW_TTS_VOICE_REGEX;
    // 1) 自然語音 + 語言相符 + 線上 voice
    let best = selectableVoices.find(
      v =>
        v.lang &&
        v.lang.toLowerCase().startsWith(lang.toLowerCase()) &&
        defaultRegex.test(v.name || "") &&
        v.localService === false // 線上
    );
    if (best) return best;

    // 2) 自然語音 + 線上，不強制 lang
    best = selectableVoices.find(
      v => defaultRegex.test(v.name || "") && v.localService === false
    );
    if (best) return best;

    // 3) 同語系 zh-* 的任何線上 voice
    best = selectableVoices.find(
      v => v.lang && /^zh/i.test(v.lang) && v.localService === false
    );
    if (best) return best;

    // 4) 同語言 lang 的任何 voice（含本機）
    best = selectableVoices.find(
      v => v.lang && v.lang.toLowerCase().startsWith(lang.toLowerCase())
    );
    if (best) return best;

    // 5) 退而求其次：任一 voice
    return selectableVoices[0] || null;
  }

  /**
   * 朗讀文字
   * @param {string} text
   * @param {Object} options
   *   - lang='zh-TW'
   *   - rate=1, pitch=1, volume=1
   *   - voiceName: 指定 voice 名稱（可用 getVoices() 查看）
   *   - preferredVoiceRegex: 自訂挑選自然聲音的正則
   *   - interrupt=true: 播放前中斷現有語音
   *   - requireUserGesture=true: 若無使用者互動則不主動播（避免自動播放被擋&去警告）
   *   - onstart/onend/onerror
   */
  async function speakText(text, options = {}) {
    if (!hasAPI) {
      console.warn("[TTS] 此瀏覽器不支援 SpeechSynthesis。");
      return null;
    }

    const {
      lang = "zh-TW",
      rate = 1,
      pitch = 1,
      volume = 1,
      voiceName,
      preferredVoiceRegex,
      interrupt = true,
      requireUserGesture = true,
      onstart,
      onend,
      onerror
    } = options;

    // 避免「沒有使用者互動就播放」的 deprecated 警告 / 封鎖
    if (requireUserGesture && !userActivated()) {
      console.warn("[TTS] 等待使用者互動後再播放（避免自動播放限制）。");
      return null;
    }

    // 確保 voices 取得
    await waitForVoices();

    const source = String(text ?? '');
    if (!source) return null;
    const availableVoices = cachedVoices.length ? cachedVoices : refreshVoices();
    const utterance = new SpeechSynthesisUtterance(source);
    const namedVoice = voiceName
      ? availableVoices.find(voice => voice.name === voiceName)
      : null;
    const voice = namedVoice || pickBestVoice({
      lang,
      preferredVoiceRegex: preferredVoiceRegex || ALGOSHOW_TTS_VOICE_REGEX
    });
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang || lang;
    utterance.rate = rate;
    utterance.pitch = pitch;
    utterance.volume = volume;
    if (typeof onstart === 'function') utterance.onstart = onstart;
    if (typeof onend === 'function') utterance.onend = onend;
    if (typeof onerror === 'function') utterance.onerror = onerror;
    const voiceLabel = utterance.voice?.name || `browser-default (${utterance.lang})`;
    document.documentElement.dataset.asmTtsVoice = voiceLabel;
    document.documentElement.dataset.asmTtsVoices = voiceLabel;
    document.documentElement.dataset.asmTtsLanguages = utterance.lang;

    if (interrupt) {
      try { window.speechSynthesis.cancel(); } catch {}
    }
    window.speechSynthesis.speak(utterance);
    return utterance;
  }

  function stopSpeak() {
    if (!hasAPI) return;
    try { window.speechSynthesis.cancel(); } catch {}
  }

  function getTTSSupported() {
    return !!hasAPI;
  }

  function getVoices() {
    return hasAPI ? (cachedVoices.length ? cachedVoices : refreshVoices()) : [];
  }

  function getAlgoShowMakerTTSProfile(settings = {}) {
    const rate = Number(settings.rate);
    const volume = Number(settings.volume);
    const lang = String(settings.lang || 'zh-TW');
    const preferredVoiceRegex = settings.preferredVoiceRegex || ALGOSHOW_TTS_VOICE_REGEX;
    const voice = pickBestVoice({
      lang,
      preferredVoiceRegex
    });
    return {
      voice,
      voiceName: voice?.name,
      lang: voice?.lang || lang,
      rate: Math.min(2, Math.max(0.5, Number.isFinite(rate) ? rate : 1.2)),
      volume: Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.3)),
      pitch: 1,
      preferredVoiceRegex
    };
  }

  // 粗略判斷：是否已有使用者互動（點擊、鍵盤、觸控）
  let _activated = false;
  function markActivated() { _activated = true; }
  function userActivated() { return _activated; }
  if (typeof window !== "undefined") {
    window.addEventListener("pointerdown", markActivated, { once: true, capture: true });
    window.addEventListener("keydown",     markActivated, { once: true, capture: true });
    window.addEventListener("touchstart",  markActivated, { once: true, capture: true });
  }

  // 導出
  window.speakText = speakText;
  window.stopSpeak = stopSpeak;
  window.getTTSSupported = getTTSSupported;
  window.getVoices = getVoices;
  window.waitForTTSVoices = waitForVoices;
  window.pickBestTTSVoice = pickBestVoice;
  window.getAlgoShowMakerTTSProfile = getAlgoShowMakerTTSProfile;
  window.parseTTSMarkup = parseTTSMarkup;
})();
