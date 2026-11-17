// -----------------------------------------------------------------------------
// 投影片影片（YouTube）資料模型
// 解析使用者貼上的網址、正規化 video widget 欄位，並只以驗證過的影片 ID 組出嵌入網址。
// 本模組不碰 DOM，可在 Node 測試。
// -----------------------------------------------------------------------------
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ASMSlideVideo = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
  const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
  const MAX_SECONDS = 24 * 60 * 60;
  const MAX_TITLE = 120;
  const WATCH_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com']);
  const EMBED_HOSTS = new Set(['youtube-nocookie.com', 'www.youtube-nocookie.com']);
  const SHORT_HOSTS = new Set(['youtu.be', 'www.youtu.be']);
  const DEFAULT_SIZE = { '16:9': { w: 640, h: 360 }, '9:16': { w: 270, h: 480 } };
  const INVALID_INPUT = '請貼上 YouTube 影片網址（watch、youtu.be、shorts 或 embed 連結）';

  function isVideoId(value) {
    return typeof value === 'string' && ID_PATTERN.test(value);
  }

  // 接受 90、90s、1m30s、1h2m3s、01:30、1:02:03；其他格式回傳 null。
  function parseTime(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number') return Number.isFinite(value) && value >= 0 ? Math.min(MAX_SECONDS, Math.floor(value)) : null;
    const text = String(value).trim().toLowerCase();
    if (!text) return null;
    let seconds = null;
    if (/^\d+(?:\.\d+)?s?$/.test(text)) seconds = Math.floor(parseFloat(text));
    else if (/^(?:\d+h)?(?:\d+m)?(?:\d+s)?$/.test(text)) {
      const match = text.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
      seconds = (Number(match[1]) || 0) * 3600 + (Number(match[2]) || 0) * 60 + (Number(match[3]) || 0);
    } else if (/^\d+(?::\d{1,2}){1,2}$/.test(text)) {
      seconds = text.split(':').reduce((total, part) => total * 60 + Number(part), 0);
    }
    return seconds === null || !Number.isFinite(seconds) ? null : Math.min(MAX_SECONDS, seconds);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return '';
    const h = Math.floor(seconds / 3600), m = Math.floor(seconds % 3600 / 60), s = seconds % 60;
    const pad = value => String(value).padStart(2, '0');
    return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
  }

  function parseYouTubeInput(input) {
    const text = String(input || '').trim();
    if (!text) return { error: INVALID_INPUT };
    if (isVideoId(text)) return { videoId: text, startSeconds: 0, endSeconds: null, aspect: '16:9' };
    let url;
    try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); }
    catch { return { error: INVALID_INPUT }; }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { error: INVALID_INPUT };
    if (url.username || url.password || (url.port && url.port !== '443' && url.port !== '80')) return { error: INVALID_INPUT };
    const host = url.hostname.toLowerCase();
    const parts = url.pathname.split('/').filter(Boolean);
    let videoId = '', aspect = '16:9';
    if (SHORT_HOSTS.has(host)) videoId = parts[0] || '';
    else if (WATCH_HOSTS.has(host) || EMBED_HOSTS.has(host)) {
      if (EMBED_HOSTS.has(host) && parts[0] !== 'embed') return { error: INVALID_INPUT };
      if (parts[0] === 'watch') videoId = url.searchParams.get('v') || '';
      else if (['embed', 'shorts', 'live', 'v', 'e'].includes(parts[0])) {
        videoId = parts[1] || '';
        if (parts[0] === 'shorts') aspect = '9:16';
      } else if (!parts.length && url.searchParams.get('v')) videoId = url.searchParams.get('v');
    } else return { error: INVALID_INPUT };
    if (!isVideoId(videoId)) return { error: '找不到有效的 YouTube 影片 ID' };
    // Hash fragments such as #t=90 are also used by older share links.
    const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''));
    const start = parseTime(url.searchParams.get('start') ?? url.searchParams.get('t') ?? hashParams.get('t'));
    const end = parseTime(url.searchParams.get('end'));
    const startSeconds = start || 0;
    return { videoId, startSeconds, endSeconds: end !== null && end > startSeconds ? end : null, aspect };
  }

  function fallbackText(videoId) {
    return isVideoId(videoId)
      ? `▶ YouTube 影片：https://youtu.be/${videoId}（此版本不支援影片，請重新整理頁面）`
      : '▶ YouTube 影片（影片資料無效）';
  }

  // 只處理影片專屬欄位；位置、圖層與動畫欄位由 slides.js 的共用正規化負責。
  function normalizeFields(widget = {}) {
    const videoId = isVideoId(widget.videoId) ? widget.videoId : '';
    const start = parseTime(widget.startSeconds);
    const startSeconds = start || 0;
    const end = parseTime(widget.endSeconds);
    return {
      provider: 'youtube',
      videoId,
      startSeconds,
      endSeconds: end !== null && end > startSeconds ? end : null,
      autoplay: widget.autoplay === true,
      muted: widget.muted === true,
      aspect: widget.aspect === '9:16' ? '9:16' : '16:9',
      title: typeof widget.title === 'string' ? widget.title.replace(/[\u0000-\u001f]/g, ' ').slice(0, MAX_TITLE) : '',
      content: fallbackText(videoId)
    };
  }

  function buildEmbedUrl(widget, { autoplay = false, origin = '' } = {}) {
    if (!isVideoId(widget?.videoId)) return '';
    const params = new URLSearchParams({ enablejsapi: '1', rel: '0', playsinline: '1' });
    if (/^https?:\/\/[^/]+$/.test(origin)) params.set('origin', origin);
    const start = parseTime(widget.startSeconds) || 0;
    const end = parseTime(widget.endSeconds);
    if (start) params.set('start', String(start));
    if (end !== null && end > start) params.set('end', String(end));
    if (autoplay) params.set('autoplay', '1');
    if (widget.muted === true) params.set('mute', '1');
    return `${EMBED_ORIGIN}/embed/${widget.videoId}?${params}`;
  }

  function posterUrl(videoId) {
    return isVideoId(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  }

  function watchUrl(widget) {
    if (!isVideoId(widget?.videoId)) return '';
    const start = parseTime(widget.startSeconds) || 0;
    return `https://www.youtube.com/watch?v=${widget.videoId}${start ? `&t=${start}s` : ''}`;
  }

  function shareUrl(widget) {
    if (!isVideoId(widget?.videoId)) return '';
    const start = parseTime(widget.startSeconds) || 0;
    return `https://youtu.be/${widget.videoId}${start ? `?t=${start}` : ''}`;
  }

  // 只辨識完整的一段網址；混在其他文字中的連結不自動轉成影片。
  function looksLikeYouTubeUrl(text) {
    const value = String(text || '').trim();
    if (!value || /\s/.test(value) || value.length > 2048) return false;
    if (!/^(?:https?:\/\/)?(?:www\.|m\.|music\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)\//i.test(value)) return false;
    return !parseYouTubeInput(value).error;
  }

  return {
    EMBED_ORIGIN,
    DEFAULT_SIZE,
    isVideoId,
    parseTime,
    formatTime,
    parseYouTubeInput,
    normalizeFields,
    fallbackText,
    buildEmbedUrl,
    posterUrl,
    watchUrl,
    shareUrl,
    looksLikeYouTubeUrl
  };
});
