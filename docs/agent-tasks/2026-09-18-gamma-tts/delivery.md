# gamma-tts 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實。
- 分支：codex/2026-09-18-gamma
- 基準：22785acbc19e9e362183d57fdd1f63d36ba12bbb
- 程式修正 commit：ae6b9f6c94c65f996289ad78cd4d101b43b0c09c；側欄修正：73bd180a48b81a1ceadec0ddcf60db9244c4931f
- 驗證版本：上述程式內容；驗證時未提交，後續 commit 未改程式。文件另提交。
- 日期：2026-09-18

## 根因與修改
TTS 按鈕與面板都在觀賞模式隱藏的側欄內。恢復左側控制欄與首頁入口，TTS 使用欄內既有按鈕，沿用同一面板，觀賞時搬到 body 顯示為浮動面板，回 Edit 搬回原側欄；保留既有播放／暫停／續播／停止與語速音量。隱藏觀賞面板的旁白新增與編輯列表，共享唯讀語速音量不回存 deck。

- slides.html：新增按鈕、更新 JS/CSS 快取。
- slides.css：浮動面板、手機寬度與觀賞編輯項目隱藏。
- slides.js：面板搬移、展開狀態、按鈕事件、唯讀設定不回存。
- entrypoints.test.js：維持精確版本斷言，同步快取。
- 使用說明：觀賞頁左側控制欄 TTS 展開；播放按鈕可暫停／續播，停止按鈕結束，滑桿調整語速與音量。關閉面板會停止播放（沿用既有行為）。
- 與 task.md 差異：無；已納入使用者要求恢復左側控制欄與首頁的修正。

## 驗收條件對照
| 條件 | 驗證 | 結果 |
|---|---|---|
| 觀賞按鈕展開／收合 | 隔離 Edge 公開線性篩投影片 | 面板可見性、aria-expanded 通過 |
| 播放、暫停、續播及語速音量 | 替身語音接口確認旁白、1.5x/60% 參數與狀態 | 通過；未驗證裝置實際發聲 |
| 手機版面与無編輯控制 | 390px 邊界、新增按鈕隱藏、截圖檢視 | 通過 |
| Present／Edit 還原側欄 | 全新隔離 context 切換模式 | 通過 |

## 驗證分級與選擇
- 層級：V1。
- 分類：A；沒有現有專用觀賞 TTS 介面測試，以最小局部操作核實。
- 依據：變更 UI 可見性、元件所在位置、唯讀設定回存；未修改語音播放引擎、trace、動畫排程與設定還原。
- 指令（自己 worktree 的 algo-vis-backend）：node --check public/slides.js；git diff --check；node --test tests/entrypoints.test.js；node test-results/viewer-sidebar-check.cjs。
- 結果：語法與差異通過，entrypoints 1/1、skip 0，局部瀏覽器 exit 0。
- 環境：隔離 Edge、臨時服務 43189（測試結束停止自己的服務）、mock 語音／登入接口；全新 context 查一般 Present／Edit，不操作使用者分頁或真實帳號。既有 KaTeX CDN 需允許網路。
- 證據：本 worktree algo-vis-backend/test-results/viewer-sidebar-check.cjs、viewer-tts-mobile.png；本機、不提交，移除 worktree 後不保證留存。
- 初次補驗的 fixture 問題：故意放入無效 sentinel 草稿，加上沿用手機頁面導致一般模式按鈕不可見；改用全新桌面 context，最終原局部斷言全部通過。
- 未執行：演算法驗證集、完整回歸，依使用者分級通知；共享觀賞沿用同一樣式，未另操作真實共享帳號。裝置實際發聲未驗證。
- 需要主代理 V3：無。

## 剩餘事項與合併注意
- 與其他代理共享 slides.js、slides.css、slides.html；需保留雙方修改並同步快取斷言。
- 編輯模式語速／音量仍沿用原儲存行為，訪客唯讀設定為當次記憶體設定。

## 主代理核實與整合
- 狀態：尚未核實。
- 核實 commit、diff、重跑／合併結果：待主代理填寫。
- 大規模驗證：未執行，不宣稱完整回歸通過。
- 本機服務：gamma 未重啟主要服務，依協作分工交主代理。
- Push：依使用者授權，交付程式及文件推送 gamma 分支。
- 公開部署：未部署。

## 側欄修正補驗（2026-09-18）
- 版本：73bd180a48b81a1ceadec0ddcf60db9244c4931f，測試時為相同未提交程式内容，commit 未再改程式。
- V1／A；改動控制欄與首頁可見性、TTS 開關位置、浮動面板定位及手機 CSS。未變更 TTS 引擎或動畫。
- 原因：共享觀賞曾隱藏整個控制欄與首頁；右上新增按鈕沒有恢復導覽。
- 變更：觀賞控制欄保留首頁、TTS、縮放；隱藏模式切換與匯入／匯出／分享等編輯入口。手機移除觀賞底部編輯 dock，使用左側控制欄。
- 檔案：mobile-ui.css 補觀賞手機側欄；其餘 slides HTML/CSS/JS 與版本測試同步。
- 語法與差異：通過；entrypoints 單檔 1/1、skip 0。
- 最小隔離瀏覽器：node test-results/viewer-sidebar-check.cjs，exit 0；TTS 展開／收合、播放／暫停／續播及語速音量（語音替身）、手機邊界、控制欄可見、首頁實際點擊返回圖庫、Present／Edit 還原元件均通過。
- 裝置實際發聲、真實分享 token、公開部署未驗證。不跑演算法集或 V3。
- 程式與交付文件依授權 push 到 origin/codex/2026-09-18-gamma，待主代理核實合併。
