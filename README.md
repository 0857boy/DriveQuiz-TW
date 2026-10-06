# DriveQuiz TW · 駕照刷題

台灣普通汽車駕照筆試複習網站。React、TypeScript、Vite、Zustand、Zod，純前端部署在 GitHub Pages，不需會員或資料庫。

## 開始使用

需要 Node.js 24。

```sh
npm ci
npm run dev
```

開啟 http://127.0.0.1:5173 。

```sh
npm run bank:check
npm test
npm run test:e2e
npm run build
npm run preview
```

E2E 預設使用 Windows 本機 Chrome，其他環境請在 `playwright.config.ts` 移除 `executablePath`，並執行 `npx playwright install chromium`。

## 模擬測驗規則

- 30:00 倒數；85 分（含）以上及格。設定集中在 `src/config/exam.ts` 的 `EXAM_CONFIG`。
- 模擬練習抽 50 題，各 2 分。作答中不公布答案，允許修改與題號跳轉。
- 計時根據開始時儲存的絕對截止時間。切到背景、重新整理、回首頁、關閉瀏覽器都不會暫停。逾時再次開啟時自動交卷。
- 提前交卷先顯示確認與未作答數；交卷後凍結剩餘時間，顯示分數、及格狀態、答對／答錯／未作答數、分類分析與原題正解。
- 未作答計 0 分，與「答錯」分開列示。模擬考交卷才寫入作答紀錄；重新整理結果不重複記錄。

官方來源：[30 分鐘、85 分](https://tpcmv.thb.gov.tw/cp.aspx?n=9438)、[2026/6/30 新制公告](https://www.thb.gov.tw/News_Content_table.aspx?n=12181&s=300189)。

**範圍限制：**新制正式考試有 50 題，包含 5 題危險感知影片題。本專案使用使用者提供的 `題庫pdf/115_5_29.pdf`，共有 1,090 題文字／圖示選擇題。影片題尚未取得，出題比例也未對齊官方配比，因此網站明確標示為文字／圖示模擬練習，並連結[官方模擬考](https://www.mvdis.gov.tw/m3-simulator-drv/)。不能稱為完整重現正式試卷。

## 已實作

- 首頁今日目標、題庫進度、穩定掌握數、依真實紀錄建立的弱點。
- 智慧複習：有足夠候選題時，50% 弱點／到期、30% 已學、20% 新題；候選不足時補滿最多 20 題。抽選無重複題。
- 弱點特訓直接列出所有答錯過的題目，顯示累計答錯次數並由高到低排序；同次數依題號排列。之後答對不會清除累計次數。可依此順序練習前 20 題，或單獨練習某題。
- 官方三大架構分類練習、收藏練習。
- 間隔複習：答對後 1／3／7／14／30 天；答錯降低兩個 level，最低 0（立即到期供下一次練習抽選）。尚未加入同一 session 中隔四題重測。
- 掌握度考慮作答次數與時間；分類掌握度包括未作答題，避免首次猜中就顯示 100%。
- 完整題庫搜尋、錯過的題、收藏、未作答與圖示篩選。
- 本機保存、未完成練習恢復、匯入／匯出 JSON 備份、清除前確認。
- 深色模式、文字放大、高對比、鍵盤快捷鍵、減少動畫偏好、原生可鍵盤操作的對話框。
- PWA：首次完整載入、service worker 安裝後，快取網站程式、題庫和全部圖示；離線字型使用系統字型。

沒有編造學習數據或官方解析。回饋顯示 PDF 官方正解、來源頁碼與關鍵字標籤；更詳細的人工解析尚未編寫。

## 題庫轉換與品質

```sh
npm run bank:build
npm run bank:check
```

`scripts/build-question-bank.mjs` 在開發階段使用 pdfjs 擷取文字與答案，讀取圖示座標並從高解析渲染裁出 WebP。保留題號、架構、分類、來源頁碼、版本與內容 fingerprint。圖示選項題保留組合圖與原有選項編號。`bank:check` 檢查全部題號、選項、答案、分類與圖檔路徑。

題庫存放 `public/questions/questions.json`，圖示存放 `public/images/questions/`。只將使用者紀錄放入 `drivequiz:state:v1` LocalStorage（含 schemaVersion）。有改動內容或圖片的題目會透過 fingerprint 清除舊進度；缺失題號的活動 session 會移除。只支援 v1 備份，未知版本拒絕匯入並保留既有紀錄。作答紀錄保留最近 5,000 筆、session 最近 200 筆。

已做完整結構驗證及代表頁面／圖示視覺抽查，**未宣稱每道題都經人工校對**。正式公開前應逐題校對圖片對應與文字內容，尤其圖片選項題，並補齊危險感知影片題與官方出題配比。

## GitHub Pages

`HashRouter` 搭配 Vite 相對 base，不需伺服器路由改寫；專案子路徑也能重新整理。

在 GitHub Repository → Settings → Pages 將 Source 設為 **GitHub Actions**。推送到 `main` 時，`.github/workflows/deploy.yml` 會驗證題庫、跑單元測試、建置並部署 `dist/`。其他主分支名稱請修改 workflow。此工作區已提供部署設定，尚未推送或發布。

## 後續擴充

補齊官方影片題與出題比例、同 session 延遲重測、人工題目解析、AVIF 與 PNG 安裝圖示、完整無障礙稽核。
