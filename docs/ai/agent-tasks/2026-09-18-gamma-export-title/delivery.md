# gamma-export-title 交付驗證紀錄

## 交付資訊

主代理更新：已合併本機 main，本次 V1 整合核實通過。合併 commit、重跑結果、服務與限制見 [Gamma 後續整合紀錄](../2026-09-18-gamma-followup-integration.md)。下方保留原子代理交付時的狀態。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：d0031f3c0d77924e45b5a7773aae4d758334b86e
- 程式修正 commit：9371a02ab665d032f21ebb9212c07c3642baa415
- 驗證版本：9371a02 程式內容，提交前執行；後續只有文件更新。
- 驗證日期：2026-09-18

## 根因與修改
- 原本 exportDeckJson 把 anchor.download 寫死為產品名稱加日期。
- 改用既有 cloudDeckTitle，中文及內部空格保留，附 .asmdeck。
- 禁用字元替換底線，移除結尾點與空格，Windows 保留名稱加前綴底線，空白名稱使用未命名投影片。
- slides.js：匯出檔名；slides.html 與 entrypoints.test.js：快取版本；export-filename.browser.test.js：下載檔名驗證。
- README／版本紀錄：不適用，既有匯出功能的命名調整。
- 與 task.md 的差異：無。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 中英文標題命名 | 下載事件 suggestedFilename | 線性篩教學.asmdeck、My algorithm.asmdeck | 通過 |
| 空白與禁用檔名處理 | 同上，7 組輸入 | 空字串與空白使用預設；禁用字元替換；CON 加底線；移除結尾點 | 通過 |

## 驗證分級與選擇
- V1/A，僅修改下載命名，不影響 archive 內容、演算法或動畫。
- 依使用者指示不執行大規模回歸或演算法範例驗證。

## 小驗證與重跑方式
- 執行目錄：此 worktree 的 algo-vis-backend。
- 完整指令：node --test tests/export-filename.browser.test.js tests/entrypoints.test.js
- Fixture：空白投影片、mock 雲端標題，獨立隨機埠服務與 Edge context。
- 環境：dependencies、Edge、可存取既有 Reveal CDN。
- 預期與實際結果：7 組下載檔名皆符合預期；2/2 測試通過、0 skip、exit 0。
- node --check public/slides.js：exit 0。
- git diff --check：exit 0。
- 證據：可提交瀏覽器測試檔與此摘要；不提交暫存輸出或服務 log。

## 剩餘事項與合併注意
- 未驗證：真實遠端資料庫、OS 儲存對話框；瀏覽器建議下載名稱已實際驗證。
- 已知問題：無。
- 相依與衝突：slides.js 與 slides.html 快取版本為共用檔，主代理核对。
- 主代理需補：整合後工作區匯出與完整回歸。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式 commit 與 diff 範圍：待填
- 差異審查與必要重跑結果：待填
- 合併 commit：待填
- 完整 regression：未執行，由主代理負責
- 演算法投影片實際驗證：未執行，由主代理負責
- 未完成或環境阻塞：無開發阻塞
- 本機服務重啟：未執行，由主代理負責
- Push／公開部署狀態：gamma 分支依使用者授權 push；公開部署未執行
