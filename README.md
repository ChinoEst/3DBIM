# 3DBIM — 瀏覽器端 3D BIM 檢視器

一個純瀏覽器端執行的 3D BIM / 模型檢視器，支援 IFC 與 GLB/GLTF 格式，內建物件管理、剖面裁切、IFC 屬性查詢與專案存檔等功能。

## 技術棧

- **前端框架**：React 18 + Vite
- **3D 引擎**：Three.js
- **IFC 解析**：[@thatopen/components](https://github.com/ThatOpenCompany/engine_web-ifc) + `@thatopen/fragments`
- **測試**：Vitest（單元測試）、Playwright（端對端測試）
- **部署**：Docker + Nginx

## 環境需求

- Node.js 22（Dockerfile 內指定版本，本地開發建議使用相同或相近版本）
- npm

## 安裝與啟動

```bash
# 安裝依賴
npm install

# 啟動開發伺服器（預設 http://localhost:5173）
npm run dev

# Build production 版本
npm run build

# 預覽 production build
npm run preview
```

## 操作說明

### 載入模型

- 直接把 `.glb` / `.gltf` 或 `.ifc` 檔案拖曳到畫面上，或使用工具列上的開檔按鈕。
- 每次載入的模型都會加入場景中的「物件清單」，可同時存在多個物件。

### 滑鼠操作（場景視角）

| 操作 | 功能 |
|---|---|
| 左鍵拖曳 | 旋轉視角 |
| 右鍵拖曳 | 平移視角 |
| 滾輪 | 縮放（拉近/拉遠） |
| 左鍵點擊物件 | 選取物件 |

### 鍵盤快捷鍵

| 按鍵 | 功能 |
|---|---|
| `Z` | 切換為位移（Translate）模式 |
| `X` | 切換為旋轉（Rotate）模式 |
| `C` | 切換為縮放（Scale）模式 |
| `W` / `A` / `S` / `D` | 相機前後左右飛行移動 |
| `Q` / `E` | 相機上升 / 下降 |
| `Delete` / `Backspace` | 刪除選取中的物件 |
| `Esc` | 取消選取 |
| `Ctrl` / `Cmd` + `S` | 儲存目前專案 |

> 目前部分 UI 按鈕上標示的快捷鍵提示與實際綁定不一致，請以上表為準。

### 物件面板

- 顯示場景中所有物件，可個別調整**顯示/隱藏**、**透明度**、**改名**、**刪除**。
- 點開單一物件可看到底下的 **mesh 子清單**，可針對單一 mesh 個別選取並改變顏色。
- 面板左側邊界可拖曳調整寬度，設定會保存在瀏覽器 `localStorage`，重整頁面後仍會維持上次的寬度。

### 剖面裁切（Section Clipping）

- 點擊工具列「剖面裁切」開啟控制面板。
- 可分別針對 X / Y / Z 三個軸開啟裁切平面，拖曳滑桿調整裁切位置，也可以「翻轉」保留的一側。
- 「重置剖面」會關閉所有已啟用的裁切軸。

### IFC 屬性查詢

- 點擊工具列「屬性查詢」進入查詢模式。
- 在此模式下點擊場景中的 IFC 元件，會彈出屬性面板，顯示該元件的基本屬性與 Pset（屬性組）內容。

### 專案存檔 / 讀檔

- 使用工具列的存檔功能，可將目前場景（物件清單、位置、顏色、可見度等狀態）匯出成 JSON 專案檔。
- 開啟先前匯出的專案檔，可還原整個場景。

### 自動存檔（IndexedDB）

- 場景有異動時，會自動 debounce 後寫入瀏覽器的 IndexedDB。
- 重新整理頁面（F5）時，若偵測到先前的自動存檔，會詢問是否要還原上次的場景。

## 測試

```bash
# 執行單元測試（Vitest）
npm test

# 執行單元測試並產生覆蓋率報告
npx vitest run --coverage

# 執行端對端測試（Playwright）
# 第一次執行前需先安裝瀏覽器
npx playwright install chromium
npm run test:e2e

# 以有畫面的模式執行 e2e 測試
npx playwright test --headed

# 以互動式 UI 模式執行/除錯 e2e 測試
npx playwright test --ui
```

## Docker 部署

```bash
docker build -t 3dbim .
docker run -p 8080:80 3dbim
```

啟動後可透過 `http://localhost:8080` 存取。

## 專案結構

```
src/
├── main.jsx                     # React 進入點
├── App.jsx                      # 主要狀態管理與各元件串接
├── components/
│   ├── Toolbar.jsx               # 上方工具列
│   ├── ObjectPanel.jsx           # 物件清單 / mesh 子選取 / 改色
│   ├── SectionPanel.jsx          # 剖面裁切控制面板
│   ├── IfcPropertyPanel.jsx      # IFC 屬性查詢面板
│   ├── InfoModal.jsx             # 檔案資訊彈窗
│   ├── DropZone.jsx              # 檔案拖放區
│   ├── LoadingOverlay.jsx        # 載入中遮罩
│   └── Toast.jsx                 # 通知訊息
└── utils/
    ├── SceneManager.js           # Three.js 場景核心邏輯
    ├── sceneLogic.js             # 抽離出的純函式（方便單元測試）
    ├── ifcLoader.js              # IFC 檔案載入
    └── db.js                     # IndexedDB 自動存檔

tests/
├── logic.test.js                 # 單元測試
├── new-features.test.js          # 單元測試（新功能）
└── e2e/                          # Playwright 端對端測試

.github/
└── workflows/                    # GitHub Actions CI 設定
```
