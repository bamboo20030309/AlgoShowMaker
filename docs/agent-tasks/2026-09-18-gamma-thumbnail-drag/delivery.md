# gamma-thumbnail-drag 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：ad72d6aa22675681f6e3d71283c58d85a45ea489
- 程式修正 commit：51830b7c1c5046c26fd6c5c6a62b4db634af0596
- 驗證版本：上述commit相同程式diff，執行時尚未提交。
- 日期：2026-09-18

## 根因與修改
- organizer只設定同步已存在的圖片draggable=false；buildMissingThumbnail在await後建立圖片，錯過該設定。
- home.js的showDeckThumbnail在建立圖片時即關閉原生圖片拖曳，保留既有整卡pointer拖曳。
- index.html更新home.js快取；測試加入延遲生成縮圖fixture及直接從圖片開始的滑鼠拖曳。
- README／使用說明：修正原有操作，不適用。
- task.md差異：無。

## 驗收條件對照
| 條件 | 方式 | 實際結果 | 判定 |
|---|---|---|---|
| 非同步圖片不原生拖曳 | 等待延遲生成圖片、讀draggable | false | 通過 |
| 拖曳圖片移動卡片 | 真實滑鼠pointer拖曳 | 排序符合預期、不開啟deck或dialog | 通過 |
| 既有資料夾操作 | 同一相關瀏覽器案例 | 分類、排序、儲存及失敗復原通過 | 通過 |

## 小驗證與重跑方式
- 目錄：本worktree/algo-vis-backend。
- 指令：node --test tests/entrypoints.test.js tests/library-folders.browser.test.js
- fixture：1px合成圖片、缺少封面的Gamma卡片、延遲200ms生成縮圖、mock API。
- 環境：隨機埠ASM_REGRESSION服務、獨立無頭Edge，不用真實資料庫或使用者分頁。
- 結果：2通過、0失敗，exit code 0。
- git diff --check：exit code 0。
- 證據：提交測試程式，無需額外暫存產物。

## 剩餘事項與合併注意
- 完整回歸未執行，依使用者指示由主代理負責。
- 主代理需以實際既有投影片補驗收非同步縮圖與分類操作。
- home.js快取版本需整合協調。
- push沿用前次自動審核拒絕：外部目的地與完整payload授權不明確，可能涉及私人程式碼；未重試。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff：待填
- 差異審查與必要重跑結果：待填
- 合併commit：待填
- 完整regression：未執行
- 演算法投影片實際驗證：未執行
- 未完成或環境阻塞：push授權待確認
- 本機服務重啟：未執行，由主代理負責
- Push／公開部署：未push、未部署
