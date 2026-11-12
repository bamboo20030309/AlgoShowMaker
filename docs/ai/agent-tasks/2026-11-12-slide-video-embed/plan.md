# 投影片嵌入影片（YouTube）實作計畫

- 日期：2026-11-12
- 狀態：使用者已於 2026-11-12 確認第 8 節決定；尚未實作任何程式。
- 基準分支：`intergration`（`cac6cf5`）。本計畫在 `claude/2026-11-12-slide-video-embed` 撰寫。
- 對應待辦：`docs/ai/development-instructions.md`「2026-11-11 使用者希望之後實作投影片嵌入影片功能」。

## 1. 現況（依實際程式碼）

### 1.1 Deck 格式與儲存

- Deck 是純 JSON：`{ ttsSettings, groups: [{ id, slides: [slide] }] }`。每張 slide 有 `id`、`canvas`（Fabric JSON）、`widgets`（HTML 元件陣列）、TTS 欄位；演算法頁另有 `kind: 'algorithm-animation'` 與 `animation`。
- 所有載入入口都經 `normalizeDeck` → `normalizeSlide` → `normalizeCanvasJson`／`normalizeWidgets`（`public/slides.js:673`、`:2682`、`:2939`）。`normalizeSlide` 以 `...slide` 展開，**slide 層級未知欄位會保留**。
- **關鍵相容性問題**：`normalizeWidgets` 只認得 `code`、`structure`、`table`，**其餘型別一律改成 `latex`**，並只複製已知欄位（`slides.js:2941-2947`）。也就是說，現行程式若讀到 `type: 'video'` 的 widget，會把它變成空白／預設公式的 LaTeX 方塊，一存檔影片資料就永久遺失。
- 儲存：`saveDeck`（`slides.js:698`）寫 IndexedDB 草稿（`slides-storage.js`），並排程雲端儲存。伺服器 `PUT /api/slides/:deck_uid`、`PUT /api/shared-slides/:share_token`（`server.js:1289`、`:1368`）把 `deck` 當不透明物件存入 MongoDB，大型 trace／素材由 `cloud-content.js` 分片；**伺服器不驗證 widget 型別，不需修改**。
- 匯出：`.asmdeck`（`asmdeck.js`，`exportDeckJson` 於 `slides.js:1211`）封裝 deck JSON 與雜湊資產；單一資產上限 8 MB、封裝上限 32 MB。YouTube 影片只是幾個欄位，不產生資產。

### 1.2 編輯器與呈現

- 每張一般投影片的 DOM（`createSlideSection`，`slides.js:3510`）：`fabric-host`（Fabric canvas，文字／圖形／貼上圖片）＋ `widget-layer`（HTML widget：LaTeX、code、table、structure）。
- Widget DOM：`createWidgetElement`／`paintWidgetElement`／`syncWidgetElementInPlace`（`slides.js:3607-3700`），以 `x/y/w/h/layerIndex` 定位，統一參與選取、吸附（`snapCandidateBounds`，`:5653`）、剪貼簿（`:6236`）、圖層清單（`:7535`）、側欄編輯器（`showWidgetEditor`，`:7390`）。
- 新增元件：左側 palette `data-tool="..."`（`slides.html:136-208`）→ `addObject(kind, point)`（`slides.js:5309`）。
- 動畫：`applyAnimationAttributes`（`:3469`）支援 fragment（逐步出現）與 `transitionId`（code／structure 有自訂轉場，其餘 widget 走 Reveal 原生 `data-id` auto-animate，即對目的元素做 FLIP，不複製節點）。
- 換頁：`reveal.on('slidechanged', ...)`（`:12208`）集中處理 TTS、演算法 iframe 可見性等。
- **既有 iframe 先例**：演算法頁用同源 iframe（`algorithm.html?asmEmbed=runtime`），`syncAlgorithmFrameVisibility`（`:10226`）只保留目前頁＋最近一頁的 runtime，其他改回 `about:blank`；訊息以 `event.origin === location.origin` 過濾（`:10296`）。影片可沿用「只保留少量活躍 iframe」的策略。
- 縮圖／封面：`deck-thumbnail.js` 把 Fabric 與 widget 畫到 640×360 canvas，供首頁封面（`cover_thumbnail`）與自訂總覽（`slides.js:10808`）。未知 widget 型別目前直接略過。Reveal 原生總覽則顯示**實際 DOM**。
- Reveal 設定（`:12172`）：`mouseWheel: false`（滾輪切頁為自訂實作）、`keyboard` 自訂。Reveal 內建的 YouTube 自動暫停只比對 `youtube.com/embed/`，**不會匹配 `youtube-nocookie.com`**，播放控制需自行實作。
- 安全標頭：`server.js` 與 `nginx.conf` 目前**沒有 Content-Security-Policy、X-Frame-Options**。

