# TaskWeaver

[![vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?logo=vitest)](https://vitest.dev/)

將散落的待辦事項編織成統一視圖。為 [Obsidian](https://obsidian.md/) 打造的看板式任務管理外掛。

[English README](./README.md)

## 功能特色

### 📋 側邊欄待辦清單
- 在同一處查看整個 Vault 的所有待辦事項
- 快速導航 - 點擊即跳轉到來源檔案與行數
- 即時搜尋與篩選

### 📌 看板視圖
- 多欄位支援拖放排序
- 欄位類型：手動、已完成、有日期、過期、無日期、依標籤
- 子任務展開與進度追蹤
- 欄位底部快速新增任務

### 🎯 任務管理
- 重複偵測（標示 `DUP`）
- 右鍵選單跨檔案移動
- 優先等級（高/中/低）
- 任務彈窗中編輯標籤
- 封存已完成任務

### ⚙️ 設定
- 隱藏已完成任務
- 排除特定資料夾
- 每欄位設定工作上限
- 自動隱藏空欄位

## 安裝方式

### 從 Obsidian 社群外掛
1. 開啟設定 → 社群外掛
2. 搜尋「TaskWeaver」
3. 點擊安裝，然後啟用

### 手動安裝
1. 從 [最新版本](https://github.com/YOUR_USERNAME/taskweaver/releases) 下載 `main.js`、`manifest.json`、`styles.css`
2. 建立資料夾：`YOUR_VAULT/.obsidian/plugins/taskweaver/`
3. 將下載的檔案複製到此資料夾
4. 重新載入 Obsidian 並啟用外掛

## 使用方式

1. 點擊左側功能區的 ✅ 圖示
2. 從下拉選單建立看板
3. 拖曳任務到不同欄位來整理
4. 右鍵點擊卡片查看更多選項
5. 點擊 ⚙️ 設定看板

## 開發

```bash
npm install
npm run dev      # 監看模式
npm run build    # 生產環境建置
npm run test     # 執行測試
```

## 授權

MIT
