# alpha-text-undo 交付驗證紀錄

## 交付資訊
- 狀態：整合驗收通過（V1 針對性驗證，主代理已核實）。
- 分支：codex/2026-09-18-alpha-text-undo
- 共同基準 commit：a524dd83b00f6ce137cf651fc7511219c2f0b772
- 程式修正 commit：e4671db9d6f4ca1d6699ba74cb74b5b06b6a7105；多物件補修 e12ab410b6e988ca19913a25036c40dd6a8861da。
- 初次驗證 HEAD：e4671db9d6f4ca1d6699ba74cb74b5b06b6a7105。補修驗證時 HEAD 538e36db1278ff7481fe56c2d362225c4c6e92da 加未提交 slides.js／browser fixture 差異；該受測差異完整提交為 e12ab410b6e988ca19913a25036c40dd6a8861da，無後續程式修改。
- 驗證日期：2026-09-18

## 根因與修改
- Fabric hiddenTextarea 被 DOM 編輯排除條件攔下，Ctrl+Z 使用瀏覽器原生歷史而非 deck 歷史；基準同 fixture 的最早正式失敗為 historyIndex 實際 3，預期 1（復原前 2）。先前診斷亦確認字元 fill/fontWeight 復原錯誤。
- 對目前 Fabric hiddenTextarea 攔 Ctrl/Meta+Z、Shift+Z、Y，復原同一文字物件的快照；保留物件、textarea、焦點、字元樣式與 grapheme 選區。快照涉及其他 deck 變更則使用既有全域復原。
- 暫存選區與歷史位置同步截斷／移除；beforeinput 保存被取代的選區，compositionstart 捕獲原選區。組字中的文字仍保存本機但不逐一新增歷史，compositionend 保存完成快照。
- 普通全域復原會替换 deck，因此 wireCanvas sync 依 slide.id 取當前 slide，避免後續編輯保存到已脫離 deck 的舊物件。
- 敘述面板會惰性填入預設 ttsOrder 而不新增歷史，原地恢復判定比較有效敘述順序，保留使用者實際順序差異。
- 主代理實際匯入線篩 deck 補驗發現首次多物件編輯仍 fallback：未編輯兄弟 raw JSON 同時被序列化補齊欄位，與歷史不相等。單頁加入第二文字與 rect 即重現，動畫／多頁非必要條件。補修在進入文字編輯時先 commitPendingColorHistory，只更新 live 與目前 history 的當前 slide.canvas 正規化基線；不新增歷史步、不覆蓋其他 deck 欄位、不放寬其他物件差異判定。
- 修改檔案：public/slides.js（修正）、public/slides.html（快取 text-undo-179）、tests/slides-text-undo.browser.test.js（隔離瀏覽器 fixture）、本任務文件。
- README／版本紀錄：不適用，既有快捷鍵缺陷修正且未修改檔案格式或公開介面。
- 與 task.md 的差異：無；相依保存修正已經主代理同意。

## 驗收條件對照
| 條件 | 驗證方式 | 實際結果 | 判定 |
|---|---|---|---|
| 選取取代、插入、刪除、連續復原與重做 | 真實鍵盤與 Fabric 狀態斷言 | 文字／樣式／歷史位置／選區符合，Ctrl+Shift+Z 與 Ctrl+Y 皆正常 | 通過 |
| 復原後繼續打字、編輯物件與焦點保留 | 同一物件／textarea identity、焦點、redo 分支、emoji grapheme 檢查 | 同一編輯物件與焦點保留，續寫清除 redo 分支 | 通過 |
| 多物件匯入後首次編輯 | 2 textbox + rect fixture；每次 state 嚴格比較未編輯兄弟 toObject；進入編輯前後 historyIndex 比較 | 首次文字 undo 保持編輯，兄弟資料完整相同，進入編輯不增加歷史步 | 通過 |
| IME 組字期間不攔、完成一次歷史 | browser 合成 CompositionEvent/InputEvent | 中間 input 不增歷史，完成一次；選取取代復原原選區；重複 final input 不增加快照 | 通過（事件契約） |
| 普通 DOM/Ace 委派原生 | 真實 textarea 打字復原；input 與 Ace class textarea 的 keydown defaultPrevented 檢查 | textarea 原生 undo 有效；其他 target 不攔快捷鍵 | 通過（Ace 委派邊界） |
| 全域 undo 後再打字保存 | 退出編輯後 undo、重新編輯、重載並實際匯出 decode | 重載 deck 保留新增文字 | 通過 |
| 既有 LaTeX undo/redo | 未修改的 latex-refresh.browser.test.js | 2 案例合跑皆通過 | 通過 |

## 小驗證與重跑方式
執行目錄：本 worktree 的 algo-vis-backend。node_modules junction 復用主 worktree 已安裝相依，測試使用隨機埠與独立 headless Edge context。

```powershell
node --check public/slides.js
node --check tests/slides-text-undo.browser.test.js
git diff --check
node --test tests/slides-text-undo.browser.test.js tests/latex-refresh.browser.test.js
```

