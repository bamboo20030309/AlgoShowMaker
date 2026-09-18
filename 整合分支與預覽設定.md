# 整合分支與本機預覽

## 分支及服務配置

| 用途 | 分支 | 本機網址 | 工作目錄 |
|---|---|---|---|
| 已驗收版本 | main | http://localhost:3000 | 原專案根目錄的 algo-vis-backend |
| 主代理整合與預覽 | intergration | http://localhost:3100 | .worktrees/intergration/algo-vis-backend |
| Alpha 開發預覽 | codex/2026-09-18-alpha-events-arrows | http://localhost:3101 | .worktrees/2026-09-18-alpha-events-arrows/algo-vis-backend |
| Beta 開發預覽 | codex/2026-09-18-beta | http://localhost:3102 | .worktrees/2026-09-18-beta/algo-vis-backend |
| Gamma 開發預覽 | codex/2026-09-18-gamma | http://localhost:3103 | .worktrees/2026-09-18-gamma/algo-vis-backend |

整合分支名稱依使用者指定為 `intergration`，不要自行改名。建立基準為 main 的 ddfe5b6081261a05b437a61a546861151d4618e5。

## 主代理執行規則

- 每次統合回報列出本輪具體功能／修正、驗證結果、推送提交及伺服器重啟結果，不能只說已統合。

- 後續代理交付先 merge 到 intergration，完成相關分級驗證與交付紀錄，不直接 merge 到 main。
- 每次整合與驗證完成，重啟 3100 的整合服务並核對 HTTP 回應及前端腳本與整合 worktree 一致，提供預覽網址。
- 重啟前核對埠與程序，僅停止整合服務，不停止 main 的 3000 或其他代理服務。
- 只有使用者要求階段發布／合併 main 時，才將已驗收的整合版本合併 main，重啟 3000 與範圍內本機 Docker。
- 依使用者 2026-09-18 授權，每次整合驗證通過、紀錄提交與服務核實完成後，push intergration 到 origin/intergration；不得 force push。推送不代表授權合併 main。
- Release 與公開部署另依使用者授權執行，不因整合推送自動發布。
- 每輪新任務以主代理指定的完整 checkpoint commit 為基準，各自獨立分支與 worktree。

## 本機設定

- main 與 intergration 的 server.js 分別從各自後端目錄啟動，環境 PORT 分別為 3000／3100。
- 整合工作目錄使用自己的被 Git 忽略 .env，沿用本機開發設定；node_modules junction 復用已安裝相依，不納入提交。
- 兩個服務的瀏覽器 origin 與本機草稿空間不同；現有 .env 使用同一本機 Mongo，登入及雲端 deck 資料仍共用。測試使用獨立 fixture 與資料，不能覆蓋使用者內容。
- 主專案本機 Docker 的 public bind mount 仍指向 main 工作目錄，localhost:80 不是整合預覽。
- 服務 log 放在系統 Temp，不提交憑證、log、node_modules、測試產物。

- 3101／3102／3103 各自使用被忽略的本機 .env 與自己的工作目錄啟動；同樣共用本機 Mongo／雲端 deck，不能用私人資料做破壞性測試。PORT 由程序環境指定，各代理更新後自行重啟自己的預覽服務。
