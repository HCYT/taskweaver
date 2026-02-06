# TaskWeaver

[![vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?logo=vitest)](https://vitest.dev/)

將散落各處的 TODO 統整成一個清晰視圖。[Obsidian](https://obsidian.md/) 的看板式任務管理插件。

[English README](./README.md)

## 功能特色

### 側邊欄 TODO 列表
- 一覽 Vault 中所有的 TODO
- 快速導航 - 點擊跳轉到原始檔案和行號
- 即時搜尋和篩選
- 可展開的子任務與進度追蹤
- 優先級顏色標示（高/中/低）

### 看板視圖
- 多個看板，可自訂欄位
- 欄位間拖放任務
- 欄位類型：手動、已完成、有日期、逾期、無日期、依標籤
- 每欄工作進度限制（WIP）
- 從欄位底部快速新增任務

### 任務管理
- 子任務展開與勾選
- 到期日標籤（逾期/今天/即將到期）
- 標籤顯示與編輯
- 優先級設定（高/中/低）
- 釘選重要任務到頂端
- 封存已完成任務
- 右鍵選單跨檔案移動
- 重複偵測（標記 `DUP`）

### 設定
- 隱藏已完成任務
- 包含/排除特定資料夾
- 自動隱藏空欄位
- 各看板獨立設定

## 安裝方式

### 從 Obsidian 社群插件
1. 開啟 設定 → 社群插件
2. 搜尋 "TaskWeaver"
3. 點擊安裝並啟用

### 手動安裝
1. 從 [最新版本](https://github.com/user/taskweaver/releases) 下載 `main.js`、`manifest.json` 和 `styles.css`
2. 建立資料夾：`你的Vault/.obsidian/plugins/taskweaver/`
3. 將下載的檔案複製到此資料夾
4. 重新載入 Obsidian 並啟用插件

## 使用方式

1. 點擊左側 Ribbon 的勾選圖示開啟 TaskWeaver
2. 使用下拉選單切換列表視圖和看板視圖
3. 右鍵任務開啟選單：
   - 開啟檔案 / 移動到檔案
   - 編輯任務 / 標記完成
   - 設定優先級（高/中/低）
   - 釘選/取消釘選 / 封存
4. 點擊看板的設定圖示配置欄位

## 任務語法

TaskWeaver 識別標準 Obsidian 任務語法：

```markdown
- [ ] 基本任務
- [x] 已完成任務
- [ ] 有到期日的任務 📅 2024-02-15
- [ ] 有 #標籤 的任務
  - [ ] 子任務 1
  - [ ] 子任務 2
```

## 開發

```bash
npm install
npm run dev      # 監聽模式
npm run build    # 生產構建
npm run test     # 執行測試
```

## 授權

MIT
