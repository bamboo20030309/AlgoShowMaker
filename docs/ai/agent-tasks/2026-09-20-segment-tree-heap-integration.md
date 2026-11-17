# Segment Tree 與 Heap 動畫整合核實

## 整合範圍

- 起點：`61a4baade9b06b5e50d0c7a24683e937db9c7112`
- Alpha：`138e320`，合併提交 `a82f5ef`
- Beta：`e7cc4d4`，合併提交 `239a7b7`
- 整合期修正：`7d62aec`
- 目標：`intergration`；本次不合併 `main`，不建立 release。

## 實際變更

1. Segment Tree 範例改用指令式 Heap 呈現，支援複合欄位、欄位隱藏、分隔符與格內區間 segment。
2. Segment Tree 查詢以向下遞迴動畫呈現，保留接受區間，`sum += tree[now]` 只搬移數值並保持全域 sum 身分。
3. 自動 fixed 與迴圈邊界事件設定會寫入檔案的 `@asm-view`，重新 RUN 後維持選擇。
4. Heap 範例移除舊 AV API，改用 trace directives，並維持 1-based 範圍與正確排序輸出。
5. Heap 格子與 outerframe 在跨層擴張／內縮同步；marker 賦值、同格讓位、scope exit、比較 highlight、正向與反向 sequence 使用一致時序。
6. 衝突整合同時保留 Heap 的 sequence geometry 與 Segment Tree 的 split segment 入退場、compound assignment、目的幀樣式。
7. 大驗證發現一般 keep snapshot 使用區塊外 `frozenFrame`，導致三介面播放中斷；改用 snapshot/source/current frame，並傳遞完整欄位 highlights，加入逐幀 snapshot 重現測試。

## 主代理驗證

- JavaScript 語法與 `git diff --check` 通過。
- 聯合 V2 專項：135/135 通過，0 fail、0 skip。
- snapshot 修正後直接專項：9/9 通過，包含逐幀 keep snapshot、複合 Heap、Segment Tree 兩範例與樣式正反播。
- Heap 實際動畫：algorithm 473、editor 475、runtime 476 個取樣全部通過；cloud storage、slide order、deck import 三個共用前置案例通過。
- 第一次 Heap 大驗證確實捕捉三介面的 `frozenFrame is not defined`；修正後完整重跑通過，沒有略過失敗。
- 動畫報告保留在本機忽略目錄 `algo-vis-backend/test-results/animation/2026-09-19T18-19-57-906Z/`，不提交產物。
- 測試索引更新為 94 個 `.test.js`。

## 服務與推送

- 3100 整合服務：從本 worktree 啟動為 PID 13656；algorithm、slides、renderer、tween、model、view-source 均為 HTTP 200，SHA-256 與磁碟檔案一致。
- 其他預覽：3101、3102 為 HTTP 200；3000、3103 原先即未啟動，本輪未操作。
- `origin/intergration`：依既有授權於服務核實後推送；未合併 `main`、未發布。
