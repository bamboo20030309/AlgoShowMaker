# gamma-studio-lod：修正關閉編輯動畫後 LOD 失效

- 負責：gamma；狀態：待交付。
- 分支：codex/2026-09-22-gamma。
- 基準：6c2159909a3d53ba06198736e7a467c0c24aae56，開始時乾淨。
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma

## 需求與調查
使用者確認1000陣列＋100×100紅綠棋盤，反覆開啟編輯動畫再關閉後LOD失效。無待確認問題。
已重現第一次關閉即讓LOD群組2→0。closeStudio只停用位置動畫，未停用事件動畫；重繪因canLod要求animateEvents=false而建立全細節場景。這不是首尾事件剔除造成資料遺失。

## 邊界與依賴
只修正closeStudio的穩定重繪選項、資產版本及相關局部測試。不修改真正播放的動畫路徑或持久化格式。

## 驗收
- [x] 連續3次開關Studio，LOD仍有2群組。
- [x] 低倍率省略文字與合併背景，24px門檻放大補字，再縮小省略。
- [x] 棋盤11,000格與紅綠樣式保持。
- [x] 舊trace、自訂設定及初始keep往返仍通過。

## 驗證
V2，scene-load-performance、trace-chunks.browser及entrypoints直接相關小測試；隨機埠與獨立Edge。不跑完整regression。完成commit/push及重啟自身3103。

## 變更紀錄
2026-09-28：使用者澄清是開關編輯動畫後發生；按此路徑重現並修正。

2026-09-29：小驗證通過，提交並更新3103，待主代理整合核實。
