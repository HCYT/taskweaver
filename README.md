# TaskWeaver

[![vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?logo=vitest)](https://vitest.dev/)

Weave your scattered TODOs into one unified view. A Kanban-style task management plugin for [Obsidian](https://obsidian.md/).

[繁體中文版 README](./README.zh-TW.md)

## Features

### 📋 Sidebar TODO List
- View all TODOs from your entire vault in one place
- Quick navigation - click to jump to source file and line
- Search and filter TODOs instantly

### 📌 Kanban Board View
- Multiple columns with drag & drop support
- Column types: Manual, Completed, Dated, Overdue, Undated, By Tag
- Sub-task expansion with progress tracking
- Quick add tasks from column footer

### 🎯 Task Management
- Duplicate detection (marked with `DUP`)
- Cross-file move via context menu
- Priority levels (High/Medium/Low)
- Tag editing in task modal
- Archive completed tasks

### ⚙️ Settings
- Hide completed tasks
- Exclude specific folders
- Work-in-progress limits per column
- Auto-hide empty columns

## Installation

### From Obsidian Community Plugins
1. Open Settings → Community plugins
2. Search for "TaskWeaver"
3. Click Install, then Enable

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/YOUR_USERNAME/taskweaver/releases)
2. Create folder: `YOUR_VAULT/.obsidian/plugins/taskweaver/`
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin

## Usage

1. Click the ✅ icon in the left ribbon
2. Create a board from the selector dropdown
3. Drag tasks between columns to organize
4. Right-click cards for more options
5. Click ⚙️ to configure board settings

## Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
npm run test     # run tests
```

## License

MIT
