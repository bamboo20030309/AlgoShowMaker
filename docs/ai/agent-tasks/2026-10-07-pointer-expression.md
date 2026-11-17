# 獨立指標運算式

## 任務與結果

支援 @pointer i-1 at p：標籤 i-1、位置 p[i-1]。沿用 parseFrameExpression 與物件索引相同的依賴規則，sourceName 使用第一個來源變數，sourceVariableIds 包含全部來源；indexExpression 使用原運算式，顏色、preset、矩陣軸與 layout 現有設定不改。指定 at p[i+1] 可單獨覆寫位置，標籤仍保留 i-1。無可見變數來源或含副作用的表達式明確報錯。

## V2 驗證

- pointer-directives.test.js 九案例：既有 preset／layout／矩陣／color，加上 i-1 與 object 索引依賴相同、i+j 多來源、明確索引覆寫及非法運算式。
- pointer-expression.browser：i=1、i=2 的 object 與獨立 pointer 指向一致（p[0]、p[1]），文字為 i-1；i+j 指向 p[3]。IndexedDB 儲存重開保持自訂色 #123456，舊物件缺少新欄位仍呈現原本索引。
- pointer-matrix-color.browser：兩軸、color、移動、越界與新舊 Trace 儲存重開通過。
- 使用隔離服務與瀏覽器，不操作使用者內容。語法與 git diff --check 通過，不啟動大型動畫驗證。

## 交付

只修改後端解析，既有前端即可呈現。3100 重啟為 PID 19460，核對 /trace/analyze 的 label=i-1、indexExpression=i-1。只推送 intergration，不合併 main 或發布 release。