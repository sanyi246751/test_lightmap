# 路燈地圖 (Test Lightmap)

這是一個使用 Vite + React + TypeScript 建立的專案。

## 專案開發指引

### 環境設定
確保已安裝 Node.js (建議 v18 以上)。

1. **安裝套件**
   ```bash
   npm install
   ```

2. **本地開發**
   ```bash
   npm run dev
   ```
   瀏覽器開啟 [http://localhost:3000](http://localhost:3000)

3. **生產環境編譯**
   ```bash
   npm run build
   ```
   編譯後的檔案將存放在 `dist` 資料夾。

### CI/CD 部署
本專案已設定 GitHub Actions 做自動化部署。
- **自動部署**：當程式碼 push 到 `main` 分支時，會自動進行 Lint 檢查、編譯並部署至 GitHub Pages。
- **手動觸發**：可從 GitHub Repo 的 `Actions` 頁面手動執行 `Build and Deploy` 流程。

### 後端 Google Apps Script (GAS) 設定
本專案搭配 Google Sheets 與 GAS 進行查修通報。

1. **腳本位置**：專案中的 `scripts/google-apps-script.js` 包含通報腳本。
2. **部署方式**：
   - 在 Google 試算表中開啟「擴充功能」 > 「Apps Script」。
   - 貼上腳本內容。
   - 設定觸發器：選擇「提交表單時」執行。
3. **安全建議**：
   - 腳本已優化為從 `PropertiesService` 讀取 Token。
   - 請在 GAS 專案設定中的「指令碼屬性」加入 `LINE_CHANNEL_ACCESS_TOKEN` 與 `LINE_GROUP_ID`。
   - 這種方式比直接在程式碼中硬編碼 Token 更安全，且能避免 Token 外洩至 Git。
