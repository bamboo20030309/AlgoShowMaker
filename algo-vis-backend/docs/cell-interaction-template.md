# 格子互動共用模板

共用模組：`public/slide-cell-interactions.js`。`slides.js` 的 table、矩陣、陣列、樹及其他 structure 格子使用同一個控制器，不各自增加鍵盤或貼上監聽器。

## 新物件如何接入

1. 提供穩定的格子 key 與讀取結果：`{ key, context: { value, row?, column? }, ... }`。二維格子提供 row、column；樹用節點 ID 作 key。
2. 使用 `ASMSlideCellInteractions.selectKeys(details, previous, items, modifiers)` 計算單選、Shift 範圍與 Ctrl／Cmd 多選；items 必須是實際顯示順序。
3. 用 `ASMSlideCellInteractions.create(adapter)` 建立控制器。adapter 提供 `enabled()`、`selected()`、`edit(details)` 和 `write(details, value)`；只有 write 負責物件自身的資料格式。
4. 共用事件層呼叫 `type(event)`、`paste(text)`；編輯完成呼叫 `commit(details, value)`。不要再次註冊重疊的輸入流程。

## 行為契約

- 選取格子後直接打字取代內容；保留瀏覽器原生輸入與 IME，不合成第一個字元。
- 雙擊開啟既有文字並定位游標；輸入框內的複製貼上與文字編輯保持原生行為。
- 選取格子貼上純文字寫入該格子；沒有選格子時沿用一般文字物件貼上。
- Ctrl／Cmd 快捷鍵、其他輸入欄位、展示與總覽模式不被格子輸入攔截。
- 值未變更時不提交；變更值不重設手動尺寸、位置、顏色或明確關閉設定。
- 格子資料 key 應能在重繪後還原選取，避免保存舊 DOM 參照。

## 接入驗證

驗證新建與舊物件的單選、多選、直接輸入、第一字元、IME 起始事件、貼上、雙擊游標、快捷鍵及儲存重開；保留自訂樣式與明確 false 設定。table 案例在 `tests/table-cell-template.browser.test.js`，其他格子案例在 `tests/structure-cell-typing.browser.test.js`、`tests/structure-cell-paste.browser.test.js` 與 `tests/structure-cell-multiselect.browser.test.js`。
