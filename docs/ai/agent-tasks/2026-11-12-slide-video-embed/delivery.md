# 投影片嵌入 YouTube 影片：交付紀錄

- 日期：2026-11-13
- 分支：`claude/2026-11-12-slide-video-embed`（基準 `intergration` 9323d45）
- 範圍：計畫 Phase 0–4（未知元件保護、資料模型與編輯、播放、錯誤處理、文件）。Phase 5（mp4）依使用者決定不做。
- 驗證分級：V1（非動畫的投影片元件、編輯、儲存／匯出）。未啟動演算法驗證集。

## 修改

| 檔案 | 內容 |
| --- | --- |
| `algo-vis-backend/public/slide-video.js`（新） | 網址解析、時間格式、欄位正規化、嵌入／海報／外部連結網址；UMD，可在 Node 測試 |
| `algo-vis-backend/public/slides.js` | `normalizeWidgets` 的 `video` 分支與未知型別保留；海報 facade、播放器控制、換頁／總覽／fragment／編輯模式同步、TTS 暫停、焦點返回、錯誤替代畫面、插入對話框、側欄面板、貼上網址 |
| `algo-vis-backend/public/slides.html` | 工具列 Video 按鈕、影片面板、插入對話框、載入 `slide-video.js`、版本參數 |
| `algo-vis-backend/public/slides.css` | 影片、占位框、面板與對話框樣式；編輯模式與雷射筆模式的 iframe 指標事件 |
| `algo-vis-backend/public/deck-thumbnail.js`、`index.html` | 縮圖／封面畫影片海報（CORS 模式，失敗退回圖示）與未知元件占位框 |
| `algo-vis-backend/tests/slide-video.test.js`（新） | 解析、拒絕、時間、正規化、嵌入網址、貼上判斷 |
| `algo-vis-backend/tests/slide-video-widget.browser.test.js`（新） | 編輯／存檔重開／舊資料／未知元件／.asmdeck 往返；播放／暫停／自動播放 fragment／焦點／TTS／錯誤 |
| `docs/guides/slide-video.md`（新） | 使用說明 |

後端、nginx、CSP 均未修改（伺服器不驗證 deck 內容，目前也沒有 CSP）。

## 與計畫的差異

- **不鎖定比例、允許旋轉**：沿用所有 widget 共用的縮放／旋轉控制，播放器會在框內自動加黑邊；避免為影片另寫一套縮放邏輯。插入 Shorts 時仍預設直式尺寸。
- **自動播放被擋的提示**：未另做。被擋時播放器已載入，YouTube 自己會顯示播放鈕，再加提示是重複資訊。
- **auto-animate 期間延後載入 iframe**：未做。Reveal 的 `data-id` 轉場只對目的元素做 FLIP，不複製節點，iframe 不會在轉場中重載。
- **播放器只保留 1 個離開頁的播放器**（與計畫「目前頁＋最近一頁」相同）。

## 相容性（必驗四項）

1. 新建：工具列對話框與貼上網址兩種入口，欄位與 Shorts 尺寸正確。
2. 舊物件缺欄位：只有 `videoId` 的 video widget 補齊預設（`autoplay:false`、`muted:false`、`startSeconds:0`、`endSeconds:null`）。
3. 既有自訂值／明確關閉：`muted:true`、`autoplay:false`、`startSeconds:65` 經面板編輯、存檔、重新整理後保留；`endSeconds:0` 視為未設定。
4. 往返：IndexedDB 存檔重開、`.asmdeck` 匯出後再匯入，影片欄位與未知元件欄位（含巢狀物件）完全保留；沒有 `type` 的極舊 widget 仍為 LaTeX。

不相容情況（已在計畫第 5 節列出、使用者已知）：本功能發布前的程式讀到影片會顯示為連結文字，若在舊版存檔則遺失影片設定。

## 驗證結果

- `node --check`：`slides.js`、`slide-video.js`、`deck-thumbnail.js` 通過。
- `node --test tests/slide-video.test.js tests/slide-video-widget.browser.test.js`：8/8 通過（Edge headless，隨機埠隔離 server，YouTube 請求全部由 `page.route` 攔截）。
- `npm run test:legacy-objects`：5 項中 4 項通過；`table widget edits cells…` 在右鍵選單 `matrix-row-after` 逾時。**同一測試在乾淨的 `intergration`（9323d45）上同樣失敗**，為既有問題，與本次修改無關，未修正。
- `widget-fabric-layer-visibility.browser.test.js`、`asmdeck-cover.test.js`：全部通過。
- 真實 YouTube 冒煙（3103 預覽服務、內建瀏覽器）：`M7lc1UVf-VE` 握手完成並回報播放中；`dQw4w9WgXcQ` 回報錯誤 150（該影片限制嵌入），正確顯示替代畫面與外部連結。

## 請主代理整合時注意

- `slides.html` 的 `slides.js?v=slides-358`、`slides.css?v=video-embed-1`、`deck-thumbnail.js?v=5` 若與其他分支衝突，取較新的版本號重新編號即可。
- 發布說明需提醒使用者重新整理開著的舊頁面（見相容性段落）。
