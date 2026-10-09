# Ace 繪圖指令提示第一版

## 任務與範圍

輸入 @ 叫出起始指令，選定後再顯示同一行後綴，提供人讀的指令清單與實際畫面。本輪屬 V1 編輯器介面修改，不修改 Trace、指令解析器或投影片格式。

## 交付

- 使用本機 Ace language_tools 原生補全視窗，保留右鍵三層範例。
- 裸 @ 與既有 // @ 都能叫出清單；裸 @ 選定後自動補成 C++ 註解。
- 起始指令與後綴分開；with、render 繼續提示下一層選項。
- Tab、Enter、上下選取、原生捲動及 Esc；文字引號內不跳出繪圖補全。
- 一般 C++ 保留關鍵字與文字基本補全來源，不提供完整 C++ 語意 IntelliSense。
- docs/繪圖指令清單.md 列出 26 個起始指令、別名、畫法、with 選項、位置與運算，附兩張隔離瀏覽器截圖。
- ext-language_tools.js 取自已安裝 ace-builds 1.44.0，隨附 BSD 3-Clause LICENSE，不依賴 CDN。

## 核實

node --check、git diff --check；directive-assist.test.js、directive-assist.browser.test.js、entrypoints.test.js 共 5 個案例通過。獨立臨時服務與 Edge 驗證裸 @、舊寫法、分層選單、Tab 插入、選取後捲動、Esc、C++ 縮排、字串排除與右鍵範例，無 pageerror。不執行大型演算法驗證。

## 限制

變數、索引、條件與 preset 名稱仍由作者填寫，最終合法性由原有解析器核實。尚未加入依 C++ 語意推斷可見變數的補全。
