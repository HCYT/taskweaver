import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { TodoEngine, TodoEngineSettings } from './src/TodoEngine';
import { TodoView, VIEW_TYPE_TODO } from './src/TodoView';
import { BoardEngine, BoardSettings } from './src/BoardEngine';
import { BoardView, VIEW_TYPE_BOARD } from './src/BoardView';

interface TaskweaverSettings extends TodoEngineSettings {
    boardSettings: BoardSettings;
}

const DEFAULT_SETTINGS: TaskweaverSettings = {
    priorityOrder: [],
    hideCompleted: true,
    excludeFolders: [],
    pinnedIds: [],
    boardSettings: {
        boards: [],
        activeBoardId: null,
    },
};

export default class TaskweaverPlugin extends Plugin {
    settings: TaskweaverSettings;
    engine: TodoEngine;
    boardEngine: BoardEngine;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize engines
        this.engine = new TodoEngine(
            this.app.vault,
            this.app.metadataCache,
            this.settings
        );

        this.boardEngine = new BoardEngine(
            this.settings.boardSettings,
            this.engine
        );

        // Register views
        this.registerView(VIEW_TYPE_TODO, (leaf) => new TodoView(leaf, this.engine, () => this.saveSettings(), this.boardEngine));
        this.registerView(VIEW_TYPE_BOARD, (leaf) => new BoardView(leaf, this.engine, this.boardEngine, () => this.saveSettings()));

        // Add ribbon icons
        this.addRibbonIcon('check-square', 'Open All Todo', () => {
            this.activateSidebarView(VIEW_TYPE_TODO);
        });

        this.addRibbonIcon('layout-grid', 'Open Kanban Board', () => {
            this.activateMainView(VIEW_TYPE_BOARD);
        });

        // Add commands
        this.addCommand({
            id: 'open-taskweaver-view',
            name: 'Open Taskweaver sidebar',
            callback: () => this.activateSidebarView(VIEW_TYPE_TODO),
        });

        this.addCommand({
            id: 'open-taskweaver-board',
            name: 'Open Kanban board',
            callback: () => this.activateMainView(VIEW_TYPE_BOARD),
        });

        this.addCommand({
            id: 'refresh-taskweaver',
            name: 'Refresh Taskweaver list',
            callback: async () => {
                await this.engine.initialize();
            },
        });

        // Add settings tab
        this.addSettingTab(new TaskweaverSettingTab(this.app, this));

        // Initialize engine after layout is ready
        this.app.workspace.onLayoutReady(async () => {
            await this.engine.initialize();
        });
    }

    onunload(): void {
        this.engine.destroy();
    }

    async activateSidebarView(viewType: string): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(viewType);

        if (leaves.length > 0) {
            leaf = leaves[0] ?? null;
        } else {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: viewType, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async activateMainView(viewType: string): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(viewType);

        if (leaves.length > 0) {
            leaf = leaves[0] ?? null;
        } else {
            // Open in main content area (like a normal document)
            leaf = workspace.getLeaf('tab');
            if (leaf) {
                await leaf.setViewState({ type: viewType, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async loadSettings(): Promise<void> {
        const data = await this.loadData();
        this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
        // Ensure boardSettings exists
        if (!this.settings.boardSettings) {
            this.settings.boardSettings = { boards: [], activeBoardId: null };
        }
    }

    async saveSettings(): Promise<void> {
        await this.saveData(this.settings);
    }
}

class TaskweaverSettingTab extends PluginSettingTab {
    plugin: TaskweaverPlugin;

    constructor(app: App, plugin: TaskweaverPlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'All Todo Settings' });

        // Hide completed toggle
        new Setting(containerEl)
            .setName('Hide completed todos')
            .setDesc('When enabled, completed todos will not appear in the list.')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.hideCompleted)
                .onChange(async (value) => {
                    this.plugin.settings.hideCompleted = value;
                    await this.plugin.saveSettings();
                }));

        // Exclude folders
        new Setting(containerEl)
            .setName('Exclude folders')
            .setDesc('Comma-separated list of folder paths to exclude from scanning (e.g., "templates, archive/old").')
            .addTextArea(text => text
                .setPlaceholder('templates, archive')
                .setValue(this.plugin.settings.excludeFolders.join(', '))
                .onChange(async (value) => {
                    this.plugin.settings.excludeFolders = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                    await this.plugin.saveSettings();
                    // Rescan after exclusion change
                    await this.plugin.engine.initialize();
                }));

        // Rescan button
        new Setting(containerEl)
            .setName('Rescan vault')
            .setDesc('Manually rescan all files for todos.')
            .addButton(button => button
                .setButtonText('Rescan')
                .onClick(async () => {
                    await this.plugin.engine.initialize();
                }));
    }
}
