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

### 注意事項
- `.env` 檔案請參考 `.env.example` 進行設定。
- 專案使用 Vite + React + TypeScript 架構。
- 為了確保跨平台相容性，`clean` 腳本使用了 `rimraf`。
