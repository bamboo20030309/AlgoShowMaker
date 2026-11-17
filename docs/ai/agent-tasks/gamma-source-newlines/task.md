# gamma-source-newlines：CRLF 原始碼解析修正
- 代理：gamma；狀態：待交付；分支：codex/2026-09-22-gamma。
- 基準：4944586f065ba6c510b9afcc7662914d38f98b7f；開始時乾淨。
- Worktree：C:/Users/user/Documents/Codex/2026-07-29/algoshowmaker-main-commit-d154dd5-slides-html/work/AlgoShowMaker/.worktrees/2026-09-22-gamma

## 需求與調查
使用者要求將原始碼統一LF，修正Lezer對CRLF include的錯誤。最小案例已重現LF43節點0錯誤、CRLF8節點3錯誤。無待確認問題。
編輯器輸出採unix換行；共用normalizeSource用於後端analyze、syntax-tree、compile及三個核心解析／插樁入口，offset、行號及trace.sourceCode均以LF為準。
不修改已儲存trace事件或對舊資料做整批遷移。舊程式碼載入後編輯器自動LF，重RUN生成一致定位。

## 修改邊界
source-normalization.js、trace-instrumenter.js、server.js、front.js、algorithm資產版本及相關局部測試。無其他代理依賴。

## 驗收
- [x] LF、CRLF、混合及單獨CR，KMP語法樹與指令定位一致。
- [x] KMP的include、中文與字串可正常解析／編譯；換行連接巨集與raw string的正規化及定位結果一致。
- [x] API直接收到CRLF仍成功，trace.sourceCode為LF且source.from/to對應正確。
- [x] 編輯器載入CRLF及舊trace／自訂false存檔重開保持正確。

## 驗證計畫
V2：新建直接相關換行小測試，自行啟動隨機埠及獨立Edge；以KMP少量輸入驗證前後幀与Studio高亮。不跑全regression。完成commit、push及自己的3103重啟。

## 變更紀錄
2026-10-07：初始定義。

2026-10-07：四種換行解析／插樁與隔離API／Browser驗證通過，3103啟動，待主代理核實。
