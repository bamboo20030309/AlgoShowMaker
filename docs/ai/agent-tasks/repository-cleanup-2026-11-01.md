# 程式庫與本機研究資料整理

## 授權與範圍

使用者要求將論文全面移出 repo、移除無關腳本與編譯產物、集中 AI 文件與交付紀錄，並刪除盤點出的過期內容。本輪程式庫修改只在 intergration，沒有合併 main 或發布新版本。

main 工作目錄的未追蹤研究文件、投影片修訂、圖片、PDF 與中間資料移至 repo 外的 `Documents/AlgoShowMaker-research-archive/2026-11-01/`，保留原相對路徑。共 2,798 個研究檔案、575,263,423 bytes；另有搬移清單與舊專案除錯 helper。各批搬移核對檔案數與大小，外部 MOVE-RECORD.json 可追查來源。

77 個已確認的論文／一次性修訂與除錯腳本已從 repo 移除。自動核准審查拒絕最初的大批永久刪除方案，因此改為逐項核實、外部備份與 SHA-256 比對後再移除原檔，避免不可復原的誤刪。外部 removed-scripts/REMOVAL-RECORD.json 記錄每份檔案的雜湊。

原先佔用研究資料夾的兩個預覽程序已核實來源並停止；沒有停止 3000／3100 作為搬移手段。

## 程式庫整理

- `docs/agent-tasks/` → `docs/ai/agent-tasks/`；保留各任務的層次與驗證證據。
- 補充交接 → `docs/ai/agent-handoffs/`。
- 協作、分級、預覽規則 → `docs/ai/collaboration.md`、`validation-levels.md`、`integration-preview.md`。
- 原 AGENTS.md 規則與使用者三項待辦 → `docs/ai/development-instructions.md`；根目錄保留自動發現入口，不刪除待辦。
- 教材 skill → `docs/ai/skills/algoshowmaker-authoring/`，完整保留套件內部結構。
- Layout 實作狀態 → `docs/reference/layout-roadmap.md`，保留仍有效的技術規劃。
- README、版本說明、手冊與交付紀錄的相對連結／repo 路徑同步更新；新增 AI 文件索引。

移除 Git 已追蹤的 `lib/pch.hpp.gch`、未引用的八皇后 revised 草稿、git.txt、v4.12-draft.md，以及 v4.11 專用驗證腳本與兩個 npm 別名。舊發布草稿連結改到正式 v4.12 說明；歷史紀錄中的當時驗證名稱保留其歷史意義。

加入 worktree、本機研究產物、環境變數檔與編譯中間檔的忽略規則；Docker build context 排除 drafts 與 .gch。

## 保留與限制

公開 15 套教材、49 份 Trace、預設動畫與使用中的測試 fixture 保留。13 份目前 repo 無引用的 Trace 尚未核實雲端及使用者舊匯出檔，未刪除。舊 worktree 也未批次移除，以免遺失其他代理未追蹤資料。

本輪移除工作樹檔案不會重寫 Git 歷史，既有提交仍保留被移除內容。main 的已發布 checkout 維持原狀，待使用者要求合併後才套用程式庫整理。

## 驗證

V0 文件／檔案配置，未改動畫程式邏輯，不執行演算法驗證集。

- 全部現存 Markdown 的相對連結檢查：0 個失效連結。
- 搬移後教材 skill 的 quick_validate：通過。
- 所有 npm script 的 Node 入口檔案存在，移除舊別名後沒有懸空入口。
- 仍使用的八皇后測試教材可解碼。
- 測試索引可讀取，共 292 檔；僅盤點，未執行。
- git diff --check：通過。

完成後重啟 3100 並核對 HTTP／前端檔案，推送 intergration；本輪沒有修改 main 的執行內容或 Docker 部署。
