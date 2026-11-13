# 2026-11-13-canvas-toolbar：投影片動畫畫布工具列（介面改版階段 1）

## 任務資訊
- 負責代理：Claude（Claude Code 桌面版）
- 狀態：待交付
- 共同基準 commit：9323d45（intergration：fix: drop old login styles and stop forgot-password from revealing accounts）
- 分支：claude/2026-11-13-canvas-toolbar
- Worktree：C:\Users\user\Documents\Codex\2026-07-29\algoshowmaker-main-commit-d154dd5-slides-html\work\AlgoShowMaker\.claude\worktrees\project-overview-3e7a15

依據：介面入口修改報告（草稿 `docs/ai/agent-tasks/2026-11-10-ui-entry-plan.md`，尚未提交）第 3.3 節（D5–D7）與 Q3。

## 問題與預期結果
- 使用者指示（2026-11-13）：「做第一階段 並把上下一步按鈕的中文字去掉 只留圖示」。
- 投影片裡的動畫沿用程式碼頁整排控制列（含上一大步／下一大步、TTS、速度），放映與編輯沒有分別，也沒有在投影片上直接重新產生動畫的入口。

## 需求確認
- 已確認：報告 3.3 的內容；上一步／下一步只留圖示。
- 代理採用的合理假設：
  1. 上一大步／下一大步也一併改成只留圖示（只在舊版 `AV.hpp` 動畫出現，與上下一步外觀一致）。
  2. 編輯畫面的工具列一直顯示（報告寫「滑鼠移入或選取時浮現」，此次未做浮現，見交付紀錄）。
  3. 放映指「非投影片編輯畫面」（包含唯讀檢視與分享觀賞），只留 ⏮ ◀ ⏯ ▶ ⏭ 與進度條。
  4. RUN 只對 trace 動畫顯示；舊版腳本動畫沒有可重新產生的 trace。
  5. 報告建議工具列由投影片頁自己繪製；此次仍沿用嵌入頁的控制列，以父頁傳入的模式 class 決定顯示哪些按鈕（見交付紀錄）。

## 驗收條件
- 程式碼頁：上一步／下一步只有圖示（保留 title 與 aria-label）；上一大步／下一大步只在舊版腳本動畫顯示。
- 投影片放映：只顯示 ⏮ ◀ ⏯ ▶ ⏭ 與進度條，進度條補滿寬度；不顯示 RUN。
- 投影片編輯：RUN 在最前，其餘完整工具列；上一大步／下一大步不顯示；紅點亮時 RUN 加強調。
- RUN 成功：換上新動畫、回到第 0 幀；失敗：保留原動畫，畫布上方顯示錯誤與「開啟編輯器」，不存檔。公開範例只換本次開啟的副本。
