# 2026-09-22-gamma-inline-scripts 交付驗證紀錄

## 交付資訊
- 狀態：待主代理核實
- 分支：codex/2026-09-22-gamma
- 共同基準 commit：3706489c0a82b06eb0235d81057790a9578a45a0
- 程式修正 commit：ada3eca894ac89365b90ea6c52d604577697b61c
- 驗證時的 HEAD 與未提交修改：HEAD `ada3eca894ac89365b90ea6c52d604577697b61c`；只有本交付文件尚未提交。
- 驗證日期：2026-09-22

## 根因與修改
- 已確認根因與證據：普通文字使用 Fabric Textbox，原先不解析 `_`／`^`；專用 KaTeX 元件是另一類 widget，無法直接保留一般文字的選取、編輯與歷史操作。
- 修正方式與行為變化：加入輕量字元樣式解析器。新文字預設開啟，舊文字預設不變，可按工具列 `A₂` 切換。`A_2`、`A^2`、`x_i^2`、`x_{i+1}` 與 `A^{n+1}` 會縮小並位移腳本字元，語法標記在顯示時隱藏；進入編輯後顯示原碼。`\_`、`\^` 保留字面符號。根號未加入。
- 修改檔案及用途：`public/slide-inline-scripts.js` 解析與產生 Fabric 字元樣式；`public/slides.js` 接入新建、編輯、undo/redo、序列化、載入與工具列開關；`public/slides.html`、`slides.css` 加入入口與資產版本；兩個新專項測試及 `entrypoints.test.js` 覆蓋語法與實際操作。
- README／版本紀錄／使用說明更新：工具列按鈕有操作名稱與開關狀態；此次不另改 README。
- 與 task.md 的差異：無。

## 驗收條件對照
| task.md 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 新文字顯示上／下標、組合與群組 | 解析器單元測試、隔離 Edge 匯入與畫面檢查，新增文字按鈕操作 | 對應字元有 0.6 倍字級與正確基線位移，畫面呈現上下標；新文字旗標預設為 true | 通過 |
| 編輯顯示原碼，離開恢復排版；跳脫保留字面 | 隔離 Edge 進出 Fabric 編輯、鍵盤輸入，解析器跳脫測試 | 編輯時 `A_2 x^{n+1}` 原碼可見，離開後樣式恢復；跳脫不解析 | 通過 |
| 舊文字預設不變，工具列可切換 | 隔離 Edge 匯入含既有紅色粗體字元的舊物件並切換兩次 | 啟用後出現下標，關閉後回復原字元樣式及未解析文字 | 通過 |
| 儲存、縮圖、匯出與 undo/redo 不丟失內容 | 編輯中 undo/redo、下載 asmdeck 再匯入、產生並目視縮圖、執行既有文字 undo 測試 | 原始語法、基線位移與舊字元樣式保留；縮圖顯示上下標 | 通過 |

## 小驗證與重跑方式
### 上下標語法與文字互動
- 目的與對應條件：驗證解析、輸入與歷史操作、匯出再載入，以及舊文字相容性。
- 執行目錄與必要環境設定：`algo-vis-backend`；瀏覽器測試自建隨機埠與獨立 Edge context。
- 測試資料／fixture：測試內建立只含兩個虛構文字物件的本地 deck；不碰使用者投影片。
- 完整指令或操作步驟：`node --test tests/slide-inline-scripts.test.js tests/inline-scripts.browser.test.js tests/entrypoints.test.js tests/slides-text-undo.browser.test.js`
- 預期結果：相關 5 個測試通過。
- 實際結果與 exit code：5 passed、0 failed，exit code 0。測試期間發現編輯中 undo/redo 樣式重複位移，已修正並重跑通過。
- 證據位置：測試檔與終端摘要；本機忽略的 `algo-vis-backend/test-results/inline-scripts.png`、`inline-scripts-thumbnail.jpg` 僅供本機目視，未提交且不保證跨工作目錄保留。

### 靜態與開發預覽
- 目的與對應條件：確認語法、差異和服務入口載入新版腳本。
- 執行目錄與必要環境設定：本 worktree；gamma 3104 預覽。
- 測試資料／fixture：無。
- 完整指令或操作步驟：`node --check public/slides.js`、`node --check public/slide-inline-scripts.js`、`git diff --check`；只重啟核對過的 3104 程序並請求 `/slides.html`。
- 預期結果：檢查成功，HTTP 200，腳本與樣式版本更新。
- 實際結果與 exit code：檢查 exit code 0；3104 從 PID 13392 重啟為 PID 50304，HTTP 200，入口含 `inline-scripts-202`、`slide-inline-scripts.js?v=1` 和 `inline-scripts-106`。
- 證據位置：終端摘要；本機服務 log 在系統 Temp，未提交。

## 剩餘事項與合併注意
- 未驗證項目及原因：未執行完整 regression，符合 V1 投影片文字修改分級及使用者先前不做大規模驗證的指示。
- 已知問題或風險：僅支援簡易上標／下標；TTS 對 `_`、`^` 的唸法尚未另行調整。
- 相依與衝突注意：`slides.html` 載入 `slide-inline-scripts.js` 必須早於 `slides.js`；若整合分支資產版本更新，須同步入口測試。
- 主代理需補驗證的情境：在整合預覽中建立新文字、輸入 `A_2` 和 `A^{n+1}`，確認編輯、縮圖及觀賞模式呈現一致。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：
- 差異審查與必要重跑結果：
- 合併 commit：
- 完整 regression：
- 演算法投影片實際驗證：
- 未完成或環境阻塞：
- 本機服務重啟：
- Push／公開部署狀態：
