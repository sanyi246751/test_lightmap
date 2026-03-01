# 🏮 三義鄉公所路燈管理與置換系統 (Sanyi Lightmap)

[![Vite](https://img.shields.io/badge/Vite-6.2.0-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![React](https://img.shields.io/badge/React-19.0.0-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.0-38B2AC?logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

這是一個專為 **苗栗縣三義鄉公所** 量身打造的路燈管理與維修通報系統。整合了 GIS 地理資訊、Google Sheets 自動化後端與即時影像回傳功能，旨在大幅提升路燈修繕的行政效率。

## ✨ 核心特色

- **📍 智慧地理視覺化**：整合 Sanyi Village GeoJSON 邊界資料，動態呈現各村里路燈分佈與狀態。
- **🛡️ 角色分權系統**：
  - **承辦人員**：編號快速查詢、查看待修清單、發起通報。
  - **維修人員**：精準定位故障點、查看案件詳情。
  - **管理單位**：路燈資料置換助手 (Replacement Helper)，支援批次更正與村里別自動判定。
- **⚙️ 自動化編號邏輯**：系統會根據路燈座標自動判斷所屬村里並生成編號；超出邊界之路燈則自動歸類為特殊 ID。
- **📸 影像化查修追蹤**：支援現場照片即時上傳至 Google Drive，並同步連結至歷史紀錄表單。
- **📊 雲端異動軌跡**：所有修改均會記錄在「路燈置換資料」中，支援異動還原與歷史查閱。

## 🛠️ 技術架構

- **Frontend**: `React 19` + `TypeScript` + `Vite`
- **Styling**: `Tailwind CSS 4` + `Framer Motion` (流暢動態 UI)
- **Map Library**: `Leaflet` & `React-Leaflet` (地圖渲染與點位聚合)
- **Backend**: `Google Apps Script (GAS)` (提供 RESTful API 介面)
- **Database**: `Google Sheets` & `Google Drive` (照片存儲)

## 🚀 快速上手

### 1. 本地開發
確保你的 Node.js 版本為 v18 以上。
```bash
# 安裝套件
npm install

# 啟動開發環境
npm run dev
```

### 2. 環境變數
建立 `.env.local` 並設定管理密碼：
```env
VITE_ADMIN_PASSWORD=你的密碼
```

### 3. GAS 後端設定
- 腳本位置：`scripts/data-update-gas.js`
- 前往 Google 試算表 > 擴充功能 > Apps Script 貼上程式碼。
- 務必在「指令碼屬性」中設定 `LINE_CHANNEL_ACCESS_TOKEN` 等機敏資料。
- 部署為「網頁應用程式」，並設定存取權限為「所有人」。

## 📂 檔案結構

- `/src/components`: 各式地圖元件與 UI 介面
- `/src/types`: TypeScript 定義檔
- `/public/data`: 存放 `Sanyi_villages.geojson` 等圖資檔案
- `/scripts`: 後端 GAS 核心腳本

## 👷 自動化部署

本專案配置 GitHub Actions：
- 當程式碼推送至 `main` 分支時，會自動執行 Lint 檢查、編譯並部署至 **GitHub Pages**。

---
*Developed for Sanyi Township Office.*
