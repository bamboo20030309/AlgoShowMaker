# 畫布可見性裁切
- 負責代理：gamma
- 基準：637f23e6d37123b867b3e5a15168bc50bfd53163
- 分支：codex/2026-09-22-gamma
- 狀態：待交付
- 工作目錄：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.worktrees\2026-09-22-gamma

## 需求及範圍
使用者希望畫布物件也套用 culling 以降低畫面外工作，並要求整理其他可套用處。
本版先實作演算法／Trace Studio 主 SVG 的可見性裁切。資料模型、初始 SVG 建構與動畫運算仍執行，不宣稱已達成模型計算裁切或量化 CPU 加速。

## 設計
使用 IntersectionObserver 追蹤頂層 trace 物件與畫布交集，160px 緩衝。
離屏套用獨立 runtime attribute 與 CSS visibility，不覆蓋使用者原 visibility、尺寸、位置與內容；重新進入自動恢復。
CSS 限定主畫布，不作用於縮圖或測量 SVG。保留幾何供鏡頭、排版、箭頭端點使用。
此功能無持久化欄位。API 不支援時維持完整渲染。

## 驗收與分級
V2 / J，語法、入口檢查及隔離瀏覽器小驗證：
120 物件多數離屏被裁切；平移到遠端恢復，getBBox 及樣式值不變；顯式隱藏保留；換場景清理監聽物件。
沿用 Studio 500 幀與 hidden/marker/scope-exit 專項確認相容。
不執行大型 regression。主代理補驗證真實大型 deck、自動鏡頭和快速動畫跨越視窗邊緣。
