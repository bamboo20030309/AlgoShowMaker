# gamma-cursor-blink：文字游標一般閃爍

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：4603a68d81db2da71fb6e8b6958d02475b9127be
- 分支：codex/2026-09-18-gamma
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-18-gamma

## 問題與預期結果
- 情境：投影片文字物件編輯游標。
- 目前行為：Fabric 用 opacity 動畫與100ms停頓，專案 cursorDuration=1 仍依動畫機制快速切換。
- 希望結果：一般應用程式顯示／隱藏閃爍，不要漸層。
- 範圍：Fabric IText/Textbox 文字游標，不改演算法播放。

## 需求確認
- 已確認：取消淡入淡出，小驗證及 push。
- 尚待回答：無。
- 合理假設：每500ms切換顯示／隱藏，輸入後立刻顯示，退出編輯停止。

## 重現與調查
- 靜態確認 Fabric _animateCursor 使用 obj.animate 插值，_onTickComplete 有100ms等待。
- 狀態：已確認原實作；新行為以實際瀏覽器數值驗證。
- 尚待調查：无。

## 修改邊界與依賴
- slides.js：一次性 IText 原型游標補丁，沿用 Fabric abort 生命週期；cursorDuration 設500。
- slides.html／entrypoints 版號与專屬測試。
- 共用介面：不改文字存檔、選取、IME 下劃線或動畫路徑。
- 依賴：Fabric 既有 IText API。

## 驗收條件
- [x] 游標只顯示／隱藏，透明度為0或1，正常每約500ms切換。
- [x] 輸入後游標立即顯示，退出編輯後不再閃爍。
- [x] 入口檢查与瀏覽器無錯誤。

## 驗證計畫
- V1/B 最小文字編輯瀏覽器案例、入口与語法；隨機埠、獨立 Edge、合成文字投影片。
- 主代理整合後完整回歸与實機中文輸入法。

## 變更紀錄
- 2026-09-18：初始定義。
