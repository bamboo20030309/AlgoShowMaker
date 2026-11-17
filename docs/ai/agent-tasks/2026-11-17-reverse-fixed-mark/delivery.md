# 倒退播放自動 mark 修正（2026-11-17）

## 問題與原因

倒退一步完成後仍保留離開幀的完成標記，例如目的應為 [0,1] 卻留下 [0,1,2]。

eventSequence 已為倒退選取目的幀，但 createDirectiveFollowPlan 仍由離開幀建立。即使沒有動態樣式跟隨記錄，styleFrameAt() 也會回傳其初始幀；prepareForwardValues.update() 因此覆寫原本正確的目的樣式，重建離開幀的 fixed mark。

## 修改

- 建立繪圖跟隨計畫時，倒退使用目的幀；離開幀僅負責辨識反向動作事件。前進沿用原事件幀。
- 不更動 mark 累積答案、事件順序、手動樣式或開關。
- tween 前端版本 trace-367 → trace-368，algorithm.html 同步更新，既有資料直接適用，無需重新產生 Trace。
- 原 auto-fixed 畫面測試新增 1／2 倍速，保留所有原答案。

## 驗證

獨立服務與 headless Edge，不操作使用者分頁。

- auto-fixed-playback.browser：2/2；前進、倒退、直接跳幀、Studio 開關、JSON 重載、明確關閉、自訂手動 mark。
- automark.browser：1/1；每幀範圍與 none 切換、跨陣列、自訂手動色、倒退及重開。
- events-fixed-state.browser：1/1；濃縮線篩停用事件動畫時，i=9 倒退 i=8 正確移除第9格標記。
- automark.test 與 events-fixed-state.test：8/8；舊資料缺省欄位、明確關閉、編譯資料映射與未選事件保留。首次未提供隔離服務時兩個編譯案例拒絕執行，補齊前置重跑後通過，未修改答案。
- 修改 JS 語法與 git diff --check 通過。
- 畫面測試無 pageerror。沒有執行全量驗證；巢狀位移缺口留待另外修正。

本機證據（忽略、不提交）：test-results/fixed-mark-repair-2026-11-17.tap、fixed-mark-model-isolated-2026-11-17.tap。
