# 群組選取內的雙擊

多物件選取時，Fabric 命中判定可能返回整個 ActiveSelection，而混合選取另有 Fabric 控制畫布攔截事件。雙擊現在先依實際位置及圖層順序核對真正的 Fabric 物件／widget，再解除多物件選取並單獨選取命中物件。

- text 同時進入編輯，將游標收合於點擊位置；沿用前次 6px／350ms 小幅位移雙擊判定。
- shape 只改為單獨選取；code 與 structure 保留各自既有雙擊編輯入口。
- 空白未命中時不強行拆選取；保留修飾鍵操作、不可選取／不可互動物件設定。
- 解除 ActiveSelection 由 Fabric 正常流程還原世界座標，不改動群組成員的排版。

## 驗證

- V1／B，使用 algoshowmaker-regression 的局部流程，未跑演算法驗證集。
- `node --test tests/group-double-click.browser.test.js tests/slide-click-drag.browser.test.js`：2 案例通過，無失敗或略過，無 pageerror。
- 核對純 Fabric 群組、混合 text／structure／code、選取文字並插入游標、形狀單選、widget 編輯與保存重開；比對全部 Fabric 成員的世界變換矩陣，位置、角度及縮放不變。
- 既有小幅位移點擊、唯讀文字、新建文字、正常拖曳及保存重開驗證通過。
- 獨立靜態 Express 與 Edge，使用測試本機草稿，不操作私人資料；無新增投影片持久化欄位。JS 語法與差異檢查於提交前執行。
