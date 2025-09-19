# Hacker Task Manager

Hacker Task Manager 是一個以 Electron + React + Vite 打造的桌面系統監控工具，外觀主打駭客終端風格，能在 macOS（以及其他桌面作業系統）即時監看 CPU、GPU、記憶體與程序資訊。

## 特色功能

- **即時系統監控**：顯示 CPU/GPU 使用率、溫度、功耗、歷史曲線與電池狀態。
- **進程總覽**：以表格呈現程序名稱、PID、狀態、使用者、CPU/記憶體佔用與執行緒數，可搜尋與排序。
- **進程詳情面板**：點擊任一進程即可查看指令、路徑、參數、父 PID、優先權等詳盡資訊，並提供終止與強制終止快捷鍵。
- **網路 / 磁碟卡片**：即時顯示上行、下行、磁碟讀寫吞吐量與 IOPS，並附迷你歷史圖、熱門介面與實際掛載卷宗的容量概覽（macOS 會自動濾除 APFS 內部分割，僅顯示可見卷宗）。
- **GPU 觀測**：支援多 GPU 切換、利用率歷史圖與 VRAM 使用率條，即使在 macOS 的整合 GPU 上也能顯示主要資訊。
- **設定面板**：可調整資料更新頻率、歷史點數、預設 Performance 卡片與顯示的卡片類型，偏好會儲存在本機。

- **Electron 整合**：透過 `preload.js` 安全地把系統資訊、進程控制等 IPC API 暴露給前端。
- **行動裝置友好視圖**：UI 會依視窗寬度切換為精簡表格，保留核心資訊。

## 系統需求

- Node.js 18+（建議安裝 LTS 版本）
- npm 9+（Node.js 附帶）
- 作業系統：macOS / Windows / Linux（Electron 支援平台）

## 安裝與啟動

1. 安裝依賴：
   ```bash
   npm install
   ```
2. 開發模式（同時啟動 Vite 與 Electron）：
   ```bash
   npm run electron:dev
   ```
   - 第一次啟動會先跑 `vite` 開發伺服器，再啟動 Electron 主程式並載入 `http://localhost:5173`。
   - 若只想跑網頁開發模式，可執行 `npm run dev`，使用瀏覽器預覽，但此時無法取得真實系統資訊。
3. 建置：
   ```bash
   npm run build        # 產出前端靜態檔案
   npm run electron:build  # 使用 electron-builder 打包
   ```

## 專案結構簡述

```
├── src
│   ├── main            # Electron 主行程與 preload 腳本
│   │   ├── main.js     # 建立 BrowserWindow、註冊 IPC handlers
│   │   └── preload.js  # 透過 contextBridge 暴露 electronAPI/windowAPI
│   └── renderer        # React + Tailwind 前端
│       ├── App.jsx     # 根組件，匯入 TaskManager
│       ├── TaskManager.jsx # 核心 UI 與資料邏輯
│       └── main.jsx    # React DOM 入口
├── public              # 靜態資源與 index.html
├── vite.config.js      # Vite 設定
├── tailwind.config.js
└── package.json
```

## 主要指令說明

| 指令 | 說明 |
| --- | --- |
| `npm run dev` | 啟動 Vite 開發伺服器（僅瀏覽器模式） |
| `npm run electron:dev` | 同時啟動 Vite 與 Electron，用於桌面開發模式 |
| `npm run build` | 打包 React 前端至 `build/` |
| `npm run electron:build` | 完整建置 Electron 應用（需 electron-builder） |
| `npm run preview` | 以 Vite 預覽建置成果 |
| `npm run pack` / `npm run dist:mac` | 電子安裝包相關指令 |

## 開發者筆記

- Electron 渲染行程在 `BrowserWindow` 中執行，`nodeIntegration` 關閉且 `contextIsolation` 開啟，因此必須透過 `preload.js` 暴露的 `window.electronAPI` 與 `windowAPI` 操作 IPC。
- 系統資訊由 [`systeminformation`](https://github.com/sebhildebrandt/systeminformation) 取得：
  - `get-system-info`：CPU、記憶體、程序、顯示卡、電池、溫度，以及主要磁碟卷宗（`fsSize`）。
  - `get-cpu-load`：取得整體與各核心負載、使用者/系統分布。
  - `get-gpu-load`：取得 GPU 利用率、記憶體、溫度（平台若無資料則以隨機值補洞）。
  - `get-io-stats`：整合網路介面速率、磁碟 IOPS、`fsSize`；前端會優先顯示可見掛載點與實測到的吞吐量。
  - `kill-process`：傳入 PID 與 signal (`SIGTERM` / `SIGKILL`) 終止進程。
- Tailwind CSS 提供樣式，`index.css` 中已引入必要的基礎設定。
- 若在瀏覽器模式（沒有 `window.electronAPI`）將顯示警告 UI，提醒使用者以桌面模式執行。

## 常見問題

### 為什麼 CPU/GPU 資料顯示為 0？
- 請確認以 `npm run electron:dev` 啟動，瀏覽器模式無法讀取系統資訊。
- 某些平台（例如 Apple Silicon）不提供特定指標（如即時頻率），UI 會改顯示 `USER/SYS` 分布或顯示 `N/A`。

### 記憶體欄位都顯示 0.0 MB？
- macOS 的 `pmem` 可能回傳 0，本專案已額外使用 `memRss`/`memVsz` 轉換；若仍為 0 可能是系統無法提供該進程資料。

### 為什麼 GPU 利用率看起來像隨機值？
- 某些 GPU/驅動不提供利用率，IPC handler 會以亂數模擬，維持 UI 完整。可依需求調整主程式邏輯。

### 為什麼磁碟 I/O 或容量與作業系統看到的不完全一致？
- macOS 可能不回報外接裝置的即時 I/O，卡片會以 0 顯示吞吐量，但仍提供 `fsSize` 回傳的容量資訊。
- APFS 會分成多個虛擬卷宗，前端只會顯示一般可見的掛載點（`/`、`/System/Volumes/Data`、`/Volumes/*`），避免看到底層 `/dev/diskXsY` 名稱。

## 授權

本專案採用 MIT License，可自由複製、修改與發佈。詳見 `package.json` 中的 `license` 欄位。
