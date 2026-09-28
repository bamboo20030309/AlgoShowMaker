# 畫布裁切交付
- 狀態：小驗證通過，待主代理整合
- 分支：codex/2026-09-22-gamma
- 基準：637f23e6d37123b867b3e5a15168bc50bfd53163
- 程式提交：438073f36806f15bc6a698948647657a23f98a97
- 日期：2026-09-28
- 驗證內容與上述程式提交一致。

## 修改及限制
新增 trace-viewport-culling.js 並在 algorithm.html 載入。瀏覽器監看主畫布頂層 SVG 物件與視窗交集，離屏超過 160px 緩衝才隱藏顯示，重新進入自動恢復。
不刪除 DOM，不改模型、幾何或動畫時間。主要節省瀏覽器繪製工作；初始場景建構、getBBox、事件排程及每幀動畫計算仍執行。未測量 CPU 降幅，不宣稱大幅加速。
沒有新持久化欄位，也不將 culling 狀態寫入 deck 或 studio 設定。CSS 僅限主畫布，縮圖和測量 SVG 不受影響；既有明確 visibility:hidden 已驗證保留。
一般 Fabric 投影片畫布未納入本次。

## 驗證分級與結果
V2/J；全部在 gamma worktree 的 algo-vis-backend 執行，使用隨機埠與獨立 Edge。
1. node --check public/trace-viewport-culling.js；git diff --check：通過。
2. node --test tests/trace-viewport-culling.browser.test.js tests/entrypoints.test.js：2 passed / 0 failed / 0 skipped。
   - 120 物件中超過 100 個離屏物件被裁切，平移至遠端後恢復，原尺寸、transform、fill 保留。
   - getBBox 仍可讀；顯式隱藏回到視窗後仍隱藏；場景移除後 observer targets 歸零。
3. node -e "process.env.ASM_VERIFY_PREFLIGHT='1'; require('./tests/studio-virtual-rail.browser.test.js')"
   - 500 幀虛擬縮圖 1 passed，hidden event / marker / scope-exit 1 passed，無 skip。
   - 初始與末端仍僅 6 張卡片，外部跳幀與重開正常。
證據為可重跑測試原始碼；沒有提交 test-results 或 log。
未執行大型 regression；未以真實使用者 deck 量測效能。

## 其他適合的優化
- 底部幀時間線：水平可見範圍的按鈕虛擬化。
- 程式碼片段與事件清單：只掛載可見列，保留資料層勾選與縮排。
- 我的投影片／範例庫：縮圖進入視窗才產生或載入。
- 大型矩陣、表格、長陣列：內部格子裁切，需先把幾何模型與 DOM 解耦。
- 隱藏的 Inspector 分頁：延後建立內容，切回再更新。

## 主代理核實
尚未核實；需補驗證真實大型 deck、自動鏡頭、跨視窗箭頭與動畫進出邊界。
3103 程序未重啟，沿用前次 auto-review 的 PID 歸屬未核实阻塞；本次是靜態模組更新，重新載入頁面取得。
未合併 main、未發布 Release 或公開部署。
