# 退場指標箭頭座標修正

## 根因與修改

堆積排序一般例第 13→14 幀，i／largest 原本是直向箭頭。退場副本加入共同指標排程後不在 finalState，原先只依 finalState 計算的座標 bias 漏掉這兩個副本。初始布局分別算出 x=295／321，實際標籤 x=335／361；程式覆回標籤舊位置，卻仍用少 40px 的端點，因此一開始就左轉。

- pointer model 明確提供錨點模式，renderer 暫時公布實際端點（含 layout offset）；舊 Trace 重畫即可取得，不增加保存欄位。
- outgoing 指標依 initialState 校正，標籤與端點同時接手原呈現座標；一般格子固定錨點與 heap 標籤水平對齊模式分開處理。
- 箭頭重算保留 renderer 的起點，矩陣列指標不再被套用上方標籤的底邊起點。
- 事件提交後更新 live 指標的呈現端點，下一幀退場不使用提交前的舊位置。仍使用原事件位移／讓位／退場時鐘，不以凍結所有箭頭來掩蓋錯誤。

## 驗證

隔離服務與獨立 Edge，未操作使用者分頁。

- 新增 `pointer-exit-arrow.browser.test.js`：heap 第 13→14 幀 1／4 倍速，i／largest 實際離場副本的 shaft 保持向下，包含有效透明度低於 0.9 的真實淡出取樣，結束後舊 lifetime 消失。
- 同檔矩陣 row 退場：實際箭頭全程向右、連接起點不變，不能變成從標籤底部出發的上方箭頭。
- `pointer-event-reflow.browser.test.js` 與 `pointer-model.test.js` 通過，涵蓋選擇排序初始化、快速排序退場、宣告／移動／純顯示移除、矩陣與延後替換入場。
- 合計 15 項通過；語法與差異檢查通過。未跑完整 V3，未宣稱所有 render × 事件組合全覆蓋。

前端版本更新後推送 intergration，重啟及核對 3100。Trace 產生依賴沒有改動，原公開 Trace 不需重跑。main／3000、Release 與公開部署不變。
