# Taskweaver

Weave your scattered TODOs into one unified view. A plugin for [Obsidian](https://obsidian.md/).

## Features

- **Sidebar TODO List** - View all TODOs from your entire vault in one place
- **Drag & Drop Reorder** - Prioritize tasks with persistent ordering
- **Duplicate Detection** - Identify repeated TODOs across files (marked with `DUP`)
- **Quick Navigation** - Click to jump to the source file and line
- **Cross-File Move** - Right-click to move a TODO to another file
- **Search** - Filter TODOs instantly
- **Hide Completed** - Optionally hide finished tasks
- **Exclude Folders** - Skip templates, archives, or other folders

## Installation

### From Obsidian Community Plugins
1. Open Settings → Community plugins
2. Search for "Taskweaver"
3. Click Install, then Enable

### Manual Installation
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/YOUR_USERNAME/taskweaver/releases)
2. Create folder: `YOUR_VAULT/.obsidian/plugins/taskweaver/`
3. Copy the downloaded files into this folder
4. Reload Obsidian and enable the plugin in Settings → Community plugins

## Usage

1. Click the ✅ icon in the left ribbon, or use command palette: "Open All Todo sidebar"
2. Your TODOs appear in the sidebar
3. Drag items to reorder
4. Click the filename to jump to source
5. Right-click for more options (move to file, toggle complete)

## Settings

| Setting | Description |
|---------|-------------|
| Hide completed | Don't show `[x]` items in the list |
| Exclude folders | Comma-separated folder paths to ignore |

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

## License

MIT
