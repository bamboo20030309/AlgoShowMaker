# 交付紀錄：2026-11-13-canvas-toolbar

## 修改內容
- `public/algorithm.html`：`prevBtn`／`nextBtn` 拿掉「上一步／下一步」文字，加 `aria-label`；`prevKeyFrameBtn`／`nextKeyFrameBtn` 拿掉文字、預設 `hidden`、title 改為「上一大步／下一大步」。版本：`style.css?v=canvas-toolbar-1`、`slides-embed.css?v=canvas-toolbar-4`、`front.js?v=frame-endpoints-65`、`slides-embed.js?v=trace-17`。
- `public/front.js`：`syncCurrentFrameFromCodeScript()` 依動畫類型決定大步按鈕：只有舊版腳本（`CodeScript` 存在且非 `isTracePlayer`）且不在投影片嵌入時顯示。
- `public/style.css`：`.controls button[hidden] { display: none; }`（原本 `display:flex` 會蓋過 `hidden`）。
- `public/slide-presentation-controls.js`（v=9）：同步時替每個動畫 iframe 的 `<html>` 切換 `asm-slide-editing`（父頁 `asm-edit-mode`）。
- 放映右鍵選單（使用者 2026-11-13 追加）：改成橫排兩個圖示按鈕——一般游標（箭頭）與雷射筆游標（與放映時雷射筆游標 `--asm-slide-laser-cursor` 同一個 SVG）。名稱放在 `aria-label`，提示文字只在滑鼠停留，或用方向鍵移動後才顯示（開選單時預設按鈕取得焦點不會顯示）；目前模式以底色與外框標示，取代原本的「✓」。選單項目名稱「簡報模式」改為「雷射筆游標」。`slide-presentation-controls.css?v=6`；雷射筆圖示放大為 30px（箭頭 20px）。
  - 測試：`presentation-mode-selection`、`slide-presentation-controls`、`canvas-mouse-shortcuts` 改用新名稱；`presentation-mode-selection` 加驗只有圖示、停留前不顯示提示、停留後顯示「雷射筆游標」。
- `public/slides-embed.css`：投影片中一律隱藏大步按鈕；非編輯時與編輯畫面相同，只隱藏 RUN 與錯誤列（使用者 2026-11-13 要求；先前「只留播放鍵與進度條」的版本已撤回）；RUN 按鈕、紅點亮時的強調、錯誤列樣式。
- `public/slides-embed.js`：runtime 模式在控制列最前面加 `#slideRunBtn`，畫布上方加 `#slideRunError`（訊息＋「開啟編輯器」＋關閉）。按 RUN 送 `asm-runtime-run` 給父頁；收到 `asm-runtime-run-state`（running／done／error）更新按鈕與錯誤列。舊版腳本動畫不顯示 RUN；套用新動畫時收起錯誤列。
- `public/slides.js`（slides-360，iframe `trace-runtime-115`）：
  - 把過期自動重建的內容抽成 `rebuildSlideAnimation(animation)`，自動更新與 RUN 共用（行為不變：成功才換結果並存檔，公開範例 `saveDeck` 本來就不寫入）。
  - 新增 `runSlideAnimation(frame, slide)`：同一張投影片同時只跑一次；成功後重新送動畫到 iframe（回到第 0 幀），失敗回傳錯誤訊息、不動原動畫。
  - `handleAlgorithmEmbedMessage` 處理 `asm-runtime-run`、`asm-runtime-open-editor`，只在編輯畫面接受。
- 測試：新增 `tests/slide-canvas-toolbar.browser.test.js`（程式碼頁圖示與大步按鈕顯示規則；投影片編輯工具列，以及放映＝編輯工具列去掉 RUN；RUN 成功會實際編譯一次並回到第 0 幀；RUN 失敗保留同一份動畫、顯示錯誤、放映時錯誤列隱藏、「開啟編輯器」開啟動畫編輯器）。`entrypoints.test.js` 更新 `style.css` 版本。

## 驗證
- `slide-canvas-toolbar.browser.test.js` 通過（實際編譯）。
- `slides-embed-tabs`、`slide-presentation-controls`、`mobile-ui` 通過。
- 既有失敗（已在未修改的 intergration `9323d45` 以暫時 worktree 重跑確認相同）：
  - `missing-slide-trace.browser.test.js`：仍計數舊的 `/compile` 路徑（現為 `/api/compile/jobs`）；改路徑後在 intergration 也是重新開啟時多編譯一次（2 ≠ 1）。
  - `algorithm-default-sieve.browser.test.js`：intergration 同樣 1 過 3 失敗。
- `playback-navigation.browser.test.js` 需要 `ASM_TEST_BASE_URL` 指向 beta 服務，此環境未跑。
- 3104 預覽：快速排序範例的動畫頁，放映與編輯工具列相同、只少 RUN；編輯畫面 RUN 在最前。未在使用者瀏覽器按 RUN。

## 剩餘事項與合併注意
- 與報告不同之處：工具列仍是嵌入頁的控制列，以 CSS 依模式收起（報告建議由投影片頁自繪）；編輯畫面工具列一直顯示，未做「滑鼠移入或選取時浮現」。
- 雲端投影片的 RUN 成功會上傳新結果並存檔（沿用自動重建流程），此次只以公開範例驗證，未對真實雲端投影片按 RUN。
- 合併：在 intergration worktree 執行 `git cherry-pick 9323d45..claude/2026-11-13-canvas-toolbar`。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
