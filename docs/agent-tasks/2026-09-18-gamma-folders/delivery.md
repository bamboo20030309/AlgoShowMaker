# gamma-folders 交付驗證紀錄

## 交付資訊

主代理更新：已合併本機 main，本次 V1 整合核實通過。合併 commit、重跑結果、服務與限制見 [Gamma 後續整合紀錄](../2026-09-18-gamma-followup-integration.md)。下方保留原子代理交付時的狀態。
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準：cb3a65df8010da7b606a737b9ad4c65b46d1b002
- 程式修正 commit：f34ce242d7aa5ebef11e541b37cb38613f7099e9
- 驗證版本：同一程式內容，驗證後僅調整縮圖卡片程式縮排；語法與差異再次通過，無其他程式修改。
- 日期：2026-09-18

## 修改與設計依據
- 工作區側欄與主要新增投影片旁各有「範例投影片」連結；主要區入口手機也可見。
- /?examples=1 顯示公開圖庫並隱藏登入區，不清除 JWT 或載入私有 deck；返回 / 仍依原登入流程進入工作區。
- 圖庫八個分類改用 details/summary，依序排列、預設展開且可收合，保留真實縮圖、案例連結、數量與空狀態。
- 上方分類列黏附在網站標頭下，點選分類展開／scrollIntoView；尊重 reduced-motion。搜尋時篩選符合的區塊，點分類會清除搜尋。
- 檔案：index.html（兩個入口、圖庫結構與快取）；home.js（共用範例模式）；home.css（資料夾、sticky 分類、獨立圖庫布局與手機）；guest-gallery.js（區塊呈現與捲動）；entrypoints（精確版本同步）。
- 使用說明：工作區點「範例投影片」；上方選分類跳到區塊，點區塊標題收合，點縮圖觀賞；「返回投影片工作區」回原工作區。
- 與 task.md 差異：無。

## 驗收對照
| 條件 | 局部操作 | 結果 |
|---|---|---|
| 工作區入口 | mock 登入後實際點入口 | 到 /?examples=1，通過 |
| 範例不顯示登入、保留 session | 查看 auth-panel、JWT，點返回連結 | 表單隱藏、token 不變、返回 dashboard，通過 |
| 區塊列表與分類捲動 | 檢查八個 details 展開，收合數學後點上方數學 | 展開及 scrollY 增加，八類仍保留，通過 |
| 搜尋與手機 | 搜線性篩、點排序清搜尋；390px 宽度 | 一類→八類、無水平溢出，通過 |

## 驗證分級與選擇
- 層級：V1；分類 A。
- 依據：非動畫首頁導覽、列表與搜尋展示，不更動 trace、播放或設定還原。
- 執行目錄：自己的 worktree/algo-vis-backend。
- 指令：node --check public/guest-gallery.js；node --check public/home.js；git diff --check；node --test tests/entrypoints.test.js；node test-results/folder-gallery-check.cjs。
- 結果：語法與 diff 通過，entrypoints 1/1、skip 0，隔離瀏覽器 exit 0，無 JS 頁面錯誤。
- 環境：Edge headless、自己的臨時服務 43191、mock login/me/slides API；不操作真實帳號、使用者分頁或私人投影片。服務與瀏覽器測試結束已停止。
- 本機證據：algo-vis-backend/test-results/folder-gallery-check.cjs、folder-gallery-desktop.png、folder-gallery-mobile.png；不提交，刪 worktree 後不保證留存。
- 未執行：演算法驗證集、大回歸、真實資料庫登入，範圍依使用者驗證分級通知。
- 需要主代理 V3：無。

## 主代理核實與整合
- 狀態：尚未核實；待補差異審查、合併 commit 與局部重跑結果。
- 注意：index.html、home.js、home.css 與其他代理首頁變更可能重疊，保留雙方行為與新快取版本。
- 主要服務：未重啟，交主代理。
- Push：依授權推送 origin/codex/2026-09-18-gamma，包含程式與本紀錄。
- 公開部署：未部署。不宣稱完整回歸通過。
