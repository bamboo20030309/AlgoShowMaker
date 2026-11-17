/**
 * 測試模組：slide-video.test
 *
 * 驗證重點：YouTube 網址解析、時間格式、欄位正規化與嵌入網址只由驗證過的影片 ID 組成。
 * 執行環境：Node.js 單元測試；不連線 YouTube。
 * 維護原則：支援的網址格式改變時同步更新案例；不得放寬主機白名單或 ID 格式讓錯誤通過。
 */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const video = require('../public/slide-video.js');

const ID = 'dQw4w9WgXcQ';

test('parses supported YouTube link shapes', () => {
  const cases = [
    [`https://www.youtube.com/watch?v=${ID}`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }],
    [`https://m.youtube.com/watch?v=${ID}&t=90`, { videoId: ID, startSeconds: 90, endSeconds: null, aspect: '16:9' }],
    [`https://music.youtube.com/watch?v=${ID}&list=PL123`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }],
    [`youtube.com/watch?feature=share&v=${ID}`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }],
    [`https://youtu.be/${ID}?t=1m30s&si=abc`, { videoId: ID, startSeconds: 90, endSeconds: null, aspect: '16:9' }],
    [`https://www.youtube.com/shorts/${ID}`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '9:16' }],
    [`https://www.youtube.com/embed/${ID}?start=10&end=40`, { videoId: ID, startSeconds: 10, endSeconds: 40, aspect: '16:9' }],
    [`https://www.youtube-nocookie.com/embed/${ID}`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }],
    [`https://www.youtube.com/live/${ID}?feature=share`, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }],
    [`https://www.youtube.com/watch?v=${ID}#t=1h2m3s`, { videoId: ID, startSeconds: 3723, endSeconds: null, aspect: '16:9' }],
    [`  ${ID}  `, { videoId: ID, startSeconds: 0, endSeconds: null, aspect: '16:9' }]
  ];
  for (const [input, expected] of cases) assert.deepEqual(video.parseYouTubeInput(input), expected, input);
});

test('rejects non-YouTube hosts, schemes and malformed ids', () => {
  const rejected = [
    '',
    'javascript:alert(1)',
    `https://evil.example/watch?v=${ID}`,
    `https://youtube.com.evil.example/watch?v=${ID}`,
    `https://user:pass@www.youtube.com/watch?v=${ID}`,
    `ftp://www.youtube.com/watch?v=${ID}`,
    'https://www.youtube.com/watch?v=short',
    `https://www.youtube.com/watch?v=${ID}x`,
    'https://www.youtube.com/watch?v=dQw4w9WgXc"',
    `https://www.youtube-nocookie.com/watch?v=${ID}`,
    'https://www.youtube.com/@channel'
  ];
  for (const input of rejected) assert.ok(video.parseYouTubeInput(input).error, input);
});

test('end time before start is dropped and times are clamped', () => {
  assert.equal(video.parseYouTubeInput(`https://www.youtube.com/embed/${ID}?start=50&end=40`).endSeconds, null);
  assert.equal(video.parseTime('1:02:03'), 3723);
  assert.equal(video.parseTime('01:30'), 90);
  assert.equal(video.parseTime('90s'), 90);
  assert.equal(video.parseTime('abc'), null);
  assert.equal(video.parseTime(-5), null);
  assert.equal(video.parseTime(10 ** 9), 24 * 60 * 60);
  assert.equal(video.formatTime(90), '1:30');
  assert.equal(video.formatTime(3723), '1:02:03');
  assert.equal(video.formatTime(0), '');
});

test('normalizes missing, explicit and invalid fields separately', () => {
  const legacy = video.normalizeFields({ videoId: ID });
  assert.deepEqual(legacy, {
    provider: 'youtube', videoId: ID, startSeconds: 0, endSeconds: null,
    autoplay: false, muted: false, aspect: '16:9', title: '', content: video.fallbackText(ID)
  });
  const custom = video.normalizeFields({
    videoId: ID, startSeconds: 12, endSeconds: 30, autoplay: true, muted: true, aspect: '9:16', title: 'A\nB'
  });
  assert.equal(custom.startSeconds, 12);
  assert.equal(custom.endSeconds, 30);
  assert.equal(custom.autoplay, true);
  assert.equal(custom.muted, true);
  assert.equal(custom.aspect, '9:16');
  assert.equal(custom.title, 'A B');
  const off = video.normalizeFields({ videoId: ID, autoplay: false, muted: false, startSeconds: 0 });
  assert.equal(off.autoplay, false);
  assert.equal(off.muted, false);
  const invalid = video.normalizeFields({ videoId: '<script>', autoplay: 'yes' });
  assert.equal(invalid.videoId, '');
  assert.equal(invalid.autoplay, false);
  assert.match(invalid.content, /無效/);
  assert.match(legacy.content, /https:\/\/youtu\.be\/dQw4w9WgXcQ/);
});

test('embed URL is built only from validated fields', () => {
  const url = new URL(video.buildEmbedUrl(
    { videoId: ID, startSeconds: 15, endSeconds: 45, muted: true },
    { autoplay: true, origin: 'http://127.0.0.1:3103' }
  ));
  assert.equal(url.origin, 'https://www.youtube-nocookie.com');
  assert.equal(url.pathname, `/embed/${ID}`);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    enablejsapi: '1', rel: '0', playsinline: '1', origin: 'http://127.0.0.1:3103',
    start: '15', end: '45', autoplay: '1', mute: '1'
  });
  const plain = new URL(video.buildEmbedUrl({ videoId: ID }, { origin: 'javascript:alert(1)' }));
  assert.equal(plain.searchParams.has('origin'), false);
  assert.equal(plain.searchParams.has('autoplay'), false);
  assert.equal(video.buildEmbedUrl({ videoId: '../x' }), '');
  assert.equal(video.posterUrl(ID), `https://i.ytimg.com/vi/${ID}/hqdefault.jpg`);
  assert.equal(video.watchUrl({ videoId: ID, startSeconds: 20 }), `https://www.youtube.com/watch?v=${ID}&t=20s`);
});

test('only a lone YouTube link is treated as a pasted video', () => {
  assert.equal(video.looksLikeYouTubeUrl(`https://youtu.be/${ID}`), true);
  assert.equal(video.looksLikeYouTubeUrl(`www.youtube.com/watch?v=${ID}`), true);
  assert.equal(video.looksLikeYouTubeUrl(`看這個 https://youtu.be/${ID}`), false);
  assert.equal(video.looksLikeYouTubeUrl(ID), false);
  assert.equal(video.looksLikeYouTubeUrl('https://www.youtube.com/'), false);
});
