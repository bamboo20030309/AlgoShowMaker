# 恢復常數與不可見來源的下落

使用者確認常數與不可見來源應恢復上方落入。createLiteralAssignmentTransfer原本只更新opacity、不更新位置，現在在原transfer階段，從目標上方max(24px,目標高度×0.8)向下移至正確錨點，伴隨淡入；沿用既有500ms傳遞時長，不增加事件或等待。

涵蓋普通賦值與複合賦值的常數、不可見來源回退。保留原來源數字及實際提交結果；例如5+=3仍呈現來源3，再提交8，不新增公式面板。可見來源複製、純常數宣告入場、指標專用路徑及push_back格子入場未改。

多欄位仍先騰位並呈現逗號／正號，數字對準自己的數字字元位置下落，不回到整格中心；原值遮罩及提交清理保留。

## 驗證

- 新增constant-assignment-drop.browser.test.js：=3、+=2、=hidden及+=hidden，1／4倍速逐tick確認來源數字3／2／7／7、垂直位移超過20px且單調往下、水平錨點不偏移，最終正式值14且沒有殘留副本。
- multi-field-replay.browser.test.js新增下落的幾何標準，改用包含入場透明階段的完整軌跡，確認24px起點到正確基線；保留欄位左右位置、字級、逗號／正號先行、防重疊與儲存重開。垂直定點斷言依本次授權改為下落軌跡，沒有放寬水平定位。
- 既有literal and hidden operands及binary and compound兩項算術測試通過，來源值不被結果取代。

共4項不同定向測試通過，語法與差異檢查通過；未跑完整V3。隔離服務與瀏覽器，不操作使用者頁面；test-results與log不提交。

同步tween trace-340、slides-343、runtime-98快取，推送intergration並重啟3100。不改Trace格式、後端生成指紋、main／3000或Release。
