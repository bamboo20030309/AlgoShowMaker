# 公式載入與投影片選取整合核實

## 整合範圍

- 基準：`a0e6450527f65182642fdabeab84929d114dac55`
- 來源：Gamma `fe937ab`
- 合併提交：`21a244d`
- 目標：`intergration`；本次不合併 `main`，也不建立 release。

## 實際變更

1. 範例投影片在初始化前即進入觀賞模式，首次插入公式立即排版；KaTeX 0.16.22 與字型改為本機資產，避免 CDN 失敗。
2. Heap、Segment Tree、BIT 編輯使用正確的零基索引；線性結構可調長度，新增格與新建結構預設為 `0`。
3. 拖曳框選納入 LaTeX、Code 與 Structure DOM 元件，並保留與 Fabric 物件混合選取。
4. 拖曳框與結構格選取框移至獨立頂層；點擊空白會清除 widget、Fabric 與格子選取。
5. 空的 structure 樣式工具列遵守 `hidden`，不再留下深色小方塊。

`slides.js` 的共同快取版本衝突統一為 `parallel-merge-196`，並同步入口測試。

## 主代理驗證

- 分級：V1，分類 A／B；沒有動畫、trace、runtime 或播放資料流變更。
- 靜態檢查：6 個 JavaScript 檔均通過 `node --check`；相對基準的 `git diff --check` 通過。
- 專項驗證：7/7 通過、0 失敗、0 skip，包括入口依賴、LaTeX 即時刷新、範例首次公式、文字 undo、Structure 註標、結構長度／索引、widget 框選與選取圖層。
- 未執行演算法驗證集與完整 regression：本次為非動畫投影片編輯修改，依驗證分級不啟動。
- 測試檔索引更新為 90 個 `.test.js`，新增三個專項已列入 B 類。

## 服務與推送

- 3100 整合服務：已從本 worktree 重啟為 PID 52932；六項靜態資源均為 HTTP 200 且 SHA-256 與磁碟檔案一致，`parallel-merge-196` 已生效。
- 其他預覽：3000、3101、3102、3103 均維持 HTTP 200，未停止或重啟。
- 推送：依既有授權推送 `origin/intergration`；未合併 `main`、未建立 release、未部署公開主機。
