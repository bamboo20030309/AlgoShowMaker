# gamma-structure-annotations 交付驗證紀錄

## 交付資訊
- 狀態：小驗證通過，待主代理核實
- 分支：codex/2026-09-18-gamma
- 共同基準 commit：b2aac34ff4f07caafa428eed9200426b3397e3bc
- 程式修正 commit：6c6dc3e06db5d93cdd85166618f56177ec349174
- 驗證版本：以上commit相同程式diff，執行時尚未提交。
- 驗證日期：2026-09-18

## 根因與修改
- 設計依據：使用者希望一般structure有動畫arr[i]形式的方格註標指標，位於元素樣式下方。
- 新增annotationIndices，沿用parseIndices與draw_block；淡藍18px方格顯示指定索引，20px細線箭頭指向元素。保留既有point紅色實心箭頭功能。
- 新欄位接入normalize、建立、編輯、重繪與既有widget持久化流程。
- SVG增加邊界避免上方標籤裁切；树透過data-tree-index定位，其他結構用既有元素索引。
- highlight/point預設#ff0000、focus#808080、mark#22c55e；明確儲存的舊色保留。
- 檔案：slides.html介面/快取；slides.js資料/編輯；slide-structures.js渲染；專項瀏覽器及入口測試。
- README／版本紀錄：未修改，本次操作說明在設定欄placeholder及任務紀錄中。
- 與task.md差異：無。

## 驗收條件對照
| 條件 | 方法 | 實際結果 | 判定 |
|---|---|---|---|
| 設定列可用、索引及範圍 | 編輯fixture填0,2-3,99 | 只產生0/2/3註標 | 通過 |
| 清空移除 | 清空索引欄 | 無註標 | 通過 |
| 儲存重開 | 輸入1,3、模式切換保存、reload | 設定與箭頭保留 | 通過 |
| 新預設與舊自訂色 | 編輯器色鈕、renderer指定#123456 | 四個預設正確，自訂色保留 | 通過 |
| SVG及canvas | viewBox與getBBox、XML parser、drawCanvas | 無裁切、無解析或圖片繪製錯誤 | 通過 |

## 小驗證與重跑方式
- 執行目錄：本worktree/algo-vis-backend。
- 指令：node --test tests/structure-annotations.browser.test.js tests/entrypoints.test.js
- 目的：一般structure編輯、保存、渲染及入口版本。
- fixture：四元素合成deck，無canvas私人內容；另createSvg最小檢查matrix、binary_tree、heap索引2皆生成單一註標。
- 環境：隨機埠ASM_REGRESSION服務、獨立無頭Edge；允許載入既有Reveal/KaTeX CDN依賴。
- 結果：2通過、0失敗、0skip，exit code 0。
- 最早失敗：沙箱網路使https://cdn.jsdelivr.net/npm/katex@latest/dist/katex.min.js載入失敗，產生未處理Event；追查來源後允許既有依賴再跑，不放寬錯誤斷言。
- 語法：node --check public/slides.js、public/slide-structures.js、tests/structure-annotations.browser.test.js，皆exit code 0。
- git diff --check：exit code 0。
- 證據：提交專項測試；本機test-results/structure-annotations.png已視覺檢視，僅保留本機、不提交。

## 驗證分級與選擇
- 層級：V1。
- 分類：A/B/C。
- 依據：一般投影片元件與widget欄位，未改trace動畫排程或共用動畫renderer。
- 未執行演算法驗證集：本次不涉及演算法動畫；未執行完整regression或全部tests。
- 主代理需要的V3：一般structure整合驗收，無理由啟動廣泛演算法集。

## 剩餘事項與合併注意
- 未驗證：專項undo/redo、手機軟鍵盤、各結構多行並存大量註標的視覺排布；matrix/tree/heap僅SVG定位檢查，不宣稱所有結構畫面完整驗收。
- 主代理補驗：實際使用者deck、多行structure、undo/redo及匯出畫面。
- 共用slides.js與快取版本需協調。
- push沿用前次自動審核拒絕：外部目的地與完整payload授權不明確，可能涉及私人程式碼；未重試。

## 主代理核實與整合（由主代理填寫）
- 狀態：尚未核實
- 核實的程式commit與diff範圍：待填
- 差異審查與必要重跑結果：待填
- 合併commit：待填
- 完整regression：未執行
- 演算法投影片實際驗證：未執行
- 未完成或環境阻塞：push授權待確認
- 本機服務重啟：未執行，由主代理負責
- Push／公開部署：未push、未部署