## 2. 資料模型：`video` widget

採用 `slide.widgets` 中的新型別，讓影片自動享有選取、拖曳、縮放、吸附、圖層、剪貼簿、fragment 與 undo/redo。

```jsonc
{
  "id": "…", "type": "video",
  "x": 160, "y": 120, "w": 640, "h": 360, "layerIndex": 1000,
  "provider": "youtube",          // 目前唯一值；保留給日後 mp4
  "videoId": "dQw4w9WgXcQ",       // 必須符合 ^[A-Za-z0-9_-]{11}$
  "startSeconds": 0,              // 整數 ≥ 0
  "endSeconds": null,             // null 或 > startSeconds
  "autoplay": false,              // 換到本頁（或 fragment 出現）時自動播放
  "muted": false,                 // autoplay 時瀏覽器多半要求靜音，UI 會提示
  "aspect": "16:9",               // "16:9" | "9:16"（Shorts）；縮放時鎖定比例
  "title": "",                    // 選填，顯示於縮圖／離線替代畫面（純文字，≤120 字）
  "content": "▶ YouTube 影片：https://youtu.be/dQw4w9WgXcQ（此版本不支援影片）",
  // 共用欄位：fragmentEnabled / fragmentStyle / fragmentIndex / transitionId / TTS 欄位
}
```

- **不儲存原始網址**；iframe `src` 永遠由驗證過的 `videoId` 與數值欄位組出，杜絕注入。
- `content` 是給舊版程式的**降級文字**：舊版會把 widget 改成 LaTeX 並保留 `content`，畫面至少顯示「YouTube 影片＋連結」而非空白公式。新版每次正規化都重新產生此字串，不讓使用者編輯。
- 角度：不支援旋轉（iframe 旋轉後互動座標錯亂），`angle`/`skewX` 正規化為 0。

### 2.1 網址解析（新模組 `public/slide-video.js`，UMD，可在 Node 測試）

`parseYouTubeInput(text) → { videoId, startSeconds, endSeconds, aspect } | { error }`，接受：

| 輸入 | 範例 |
| --- | --- |
| watch | `https://www.youtube.com/watch?v=ID&t=90`、`m.youtube.com`、`music.youtube.com` |
| 短網址 | `https://youtu.be/ID?t=1m30s`、`?si=…`（忽略追蹤參數） |
| Shorts | `https://www.youtube.com/shorts/ID` → `aspect: '9:16'` |
| embed | `youtube.com/embed/ID?start=10&end=40`、`youtube-nocookie.com/embed/ID` |
| live | `youtube.com/live/ID` |
| 純 ID | `dQw4w9WgXcQ` |

- 只接受 `http(s)`；主機白名單：`youtube.com`、`www.`／`m.`／`music.` 子網域、`youtu.be`、`youtube-nocookie.com`、`www.youtube-nocookie.com`。其餘一律回錯誤「請貼上 YouTube 影片網址」。
- 時間：`t`／`start`／`end` 支援 `90`、`90s`、`1m30s`、`1h2m3s`；上限 24 小時。播放清單（`list=`）僅取 `v`，清單播放列為後續項目。
- 同一模組提供 `buildEmbedUrl(widget, { autoplay, origin })`、`posterUrl(videoId)`（`https://i.ytimg.com/vi/<id>/hqdefault.jpg`，所有影片都有此尺寸）、`watchUrl(widget)`。

## 3. 使用者操作與呈現

### 3.1 新增與編輯

- 左側 palette 新增「影片」按鈕（`data-tool="video"`），點擊或拖入後彈出小對話框：網址輸入、即時解析結果（海報預覽／錯誤訊息）、開始／結束時間、自動播放、靜音。確認後以 640×360（Shorts 為 270×480）置中新增。
- 在編輯模式、未在輸入文字時**直接貼上 YouTube 網址**（`slides.js:9090` 的 paste handler）→ 建立影片 widget；非 YouTube 文字維持原本行為。
- 選取影片時側欄顯示影片面板（仿 `latexEditorPanel`）：更換網址、時間、自動播放、靜音、標題、「預覽播放」、「在 YouTube 開啟」。
- 縮放鎖定 `aspect` 比例（沿用既有等比例縮放邏輯）。

### 3.2 各情境呈現

