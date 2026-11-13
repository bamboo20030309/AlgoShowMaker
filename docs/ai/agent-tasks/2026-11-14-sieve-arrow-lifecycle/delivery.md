# 線篩指令箭頭的生命週期

## 原因與修正

createDirectivePresenter 在事件播放期間建立可隨變數變化的箭頭投影，並隱藏原箭頭；跨幀 tween 仍控制原箭頭。因此第3→4幀，隱藏箭頭 opacity 有淡入而可見投影直接 opacity=1；第6→7幀隱藏箭頭端點正在內插，可見投影卻直接使用新端點。

共用 presenter 讓可見箭頭承接原箭頭跨幀的 _asmArrowTween 物件，並在每次生命週期更新後同步透明度及 draw-in 屬性，再刷新端點。若有實際事件時間範圍，保留該事件內的獨立端點追蹤；零時長事件不得覆蓋跨幀位移進度。移除 presenter 時照原流程還原原箭頭。

## V2 局部驗證

新增 sieve-arrow-lifecycle.browser.test.js，input=100，以實際 SVG 可見性排除隱藏來源，核對第3→4幀兩支淡入、第6→7幀兩支端點有中途位置、第4→5幀退場淡出。新 Trace、JSON 重開、事件明確關閉，1x/4x，全部通過且無 pageerror。初次測試抓出零時長更新仍蓋掉跨幀進度，修正後重跑通過。

JS 語法及 diff 檢查通過。這次只修呈現，不更動來源指紋或重跑公開 Trace，不變更使用者線篩程式。renderer trace-291、tween trace-365、iframe trace-runtime-125。
