# gamma-brand-favicon 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：b302c67e271ef0da6d37ab97e940413251645a8d
- 程式修正 commit：a9c26b88b257df0788eb9ac135804cf7294f92bd
- 驗證版本：上述commit相同程式diff，執行時尚未提交。
- 日期：2026-09-18

## 根因與修改
- 設計依據：使用者要求品牌圖示與瀏覽器一致。
- index.html 改為 img 引用 favicon.svg，保留品牌首頁連結及文字；裝飾圖示空alt。
- home.css 移除原A字方塊背景、邊框，維持28×28及不縮小。
- 快取版本更新；入口與瀏覽器測試更新。
- README／使用說明：純外觀改動，不適用。
- task.md差異：無。

## 驗收條件對照
| 條件 | 方式 | 實際結果 | 判定 |
|---|---|---|---|
| 共用瀏覽器圖示素材、載入成功 | 比較img.src與rel=icon.href、naturalWidth | 同網址、載入成功 | 通過 |
| 尺寸與背景邊框 | 瀏覽器計算樣式 | 28×28、透明背景、0px邊框 | 通過 |

## 小驗證與重跑方式
- 目錄：本worktree/algo-vis-backend。
- 指令：node --test tests/entrypoints.test.js tests/auth-center.browser.test.js
- fixture：空範例目錄mock、隨機埠ASM_REGRESSION服務、獨立無頭Edge。
- 預期：圖示一致及既有登入布局不退化。
- 實際：2通過、0失敗，exit code 0。
- git diff --check：exit code 0。
- 證據：提交測試程式；test-results/auth-center-desktop.png及auth-center-mobile.png僅本機保存、不提交。

## 剩餘事項與合併注意
- 未執行完整回歸，依使用者指示由主代理負責。
- home.css快取版本需整合協調。
- push沿用前次自動審核拒絕：外部目的地與完整payload授權不明確，可能涉及私人程式碼；未重試。

## 主代理核實與整合（2026-09-18）
- 狀態：已核實並合併 intergration。
- 受測／合併 commit：eafa8a09c4ca960301b369ffcbdafaefe97abdea。
- 差異審查、6 項相關驗證、服務核對與未驗證範圍：見 [本輪整合紀錄](../2026-09-18-folder-dialog-thumbnail-integration.md)。
- 完整 regression／演算法大驗證：依非動畫修改範圍未執行。
- 本機服務：3100 已重啟，PID 29956；main 未變動。
- Push：依使用者授權推送 origin/intergration，結果以主代理最終回報為準；未部署或發布 release。