- 修正 commit 上合跑：2 tests、2 pass、0 fail，exit 0。語法與差異檢查 exit 0。
- 多物件補修同一合跑命令：2 tests、2 pass、0 fail，exit 0；語法與差異檢查 exit 0。使用新 fixture 路由 e4671db9d6f4ca1d6699ba74cb74b5b06b6a7105 的 slides.js 時，第一次 Ctrl+Z 後 state 等待原文字／編輯物件 timeout（3000ms），exit 1；修正後完全相同嚴格斷言通過。
- LaTeX 首次 sandbox 測試因 jsdelivr KaTeX 資源 ERR_NETWORK_ACCESS_DENIED、pageerror Event 而 exit 1；同一未修改測試在 require_escalated 下讀取真實 CDN 後 exit 0，沒有放寬斷言。
- 新文字 fixture 不含數學，僅在自己的獨立瀏覽器 route 隔離 optional KaTeX CDN；不影響實際產品或既有 LaTeX 測試。
- 基準重現：`git show a524dd83b00f6ce137cf651fc7511219c2f0b772:algo-vis-backend/public/slides.js` 保存 UTF-8 臨時檔，設定 `ASM_TEXT_UNDO_BASELINE` 為絕對路徑，執行 `node --test tests/slides-text-undo.browser.test.js`；測試 route 使用基準 JS，exit 1，historyIndex 3 !== 1。
- 可提交證據為 browser fixture 與斷言；終端 TAP 僅本次工具紀錄，沒有提交 log、test-results、編譯產物。

## 剩餘事項與合併注意
- 未驗證：OS 中文輸入法實際組字（本次驗證為合成 browser 事件契約）；實際 Ace 編輯 session 原生歷史（已驗證其 textarea 委派邊界）；macOS Meta 快捷鍵（邏輯共用，實測 Ctrl）。
- 主代理補驗已完成：三項相關測試、原線篩投影片文字操作及動畫前後步進、本機／相關 Docker 服務重啟；使用者指定不跑大規模驗證。
- 相依與衝突：只改 slides.js、slides.html cache 版本與新增 fixture；無外部介面變更。

## 主代理核實與整合（由主代理填寫）
- 狀態：整合驗收通過（本次 V1 範圍）。
- 核實的程式 commit 與 diff 範圍：e4671db9d6f4ca1d6699ba74cb74b5b06b6a7105、e12ab410b6e988ca19913a25036c40dd6a8861da；文字歷史、選區、IME、同步保存與多物件基線。最終受測程式 HEAD 為 1a1152981010d5d82a28b6a113375fc60c7edb3c，另含入口快取版本與精確版本斷言更新至 text-undo-180。
- 差異審查與必要重跑結果：最終 HEAD 執行兩項 node --check、git diff --check，皆 exit 0；執行 node --test tests/slides-text-undo.browser.test.js tests/latex-refresh.browser.test.js tests/entrypoints.test.js，3 tests／3 pass／0 fail／0 skip，exit 0。LaTeX 讀取實際 CDN，未改斷言。
- 合併 commit：9955e47fde6d82bf77c32bb2de2182a4dcfe2ccf；最終快取修正 1a1152981010d5d82a28b6a113375fc60c7edb3c。
- 完整 regression：最終版本未執行，依使用者最新指示不跑大規模驗證。先前舊版本執行曾發現入口快取精確斷言不一致，已修正；後續舊版本廣泛驗證在新增多物件補修後停止，不作為最終完整回歸通過證據。
- 演算法投影片實際驗證：獨立 headless Edge 匯入既有 14 頁線篩 deck；首頁文字追加後 Ctrl+Z 回復且保持編輯焦點，最後動畫實際 SVG 可前後步進 0→1→0。原動畫程式保持不變，205 frames，未覆寫使用者檔案。
- 未完成或環境阻塞：無本次 V1 驗收阻塞；OS IME、實際 Ace session、macOS Meta 實測與完整回歸未驗證，範圍如上。
- 本機服務重啟：已重啟主專案 node server.js（PID 59272），docker compose restart backend nginx exit 0；MongoDB 未重啟。HTTP 3000 與 80 的 slides.html／slides.js 均 200，快取 text-undo-180 且腳本 SHA-256 與受測程式完全相同。
- Push／公開部署狀態：未 push、未發布 Release、未公開部署；本機 Docker 使用專案 public bind mount，已重啟相關服務。

## 驗證分級與選擇
- 分級：V1，A（入口快取）與 B（Fabric 文字編輯／歷史）；沒有修改演算法解析、runtime、排程或 SVG 動畫路徑。
- 選擇依據：使用者指定不用大規模驗證；最新 AGENTS.md 及子代理驗證分級通知要求非動畫前端修改採直接相關的小驗證。
- 執行方式：上述三項測試各自使用隔離測試伺服器／瀏覽器；實際 deck 補驗使用隨機埠與獨立 context。沒有操作使用者分頁。
- 補驗證據與重跑：C:/Users/user/.codex/visualizations/2026/09/17/01a0b028-47bd-7ba3-aac4-e52f71951731/linear-sieve/build/check.cjs；在主專案 algo-vis-backend 執行 node <該絕對路徑>。結果同目錄 validation.json，actualDeckTextUndo 與 actualSlidesRuntimeNextPrevious 均 pass。這是本機證據，未提交至 Git，保留期限依本機產物清理而定。
- 服務 HTTP 核實通過；額外非必要 docker ps 在一般 sandbox 因 pipe 權限被拒，未用此失敗推論容器狀態；已成功的 compose 重啟與 80 埠最新腳本回應為本次服務證據。