| 情境 | 呈現 |
| --- | --- |
| 編輯模式 | **只顯示海報**（`<img>` 海報＋播放圖示＋標題），不載入 iframe，確保拖曳／選取不被 iframe 吃掉滑鼠事件。側欄「預覽播放」才暫時換成 iframe，取消選取即還原。 |
| 播放／觀賞模式（含分享觀賞連結） | 預設顯示海報 facade；點擊才換成 iframe 並 `autoplay=1`。`autoplay: true` 時在本頁成為目前頁（若為 fragment 則在 fragment 出現時）自動載入。 |
| 自訂總覽縮圖、首頁封面（`deck-thumbnail.js`） | 畫深色矩形＋播放三角形＋標題。可嘗試以 `crossOrigin='anonymous'` 繪製 `i.ytimg.com` 海報；若被 CORS 汙染畫布或載入失敗則退回純圖示（需在 Phase 1 實測，不能讓 `toDataURL` 例外中斷封面）。 |
| Reveal 原生總覽 | `overviewshown` 時暫停並卸載所有影片 iframe，回到海報。 |
| `.asmdeck` 匯出／匯入 | 只是 widget JSON，原樣往返；匯入走同一 `normalizeWidgets`。 |
| 行動裝置觀賞（`mobile-ui`） | 同播放模式；iframe 加 `playsinline=1`。 |

## 4. 播放行為

- **iframe 參數**：`https://www.youtube-nocookie.com/embed/<id>?enablejsapi=1&origin=<location.origin>&rel=0&playsinline=1&start=<s>[&end=<e>][&autoplay=1][&mute=1]`。
- **換頁**：`slidechanged` 時對離開頁的影片 `postMessage({event:'command', func:'pauseVideo'})`；沿用演算法 iframe 的策略，只保留目前頁＋最近一頁的影片 iframe（回到上一頁可接續），其餘改回海報並移除 iframe（確保真正停止、釋放記憶體）。總覽、進入編輯模式、TTS 重播同樣處理。
- **自動播放**：瀏覽器可能擋下有聲自動播放。`allow="autoplay"` 委派加上使用者先前的按鍵互動在 Edge／Chrome 通常可行；若 JS API 3 秒內沒有回報 `playing`，保留 iframe 並顯示提示「點擊播放」。面板上建議 autoplay 搭配靜音。
- **鍵盤焦點不卡在 iframe**：跨來源 iframe 取得焦點後，Reveal 收不到方向鍵。做法：監聽 `window` 的 `blur`，若 `document.activeElement` 是影片 iframe，下一個 tick 把焦點拉回投影片容器（點擊已送達 YouTube，不影響播放／暫停／拖曳進度列）。代價：YouTube 自身鍵盤快捷鍵（空白鍵、方向鍵快轉）無法使用，改以滑鼠操作控制列。播放／暫停快捷鍵可後續另議（須避開 Reveal 已用的 h/j/k/l/n/p/空白鍵）。
- **雷射筆與滾輪切頁**：滑鼠在跨來源 iframe 上時父頁收不到 `mousemove`／`wheel`。海報狀態不受影響；iframe 啟用後，雷射筆開啟期間在 iframe 上覆蓋透明遮罩（暫時不能點 YouTube），雷射筆關閉後移除。滾輪在播放中的影片上不切頁，列為已知限制。
- **與既有動畫的關係**：
  - fragment：影片可設為逐步出現；`autoplay` 依 `fragmentshown` 觸發、`fragmenthidden` 暫停。
  - `transitionId`（Reveal auto-animate）：轉場期間只移動海報，轉場結束（`slidetransitionend`）才載入 iframe，避免 iframe 在 FLIP 中重載。
  - TTS：影片不參與朗讀。JS API 回報影片進入 `playing` 時，若 TTS 正在播放則自動暫停（走既有 TTS 暫停路徑，保留目前段落，使用者可手動續播）；影片暫停或結束時不自動恢復 TTS，避免兩者搶播。

## 5. 安全與穩健性

- **網址驗證**：見 2.1；`normalizeWidgets` 再次驗證 `videoId` 格式與數值範圍，不合法的 video widget 保留資料但呈現「影片資料無效」占位，不建立 iframe。
- **iframe 屬性**：
  - `sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-popups-to-escape-sandbox"`（YouTube 播放器需要 scripts＋same-origin；跨來源下不會取得本站權限；popups 供「在 YouTube 觀看」）。不給 `allow-top-navigation`、`allow-forms`。
  - `allow="autoplay; encrypted-media; picture-in-picture; fullscreen"`、`allowfullscreen`。
  - `referrerpolicy="strict-origin-when-cross-origin"`：YouTube 目前要求嵌入請求帶 Referer，`no-referrer` 會出現「錯誤 153 播放器設定錯誤」。
  - `loading="lazy"`、`title` 使用影片標題（無障礙）。
