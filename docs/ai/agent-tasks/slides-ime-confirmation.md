# 中文組字確認後清除虛線

## 重現與原因

文字物件的中文組字虛線，在 Enter 確認後仍可能殘留。Fabric 5 的 onCompositionEnd 只關閉 inCompositionMode；若沒有隨後的 input／重畫，既有圖層沒有立即清除。專案的虛線位置也可能超出 Fabric _clearTextArea 的局部清除範圍，使游標閃爍仍留下部分像素。這是暫時組字標記，不是文字的 underline 樣式。

隔離測試先重現失敗：compositionend 後上層畫布仍有 83 個測試用洋紅色組字像素，預期為 0。

## 修正

在既有 Fabric 組字相容層補上 compositionend 收尾，沿用 Fabric 原處理後：

- 原生 textarea 與物件文字一致時，將目前 UTF-16 選取換算為 Fabric grapheme 選取，保留正確游標，不改寫文字或強制全選。
- 重設前次組字範圍，重新啟動游標並清除暫時選字圖層，立即重畫游標及同步編輯鏡像層。
- 不等待下一個 input，也不修改使用者文字底線、樣式、縮放、旋轉或儲存格式。

前端 slides-289；只更新 intergration，保留 main／公開部署。

## 驗證與限制

新增 slides-ime-commit.browser.test.js，以獨立靜態服務及隔離 Edge 模擬 DOM 組字／Enter 確認事件，實際檢查畫布像素、鏡像層及游標狀態。涵蓋沒有後續 input、有後續 input、空資料組字結束、連續組字、確認後繼續打字、舊有縮放／旋轉／自訂顏色／文字底線、新建物件，以及儲存重開後再次組字。

本測試沒有控制 Windows 真正的輸入法候選視窗；原生輸入法、作業系統與瀏覽器的完整組合仍需使用者操作核實，不宣稱涵蓋所有 IME。

上述新增案例及以下相關檢查共 4 檔／4 案例通過：slides-text-undo.browser.test.js（含組字與最終 input 去重）、cursor-blink.browser.test.js、entrypoints.test.js；依 V1 只跑直接相關小測試，不執行演算法驗證集。JavaScript 語法與差異檢查另於提交前完成。

## 現成編輯套件評估

目前已使用 Fabric IText／Textbox 處理畫布文字。Lexical 與 Tiptap 可處理 DOM 富文字編輯；若未來採用，需另設 HTML 編輯層，整合文字樣式、選區、座標、縮放與 Fabric 序列化，不能直接把現有 canvas 文字替換成套件而不做轉換。本次只修復既有輸入生命週期，不引入新依賴。

- Lexical 官方介紹：https://lexical.dev/docs/intro
- Tiptap 官方介紹：https://tiptap.dev/docs/editor/getting-started/overview
