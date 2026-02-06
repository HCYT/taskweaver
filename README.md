# TaskWeaver

[![vitest](https://img.shields.io/badge/tested%20with-vitest-6E9F18?logo=vitest)](https://vitest.dev/)

Weave your scattered TODOs into one unified view. A Kanban-style task management plugin for [Obsidian](https://obsidian.md/).

[繁體中文版 README](./README.zh-TW.md)

## Features

### Sidebar TODO List
- View all TODOs from your entire vault in one place
- Quick navigation - click to jump to source file and line
- Search and filter TODOs instantly
- Expandable sub-tasks with progress tracking
- Priority colors (High/Medium/Low)

### Kanban Board View  
- Multiple boards with customizable columns
- Drag & drop between columns
- Column types: Manual, Completed, Dated, Overdue, Undated, By Tag
- Work-in-progress (WIP) limits per column
- Quick add tasks from column footer

### Task Management
- Sub-task expansion with checkboxes
- Due date badges with status (Overdue/Today/Soon)
- Tag display and editing
- Priority levels (High/Medium/Low)
- Pin important tasks to top
- Archive completed tasks
- Cross-file move via context menu
- Duplicate detection (marked with `DUP`)

### Settings
- Hide completed tasks
- Include/exclude specific folders
- Auto-hide empty columns
- Board-specific configurations

## Installation

### From Obsidian Community Plugins
1. Open Settings → Community plugins
2. Search for "TaskWeaver"
3. Click Install, then Enable

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/user/taskweaver/releases)
2. Create folder: `YOUR_VAULT/.obsidian/plugins/taskweaver/`
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin

## Usage

1. Click the checkmark icon in the left ribbon to open TaskWeaver
2. Use the dropdown to switch between List View and Board views
3. Right-click tasks for context menu options:
   - Open file / Move to file
   - Edit task / Mark complete
   - Set priority (High/Medium/Low)
   - Pin/Unpin / Archive
4. Click the settings icon on boards to configure columns

## Task Syntax

TaskWeaver recognizes standard Obsidian task syntax:

```markdown
- [ ] Basic task
- [x] Completed task
- [ ] Task with due date 📅 2024-02-15
- [ ] Task with #tags
  - [ ] Sub-task 1
  - [ ] Sub-task 2
```

## Development

```bash
npm install
npm run dev      # watch mode
npm run build    # production build
npm run test     # run tests
```

## License

MIT
