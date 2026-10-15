# 等比縮放吸附固定整體尺寸

問題：Fabric 先執行等比縮放，`applyFabricResizeSnap` 卻將 X／Y 軸分別修正，靠近對齊線時破壞比例。修正前的真實角落拖曳測試已重現比例斷言失敗。

修正：辨識目前是否為等比角落縮放，選擇最近的對齊線，用同一倍率修正雙軸。吸附後在該次 transform 暫存完整位置與尺寸；滑鼠沿同一條線移動時保持整體幾何，垂直離開既有 8px 投影片座標吸附範圍後解除鎖定。螢幕判定依畫布顯示比例換算，無須把鎖定狀態存入物件或投影片。

切換回自由縮放或使用既有略過吸附的修飾鍵會清除暫時鎖定；文字框寬度調整與 code 原有非等比邊界行為維持原規格。

## 驗證

- V1／B，使用 algoshowmaker-regression 的局部介面驗證；未執行演算法動畫驗證集。
- `node --test tests/proportional-resize-snap.browser.test.js tests/code-boundary-resize.browser.test.js`：code 驗證通過；新增案例先查出重開資料以寬高表示縮放的既有序列化契約，再以可見尺寸核對。
- 最終 `proportional-resize-snap.browser.test.js` 通過，包含水平／垂直吸附、沿線固定尺寸、離開後繼續等比縮放、自訂原比例、自由縮放仍可獨立調整、保存重開及無 pageerror。
- `code-boundary-resize.browser.test.js` 已通過，新建與舊 code 的角落／邊界、字體大小及自訂設定保存重開均正確。
- 形狀保存時會把 scale 烘入尺寸、依 Fabric 設定精度序列化；重開驗收比較實際位置與寬高，沒有要求內部編碼必須相同，也沒有放寬吸附與沿線鎖定的幾何斷言。
- 獨立靜態服務、Edge、測試本機草稿，不操作私人資料。JS 語法與差異檢查通過。
