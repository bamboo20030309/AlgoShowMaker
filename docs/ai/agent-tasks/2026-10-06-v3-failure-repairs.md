# V3 失敗修復與增量核實

## 範圍與基準

依使用者要求：先重驗選擇排序大型案例，再修插入排序顏色及雲端儲存，清理過期測試與 mock，最後修正仍能重現的產品問題。

基準為 intergration `0ff4b375457ca5e05259043f00304d5fee99060c`。Windows、headless Edge、隔離伺服器與全新瀏覽器 context；不操作使用者頁面、私人投影片或正式資料庫。main／README 的穩定版本仍為 v4.11。

## 產品修正

- 插入排序：新建值格第一次加入 DOM 時尚無 CSS 前態，與既有索引格的顏色進度不同；首次呈現保留相同起始色，下一個 tick 再更新。保留既有 180ms 色彩轉換。
- 純量賦值：實際轉移包含 160ms 前置框階段，提交與值／樣式排程一致；宣告初始化仍使用自己的 500ms 值轉移。
- 明確停用 push_back：新格與索引直接呈現，不被通用物件入場再做淡入。固定規則 T19 驗證插入 27 後進行 i++ 時值與透明度一致。
- 預設線篩：外部 Trace 先載入時永久取消該次預設載入，避免 DOMContentLoaded 稍後重啟背景載入而覆蓋文件。
- 遞迴 LCS：同一 authored arrow ID 在不同遞迴祖先具有不同 activation，不能只按 ID 去重；儲存／重開保留祖先路徑、自訂色與明確關閉。
- 事件設定：visual-enter 與 declare 共用開關，載入時迁移舊別名；明確 canonical 設定優先。
- 手動鏡頭：切換輸入／輸出等分頁後，延後的 ResizeObserver 不覆蓋手動鏡頭；正常幀導覽恢復作者鏡頭規則。
- 具名幀：`// heap: @frame value` 單獨存在時也啟用插樁；branch 的幀偵測使用同一語法範圍。執行檔快取指紋已包含 trace-instrumenter.js，會自動失效舊編譯產物。
- 格子工具列：單擊換格後顯示該格的 style 列；工具列放在整個 grid 上方，避免下排工具列遮擋上排格子。

## 測試與 mock 修正的依據

- 雲端 fixture 原本沒有在伺服器保存舊 inline Trace，前端自然拒絕不完整素材；補上既有服務端記錄，核對迁移後小型請求與精確重開。這不等於新增大型 Trace 分塊上傳測試。
- 標準 API 讀取含 `?traceMode=lazy`；只更新讀取 mock 的匹配方式，保留真正的 mutation 路徑。
- 舊八皇后草稿有過期引擎來源指紋；驗證可攜原始 Trace、拒絕未重建匯出，以及實際匯入重建／匯出／重開。已公開的新版教材另核對，不再要求它不能出現在範例區。
- 合併排序新增頁面造成固定幀號失效，按事件、區間與資料選取目標。單一轉移交接使用固定的小型 fixture，不隨教材改寫變動。
- CRLF 移除指令的 regex 會留下單獨 CR，讓 C++ line comment 吞入後續語句；先正規化換行，保留原測試意圖。
- 遞迴成長測試先用不變的父節點消除同步鏡頭縮放，再核對原 0.72 結構縮放範圍；沒有放寬範圍。
- 位元像素測試原先兩幀底色不同；固定不透明底色、驗證底色一致，仍要求實際像素 RGBA 完全相等。
- 游標方法在物件加入時被 instance wrapper 接管；改觀察實際 instance，保留二元透明度與 blink 間隔判定。
- Studio 測試透過正式 Editor 載入、等待工作完成並明確開啟；RUN 等待來源指紋一致，不能把背景線篩當作測試結果。
- 提交時序判定器：同一個值在前一筆寫入提交容許區間時，不讓後一筆寫入重新填回舊值。保留原 40ms 區間，新增独立時間點與錯值反例。

## 本機報告

原始失敗不覆寫。`algo-vis-backend/test-results/` 不提交 Git。

- `final-repair.json`：最後原失敗／新增／相關案例的逐檔結果。
- `final-repair-*.tap`：逐檔原始輸出；`final-repair-progress.txt` 為進度。
- `animation/*/summary.json`：大型動畫、實際取樣與首個違規時間點。
- `guest-animations-reload.json`：正式教材各動畫 iframe 實際重載與免編譯檢查。

最後小測試續跑 41／41 個檔案、94 個具名案例通過，零失敗；來源內容、編譯器與瀏覽器環境指紋另存 `v3-repair-evidence.json`。

最後大型核實 7／7 通過：selection、insertion-style-labels、quick-style-swap、style-frame-completion、merge-recursive、merge-bottom-up、lcs-matrix；雲端儲存前置契約亦通過。報告為 `animation/2026-10-05T21-56-52-832Z-76a6c3e2/summary.json`，單一 runtime 環境、單工作者。選擇排序 980、插入樣式 232、遞迴 Merge Sort 959 次實際取樣；沒有放寬判定容許值。

72 個修改／新增 JavaScript 檔通過語法檢查，差異檢查通過。最終正式教材重載 15 套、36／36 個動畫通過：實際重載 iframe，核對幀數、來源與輸入指紋、SVG 內容，零編譯請求、零頁面錯誤。原始 V3 的其他通過紀錄與完整依賴失效項目未機械式全跑，Linux 資源驗收本輪未執行；不得將這輪增量核實當作完整 V3／Linux 發布驗收。

## 預覽

3100 已從整合 worktree 重啟，PID 52936；algorithm.html 與 slides.html HTTP 200，tween trace-299、renderer trace-267、player trace-28、slides-266。未停止 main 3000 或其他代理服務。正式部署與 main 合併不在本輪動作內。
