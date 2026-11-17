# 第三方授權交付

## 結果

- 根目錄 THIRD_PARTY_NOTICES.md 分開說明本專案 MIT 與第三方授權，README 提供入口。
- public/licenses/ 提供匿名可讀頁面、下載用完整原文、含授權原文的精確套件資料及本專案 MIT 文字；共 225 個不同套件版本，涵蓋鎖檔直接／間接／可選／開發依賴及 KaTeX、Reveal 內含的 highlight.js。
- 首頁底部新增「第三方授權」，位於登入與訪客視圖之外。授權頁提供 iro.js／iro-core 固定 gitHead 原始碼連結與完整 MPL-2.0。
- 補上原本 404 的 Reveal／Fabric／iro 授權網址，只提供三個明確檔案，不開放 node_modules 任意讀取。
- licenses:generate 可離線重建；--fetch-missing 只下載 npm 包並校驗鎖檔完整性以讀取文件，不安裝或執行第三方程式。licenses:check 檢查鎖檔指紋與聲明資料是否存在，升級 MPL 版本需人工核對原始碼連結。

## 來源差異

- saxes 5.0.1 發布包缺少原文，從官方版本標籤對應的固定提交補取 LICENSE。
- tr46 0.0.3 宣告 MIT，但其發布包及該提交缺少原文；附原作者目前專案固定提交的 MIT 文字作補充並明確標記，不冒稱出自舊包。
- iro.js npm 5.5.2 的 gitHead 指向 1825363da88e1971befb6c6b827951594f388798，該提交 package.json 仍標示 5.5.1。已核對 npm 發布資料與提交中的 TypeScript 原始碼，文件及網站如實註明版本標記差異；iro-core 來源內版本為 1.2.1。
- 作業系統、Node.js、編譯器、MongoDB、Nginx 及獨立瀏覽器不屬於本次 npm／前端授權包範圍，隨各官方發行包處理。

## 驗證

V1：隔離服務、獨立瀏覽器測試通過，涵蓋未登入首頁入口、225 項完整資料、MPL／Apache／原作者版權文字、六個授權網址 200、實際下載原文逐字一致、390px 手機寬度無水平溢出、無 pageerror。未操作使用者分頁或資料，未跑演算法驗證集。

產生器離線重建的四份輸出雜湊一致；鎖檔檢查與 JS 語法及 git diff --check 通過。測試截圖在被忽略的 test-results/third-party-notices.png。

交付只推送 intergration；不合併 main 或發布 release。3100 按整合規則重啟並核對授權頁與原先缺少的授權端點。
