# 貼上文字後續打覆蓋修正

帶樣式貼上在編輯中的 Fabric text 使用 `insertChars` 更新物件，卻沒有更新 `hiddenTextarea.value`。`_updateTextarea()` 只同步選取位置，不同步內容，因此下一次原生輸入會把舊輸入框內容寫回物件，造成剛貼上的文字消失。

修正：貼上後先將隱藏輸入框內容同步為物件全文，再同步已收合的游標位置。保持原有樣式貼上與行內格式功能，不以刪除畫布選取框迴避資料不同步。

## 驗證

- V1／B，一般文字編輯；使用 algoshowmaker-regression 的局部驗證流程，未執行演算法驗證集。
- 修正前重現：畫布是 `XA🙂B\nC`，隱藏輸入框仍是 `X`，新增斷言失敗；不是僅憑推測修正。
- `node --test --test-concurrency=1 tests/slides-rich-text-paste.browser.test.js tests/slides-paste-cursor.browser.test.js`：2 案例通過。
- 擴充預設行內格式／取代選取範圍後，重跑 `slides-rich-text-paste.browser.test.js`：1 案例通過。
- 核對原生輸入內容、Fabric 字元游標與 UTF-16 游標都同步；下一字在貼上尾端插入，不覆蓋片段；包含換行、中文、emoji、帶樣式及純文字。
- 既有文字、新貼上建立的文字、明確關閉行內格式、自訂字體／顏色／底線，及本機保存重開皆維持正確；沒有新增持久化欄位。
- JS 語法與 Git 差異檢查通過，瀏覽器沒有 pageerror。

初次測試遇到無關的後端啟動未就緒；這兩份純前端測試改用 `helpers/static-ui-server.js` 提供正式靜態資產及 vendor 路徑，獨立 Edge 使用測試本機草稿，不連線私人雲端資料，也不啟動編譯工作者。
