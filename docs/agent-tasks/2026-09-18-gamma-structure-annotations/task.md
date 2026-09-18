# gamma-structure-annotations：一般structure註標箭頭

## 任務資訊
- 負責代理：gamma
- 狀態：待交付
- 共同基準 commit：b2aac34ff4f07caafa428eed9200426b3397e3bc
- 分支：codex/2026-09-18-gamma
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-18-gamma

## 問題與預期結果
- 情境：一般投影片structure物件。
- 目前：有元素樣式，無動畫arr[i]形式的方格註標箭頭。
- 希望：元素樣式下方新增索引控制與指標+格子縮圖；新增物件highlight/point純紅、focus灰、mark綠。
- 範圍：一般投影片渲染、設定、保存；不修改trace動畫排程或render核心。

## 需求確認
- 已確認：位置、索引操作、小圖示及預設顏色。
- 尚待回答：無。
- 合理假設：註標方格顯示指定元素索引；與現有元素樣式相同，支援逗號與範圍、清空移除；舊物件自訂顏色保留。

## 重現與調查
- 功能新增，不適用重現。
- 已確認：動畫variable-marker使用18px淡藍方格及20px細線箭頭；structure已有draw_block元件可重用。
- 索引沿用structure已有data-structure-item-index；樹採data-tree-index。
- 尚待調查：無。

## 修改邊界與依賴
- public/slides.html：新設定列、圖示、初始顏色及快取。
- public/slides.js：annotationIndices正規化、建立、編輯、重繪欄位；顏色預設。
- public/slide-structures.js：沿用draw_block製作註標，細線箭頭外觀對齊動畫，擴充SVG邊界避免裁切；顏色fallback。
- tests/structure-annotations.browser.test.js及入口測試。
- 共用介面：新增可選widget.annotationIndices字串，舊資料預設空值。
- 依賴：無；主代理需協調共用slides.js及HTML快取版本。

## 驗收條件
- [x] 元素樣式下方顯示圖示及註標箭頭索引欄。
- [x] 輸入0,2-3只在對應元素顯示註標，無效99忽略；清空移除。
- [x] 保存並重開保留設定及箭頭。
- [x] 新預設highlight/point=#ff0000、focus=#808080、mark=#22c55e，既有自訂色保留。
- [x] 一般陣列箭頭不被viewBox裁切，SVG可繪製至canvas。

## 驗證計畫
- V1、分類A/B/C：JS語法、diff、最小專項瀏覽器與入口測試。
- 讀取主根目錄子代理驗證分級通知.md；worktree無該檔，以最新主根通知為準。
- 隔離：隨機埠ASM_REGRESSION、合成deck、獨立無頭Edge，不使用主服務與真實資料。
- 主代理整合：核對實際structure編輯、儲存、輸出及多行排列；本次不啟動演算法驗證集。

## 變更紀錄
- 2026-09-18：初始定義與實作；網路限制導致KaTeX載入錯誤，允許既有依賴後測試通過。
