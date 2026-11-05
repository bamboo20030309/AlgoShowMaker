# 格子 style 隨縮放與移動，並重跑公開 Trace

後續使用者指出合併排序第 11 幀仍有 mark 問題，已另行重現並修復巢狀 keep style 層的更新缺口，見 [第 11 幀修正紀錄](merge-kept-mark-motion-2026-11-05.md)。本紀錄的原驗證範圍不包含該巢狀層，不能作為所有 mark 路徑都正確的證據。

## 修改

使用者要求格子放大／縮小／移動時，其 style 同步變換，並重新執行所有 Trace。

普通格子的背景與 focus 已在格子內；highlight、point、mark 則在前景 style 層，以格子的實際顯示矩陣追隨。實際重現的缺口是事件以 `cloneNode` 建立臨時格子時，外層 style 不在格子子樹中，因此複本漏帶 style。

- 增加共用的格子局部 style 模板與複製入口，用於自我比較複本、整格賦值與陣列入場複本。style 與格子共用同一個 transform，不設另一套位移或縮放計時。
- 前一幀的 style 模板暫存在捕獲物件的記憶體欄位；不寫入 Trace／投影片，不要求舊物件新增欄位。捕獲時先按實際 cell 建索引，不為每個格子重掃整個 DOM。
- 不將模板提前插入量測用的格子，避免 point／mark 擴大格子量測尺寸；臨時 style 移除 ID、物件 key 與定位綁定，避免重複選取或錯綁另一個同名 keep。
- 格子原有背景、focus、邊線與數字照原子樹繼承變換；外掛 style 轉成局部座標後加入臨時複本。比較結果／讀取強調等事件暫存框不當成作者 style 複製。
- 只搬移數字的運算賦值維持數字動畫；整格複製才帶來源格子的 style。落地仍保留目標既有樣式。

## 驗證

- 新增 `tests/style-cell-motion.browser.test.js`：先重現自我比較漏帶 style，修正後通過。一般陣列與二維矩陣各驗證新 Trace／IndexedDB 保存重開且缺少 semantics 的舊 Trace，1 倍／2 倍、放大與縮小、自我比較，共 16 組比較情境；核對完整 SVG 矩陣、兩份複本的 point／mark／highlight、自訂色與清理，另驗證兩種 render 的整格賦值在飛行中有來源 style。
- `style-layer.test.js` 三項通過：前景層順序、放大與改變尺寸、索引列高度、交換呈現格子與比較框。
- `declaration-cell-copy.browser.test.js` 通過：初始化整格複製及保存重開。
- `merge-push-lifecycle.browser.test.js` 兩項通過：空容器與遞迴合併排序的來源格子、數字、索引及名稱。
- `retained-hint-owner.browser.test.js` 通過：1 倍／4 倍手動與自動播放、同 alias 的 keep 歸屬、自訂色與明確關閉設定。
- JS 語法與 Git 差異檢查通過。測試使用獨立服務與瀏覽器，不覆蓋使用者頁面或私人投影片。

## Trace 重建

獨立服務執行 `scripts/build/prebuild-guest-decks.js --force`，實際強制編譯執行 15 份公開教材的全部 36 份動畫，共 2487 幀，不使用原編譯快取。預設線篩的獨立第一幀預覽、116 幀完整動畫與 manifest 一併重建。

- 36 個目前引用 ID 全部更新；`.asmdeck` 保持只存引用，不嵌入完整 Trace。
- 程式碼、輸入、traceView、靜態教材與封面資訊逐份比對均保持；封面 contentHash 正確更新為新內文雜湊。
- 36 個新 ID 與 116 個舊 ID，共 152 份資源的內容雜湊正確；舊引用仍能取得原結果，不覆寫成新內容。
- 實際瀏覽器透過 HTTP 載入 36 份新 Trace，逐份保存／讀回 IndexedDB，再查看首／中／末幀，共 108 次跳幀通過，無瀏覽器錯誤。
- `sample-trace-assets.test.js` 與 `default-algorithm-assets.test.js` 七項通過。

本次重跑的是目前公開教材的 Trace；歷史 ID 保留原始內容，不操作私人雲端投影片或瀏覽器草稿。詳細執行與完整性報告位於被忽略的 `algo-vis-backend/test-results/style-motion-refresh-2026-11-05/`。

## 交付

更新前端快取版本：tween trace-314、renderer trace-275、slides-304、內嵌 runtime-60。只推送 intergration，驗證後核對來源並重啟 3100；main／3000 與 release 維持原狀。

3100 已核對來源並重啟為 PID 33364。algorithm.html、slides.html、slides.js、trace-renderer.js、trace-frame-tween.js、Trace 索引與預設動畫 manifest 均 HTTP 200，HTTP 內容雜湊與本次 worktree 一致。