- **postMessage**：新增獨立 listener，只接受 `event.origin === 'https://www.youtube-nocookie.com'` 且 `event.source` 為已知影片 iframe 的訊息；不動既有 `handleAlgorithmEmbedMessage`（已拒絕非同源）。
- **CSP**：目前沒有 CSP，本功能**不需要**修改。若日後加入 CSP，至少需 `frame-src https://www.youtube-nocookie.com`、`img-src https://i.ytimg.com`；本計畫不順便引入全站 CSP（`slides.html` 有多段 inline script，風險與範圍另案處理）。
- **離線／YouTube 被封鎖**：海報 `onerror` → 本機占位圖（標題＋「影片無法載入」＋連結按鈕）。iframe 啟用後 8 秒內未收到 JS API `onReady` → 覆蓋提示「無法連線到 YouTube」與「在 YouTube 開啟」。JS API `onError` 101／150（上傳者禁止嵌入）、100（影片不存在）→ 顯示對應訊息與外部連結。
- **隱私**：使用 `youtube-nocookie.com`；海報圖向 `i.ytimg.com` 請求（使用者已同意，不另做不連外選項）。
- **已存 deck 相容**：
  - 舊 deck（沒有 video）：`normalizeWidgets` 對既有型別行為不變，以既有 legacy fixture 驗證。
  - 新 deck 在舊版程式：見 Phase 0 前置保護與 `content` 降級文字。若舊版程式在 Phase 0 之前就讀到並存檔，影片會變成顯示連結的 LaTeX 文字（資料遺失、可手動重建），此為**明確列出的不相容情況**。使用者決定 Phase 0 與影片功能一起統一發布，因此發布後仍開著舊版分頁的使用者也可能遇到；發布說明需提醒重新整理頁面。

## 6. 選配後續：上傳 mp4

現況限制：nginx `client_max_body_size 8m`、Express JSON body 上限、`cloud-content.js` 為文字分片（每份資源 ≤128 MB、須 SHA-256 全文驗證）、`.asmdeck` 單一資產 8 MB／封裝 32 MB。影片需要的是二進位上傳、HTTP Range 串流、使用者配額、分享權杖存取控制與備份空間，與現有架構不同。

| 選項 | 成本 | 說明 |
| --- | --- | --- |
| A. 外部 https mp4 網址（`<video>`） | 低 | 使用者自行託管，沿用同一 widget（`provider: 'url'`），僅需 URL 驗證與 `<video>` 控制。 |
| B. 僅本機影片（IndexedDB Blob） | 中 | 檔案存在使用者瀏覽器，deck 只存雜湊；適合在自己電腦上課，分享或換電腦時顯示「影片僅存在原電腦」。 |
| C. 伺服器上傳 | 高 | 新增二進位上傳端點（建議單檔 ≤200 MB、每人總量 ≤1 GB）、獨立磁碟／物件儲存、支援 Range 的串流路由、MIME 與檔頭檢查、刪除 deck 時回收、nginx 與 Docker volume 調整、`.asmdeck` 不內含影片。 |

**建議**：第一版只做 YouTube；mp4 若有需求先做 A（約半天），B 視使用情境再議，C 在有明確多人需求前不值得投入（儲存、頻寬與維運成本遠高於功能本身）。

## 7. 分階段實作

每階段完成後：語法檢查（`node --check`）、`git diff` 檢視、只跑本階段列出的測試；不跑 `npm run regression` 或全部 tests；瀏覽器測試用 Playwright（Edge, `channel: 'msedge'`）＋測試自己啟動的隨機埠隔離 server（同 `tests/table-widget.browser.test.js` 的 `startServer`）。**測試不得連線真正的 YouTube**：以 `page.route` 攔截 `i.ytimg.com`（回本機 PNG）與 `www.youtube-nocookie.com/embed/*`（回一個模擬 JS API 的小 HTML，記錄收到的 `pauseVideo`／`playVideo` 並回報 `onReady`／`onStateChange`）。完成後依 AGENTS.md 重啟自己的預覽服務並更新 `slides.html` 的 `?v=` 版本。

### Phase 0：未知 widget 型別前置保護（與影片功能一起發布）

