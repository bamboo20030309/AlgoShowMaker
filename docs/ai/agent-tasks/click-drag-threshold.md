# 小幅位移點擊與文字雙擊

- 物件本體拖曳以螢幕 CSS 像素判斷：位移不超過 6px 不啟動拖曳，超過後依原有拖曳／吸附路徑移動。Fabric 主畫布、widget 的 Fabric 選取框及 DOM widget 拖曳使用同一門檻，不隨投影片縮放改變手感。
- 同一文字物件的相鄰點擊在 350ms、6px 內可辨識為快速雙擊；直接進入文字編輯並將游標收合至點擊位置，不選取整個單字。瀏覽器原生 dblclick 亦使用相同游標行為。
- widget 選取框未真正拖動時不再吞掉後續 click；保留 code 雙擊開啟編輯欄、structure 雙擊進入格子文字編輯的路徑。
- 角落／邊界縮放、旋轉與文字編輯時的原生文字選取不套用物件本體拖曳門檻；`editable: false` 保留。

## 驗證

層級 V1／B，依 algoshowmaker-regression 選擇局部操作，未執行演算法動畫驗證集。獨立靜態伺服器與 Edge 使用測試草稿，不操作使用者分頁。

- `slide-click-drag.browser.test.js`：小幅晃動雙擊、游標與續打、形狀微移不拖動、超過門檻正常拖曳、唯讀文字、widget 原生拖曳、code／structure 編輯、新建文字及保存重開，通過。
- `slide-navigation-selection.browser.test.js`：方向鍵切頁清除選取及文字編輯方向鍵，通過。
- `code-boundary-resize.browser.test.js`：新建／舊 code 的角落與邊界調整、字體大小、自訂值及儲存重開，通過；純前端案例改用既有靜態服務 helper。
- 3 案例通過，無失敗或略過；瀏覽器沒有 pageerror。JS 語法及差異檢查於提交前執行。
- 舊物件不需新增欄位；原本自訂色彩、縮放及不可編輯設定保留。新的門檻與雙擊處理只屬於編輯器互動，不寫入投影片檔。
