# gamma-tts：觀賞模式 TTS 控制

## 任務資訊
- 負責代理：gamma；狀態：待交付
- 共同基準：22785acbc19e9e362183d57fdd1f63d36ba12bbb（沿用已 push 的 gamma 分支，未同步其他代理修改）
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
觀賞模式的編輯側欄被隱藏，TTS 開關及面板也一起不可見。使用者希望小按鈕展開播放／暫停、語速、音量等控制。

## 需求確認與修改邊界
- 必要問題：無。沿用現有 TTS 引擎、控制與元件，包含公開案例、共享觀賞與一般 Present 模式。
- 修改：slides.html、slides.css、slides.js，以及 entrypoints.test.js 的精確快取版本。
- 不修改動畫資料或排程，不允許訪客編輯旁白。共享觀賞的語速／音量只保留當次記憶體設定，不回存 deck。
- 依賴：無。未修改其他代理工作目錄。

## 驗收條件
- [x] 觀賞頁右上小按鈕可展開／收合 TTS 控制。
- [x] 沿用既有播放、暫停、續播、停止，傳遞所選語速與音量。
- [x] 手機面板不超出畫面，隱藏旁白新增與編輯項目。
- [x] Present／Edit 切換可還原原有側欄元件。

## 驗證計畫
- V1；分類 A。修改面板可見性與輸入設定回存控制，未更動播放引擎、trace 或動畫還原。
- 語法、差異檢查，entrypoints 單檔測試，隔離 Edge 局部操作，語音引擎替身確認傳參及狀態。
- 不執行演算法驗證集或 V3，依使用者最新分級通知。

## 變更紀錄
- 2026-09-18：初始需求；沿用現有元件並補上局部驗證。