- 檔案：`public/slides.js`（`normalizeWidgets` 對不認得的 `type` 保留原物件，標記為 inert「不支援的元件」占位；圖層、剪貼簿、刪除可用，不可編輯內容；存檔原樣寫回）、`public/deck-thumbnail.js`（未知型別畫灰色框）、`public/slides.css`。
- 注意：現在「未知型別 → latex」也可能承接了某些沒有 `type` 的極舊資料，只對「有字串 `type` 且不在已知清單」的物件改行為；`type` 缺失仍視為 latex。
- 測試：新增 `tests/unknown-widget-preserve.browser.test.js`：載入含 `type: 'future-widget'`＋自訂欄位的 deck → 顯示占位 → 移動、存檔、重新整理重開 → 欄位完全保留；同時載入缺 `type` 的舊 widget 仍成為 latex。另跑既有 `npm run test:legacy-objects`。

### Phase 1：資料模型、網址解析、編輯模式

- 檔案：新增 `public/slide-video.js`；`public/slides.html`（載入腳本、palette 按鈕、新增對話框、側欄影片面板）；`public/slides.js`（`normalizeWidgets` 的 `video` 分支、`paintWidgetElement`／`syncWidgetElementInPlace` 海報呈現、`addObject('video')`、`showWidgetEditor` 面板、等比例縮放、貼上網址）；`public/slides.css`；`public/deck-thumbnail.js`（`drawVideoWidget`）。
- 測試：
  - `tests/slide-video.test.js`（Node）：上表所有網址格式、時間格式、非白名單主機、`javascript:`、過長／非法 ID、`buildEmbedUrl` 只含白名單參數。
  - `tests/slide-video-widget.browser.test.js`：（1）新建：貼網址新增 → 海報顯示 → 拖曳縮放比例鎖定 → 存檔重開欄位一致；（2）舊 deck（無 video）載入、編輯、存檔、重開不變；（3）明確 `autoplay: false`／`muted: true`／自訂起訖時間重開保留；（4）缺少選填欄位（只有 `videoId`）的 video widget 補齊預設值；（5）undo/redo、複製貼上產生新 id；（6）`.asmdeck` 匯出再匯入往返；（7）封面產生不拋例外（海報被攔截為失敗時退回圖示）。

### Phase 2：播放模式

- 檔案：`public/slides.js`（facade→iframe、`slidechanged`／`overviewshown`／`fragmentshown`／`fragmenthidden`／`slidetransitionend` 掛勾、保留最近兩個 iframe、焦點拉回、雷射筆遮罩、postMessage listener）、`public/slide-video.js`（JS API 指令封裝）、`public/slides.css`、必要時 `public/slide-presentation-controls.js`（雷射筆狀態）。
- 測試：`tests/slide-video-playback.browser.test.js`（模擬 embed 頁）：點擊海報 → iframe src 為 nocookie 且參數正確、sandbox／allow／referrerpolicy 正確；換頁 → 收到 `pauseVideo`，第三頁後最舊 iframe 被移除；autoplay 頁進入即載入、fragment 影片於 fragment 出現時才載入；點擊 iframe 後按 → 仍能換頁；總覽開啟時 iframe 卸載；分享觀賞模式（view-only）可播放。

### Phase 3：錯誤處理與降級

- 檔案：`public/slides.js`、`public/slide-video.js`、`public/slides.css`。
- 內容：海報載入失敗占位、`onReady` 逾時、`onError` 100／101／150 訊息、無效 widget 占位、自動播放被擋提示、行動版 `playsinline`。
- TTS 互斥（Phase 2 一併實作）：測試中先啟動 TTS，再由模擬 embed 頁回報 `playing` → TTS 進入暫停且影片暫停後不自動恢復。
- 測試：在 `slide-video-playback.browser.test.js` 追加：攔截回應中止（模擬離線）→ 顯示替代畫面與外部連結；模擬 `onError 150` → 顯示「不允許嵌入」；無效 `videoId` 不產生 iframe。另手動用 Edge 對真實 YouTube 做一次冒煙確認（不寫入自動測試），並記錄結果。

### Phase 4：文件與版本

- 檔案：使用手冊（`docs/` 下投影片使用說明）、`docs/ai/development-instructions.md` 待辦狀態、`version_log.txt`、本資料夾交付紀錄（實際驗證結果、未完成項目）。
- 測試：無新增；僅確認文件連結。

### Phase 5（選配）：mp4

使用者決定先不做；日後若需要，依第 6 節選項另立計畫。

## 8. 使用者決定（2026-11-12）

1. 自動播放預設關閉，由每部影片各自開啟。
2. 縮圖與海報可向 `i.ytimg.com` 載入封面圖；不做「點擊前完全不連外」選項。
3. Phase 0 不單獨發布到 main；與影片功能一起由使用者統一發布新版本。
4. 影片播放時 TTS 自動暫停。
5. mp4（含外部 mp4 網址）先不做；Phase 5 暫不排入。
