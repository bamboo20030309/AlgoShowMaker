# gamma-folders：工作區範例入口與分類資料夾

## 任務資訊
- 負責代理：gamma；狀態：待交付
- 共同基準：cb3a65df8010da7b606a737b9ad4c65b46d1b002
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
登入工作區缺少範例入口；原分類按鈕是篩選。使用者希望工作區能導向公開範例頁，省略登入區塊，分類依列表區塊排列，上方分類直接捲動至該區塊。

## 需求確認
- 無待答問題；沿用現有公開清單與縮圖。
- 採用 /?examples=1 作共用範例頁，保留登入 session；首頁原登入流程與私有工作區仍可開啟。
- 八個分类使用原 algorithm_sample 鍵，details/summary 預設展開且可收合。
- 搜尋有文字時只顯示符合的區塊；點分類會清除搜尋並展開／捲到分類。

## 修改範圍與依賴
index.html、home.css、home.js、guest-gallery.js，以及 entrypoints 快取版本。無跨代理依賴或動畫修改。

## 驗收條件
- [x] 登入工作區有範例入口，手機也可直接點選。
- [x] 範例頁不顯示登入區，保留登入 token，返回工作區仍登入。
- [x] 預設八個分類依序展開，可收合；點分類展開並捲到分類，而非篩掉其他分類。
- [x] 縮圖、搜尋、空分類與手機寬度正常。

## 驗證計畫
V1／A；語法、diff、entrypoints 單檔、隔離 Edge 的局部操作與截圖，mock 登入 API。不跑演算法驗證集或 V3。

## 變更紀錄
- 2026-09-18：初始定義，沿用已 push 的 gamma 分支。
