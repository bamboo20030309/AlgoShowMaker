# 第三方授權

AlgoShowMaker 自有程式碼採用根目錄的 [MIT License](LICENSE)。第三方程式碼保留原作者版權與各自授權，不因整合進本專案而改成 AlgoShowMaker 的授權。

## 閱讀與下載

- 網站入口：首頁底部的「第三方授權」，網址 `/licenses/`。
- [完整授權原文](algo-vis-backend/public/licenses/third-party-notices.txt)：包含各套件版權、條款、免責聲明及隨套件提供的 NOTICE。
- [套件與授權資料](algo-vis-backend/public/licenses/components.json)：依鎖檔列出精確版本與來源，含間接、可選依賴及開發工具；實際安裝與傳送範圍依環境而異。

授權原文保留原始語言，導覽與說明使用中文。`public/licenses/` 隨網站與後端部署檔交付，不依賴登入，也不需要開發環境的 node_modules 才能讀取完整聲明。

## 前端主要套件

| 套件 | 版本 | 授權 |
| --- | --- | --- |
| Ace Editor | 1.44.0 | BSD-3-Clause |
| Fabric.js | 5.3.0 | MIT |
| Reveal.js | 6.0.1 | MIT |
| KaTeX（包含隨附字型） | 0.16.22 | MIT |
| iro.js | 5.5.2 | MPL-2.0 |
| iro-core（iro.js 內含） | 1.2.1 | MPL-2.0 |
| highlight.js（Reveal 程式反白外掛內含） | 11.11.1 | BSD-3-Clause |

iro.js 內含的 Preact 與其餘間接依賴也列入完整聲明。後端的 Express、Lezer、Mongoose、JWT、bcryptjs、dotenv、Nodemailer 等，以及開發使用的 Playwright、fake-indexeddb、Acorn，均按其鎖定版本分別記錄，不用同一份 MIT 文字代替所有套件聲明。

## MPL 對應原始碼

目前使用 npm 原版，未修改 iro.js／iro-core 程式碼。以下提交由各精確版本的 npm `gitHead` 核對，可取得供修改的原始碼；完整 MPL-2.0 條款附於授權清單。

- [iro.js 5.5.2](https://github.com/jaames/iro.js/tree/1825363da88e1971befb6c6b827951594f388798)。
- [iro-core 1.2.1](https://github.com/irojs/iro-core/tree/bd46ac36225cc4de5ea2a8453cec4f69b8f40ba6)。

來源註記：iro.js 的 npm 5.5.2 發布資料記錄上述 gitHead，但該提交的 package.json 仍標為 5.5.1。連結依發布者的提交對應提供，內含完整 TypeScript 原始碼；保留這項上游版本標記差異，不將舊版標記改寫成 5.5.2。

日後修改 MPL 涵蓋的檔案時，需提供相應修改後原始碼及來源說明；升級時必須重新核對原始碼連結，不能沿用舊版本提交。依據見 [Mozilla MPL FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/#q16-is-minified-javascript-source-code)。

## 維護方式

在 `algo-vis-backend` 執行：

```bash
npm run licenses:generate
npm run licenses:check
```

第一行從已安裝的套件與已核實的既有聲明重新生成網站資料；第二行核對鎖檔與聲明是否一致。新增缺少原文的依賴時，用 `npm run licenses:generate -- --fetch-missing`，工具只下載並校驗 npm 包以讀取授權，不執行其安裝腳本；缺少授權會明確失敗，不自動補上假設的授權。

公開部署、發行下載包與 Docker 映像前應執行上述檢查。保留套件原本的授權註解與 LICENSE／NOTICE，不以此索引取代原文。作業系統、Node.js、g++、MongoDB、Nginx 與獨立瀏覽器的授權另隨其官方發行包處理；本清單範圍為應用程式 npm 依賴與前端內含元件。

## 舊套件授權補充來源

- saxes 5.0.1 的 npm 包未附授權原文；從原作者 v5.0.1 對應的固定提交補入 LICENSE，來源記錄在套件資料中。
- tr46 0.0.3 宣告 MIT，但 npm 包及該次提交未附授權文字。保留版本與授權宣告，另附原作者現行專案固定提交的 MIT 原文作補充，明確標記來源；不宣稱該文件取自 0.0.3 發布包。
