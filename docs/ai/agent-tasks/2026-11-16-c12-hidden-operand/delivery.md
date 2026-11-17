# C12：混合運算不可見來源置中

日期：2026-11-16。分支：intergration；基準 ed4836e。

## 修正

混合運算中，可見來源使用原本數字飛入；不可見來源使用已捕捉的數值，在目標原數字的位置直接顯示並覆蓋，所有來源到齊後才提交。只有單一常數／單一不可見來源的賦值仍保留下落。

主因是 createAssignmentEffect 的不可見來源分支呼叫 createLiteralAssignmentTransfer 時，沒有傳入與常數分支相同的 stationary 設定。現在補齊設定，並統一計算不可見／常數的數字位置；可見來源不計入這些位置，因此只有一個不可見數字時會在目標中央。

沒有新增持久化欄位，不修改使用者程式碼或輸入；既有 Trace 的數值與格式處理仍使用共用路徑。前端腳本版本改為 trace-367，避免重新整理仍取到舊版播放器。

## 驗證集補強

- C12 手寫規格 hiddenOrigin 改為 target-value-center，hiddenMotion 為 stationary。
- 同時檢查水平置中、開始位置、傳送中途、提交前的位置不下落；來源到齊前保持舊值，到齊後才提交，完成後不殘留複本。
- 觀測實際格內原數字，而不是含名稱標籤的整個物件外框。原外框的名稱會改變幾何中心；改用獨立的原數字 DOM 邊界比對覆蓋位置，仍保留小於 1px 的斷言。
- 保留實際目標、來源、數字複本座標及 motion 屬性作為失敗證據。

## 結果

- C12、E08、E09、E12、E13：5/5 通過；涵蓋混合來源、常數運算、單獨下落、不可見來源及最終值。E08/E09 的時鐘案例包含 1x、2x。
- arithmetic-assignment.browser.test.js 的 mixed constants retain 案例：通過，4x 播放下確認數字與運算符號及最終值。
- 修改的 JavaScript 語法檢查、git diff --check 通過。
- 不重跑無關演算法；前輪的 8 個指標失敗不在本次修改範圍，也沒有標為通過。

## 證據與重跑

以下為 algo-vis-backend 下被 Git 忽略的本機結果：

- test-results/c12-fix-contracts-final.log
- test-results/event-contracts/summary.json、records.json
- test-results/c12-fix-arithmetic.tap

```powershell
node scripts/validation/event-contracts.js --case C12,E08,E09,E12,E13
```

使用獨立服務及瀏覽器，不操作使用者分頁。3100 依專案規則重啟；未合併 main、未發布 release。
