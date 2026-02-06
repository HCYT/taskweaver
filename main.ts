import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { TodoEngine, TodoEngineSettings } from './src/TodoEngine';
import { TodoView, VIEW_TYPE_TODO } from './src/TodoView';

interface TaskweaverSettings extends TodoEngineSettings {
    // Extend if needed
}

const DEFAULT_SETTINGS: TaskweaverSettings = {
    priorityOrder: [],
    hideCompleted: true,
    excludeFolders: [],
};

export default class TaskweaverPlugin extends Plugin {
    settings: TaskweaverSettings;
    engine: TodoEngine;

    async onload(): Promise<void> {
        await this.loadSettings();

        // Initialize engine
        this.engine = new TodoEngine(
            this.app.vault,
            this.app.metadataCache,
            this.settings
        );

        // Register view
        this.registerView(VIEW_TYPE_TODO, (leaf) => new TodoView(leaf, this.engine, () => this.saveSettings()));

        // Add ribbon icon
        this.addRibbonIcon('check-square', 'Open All Todo', () => {
            this.activateView();
        });

        // Add command
        this.addCommand({
            id: 'open-taskweaver-view',
            name: 'Open Taskweaver sidebar',
            callback: () => this.activateView(),
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

    async activateView(): Promise<void> {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VIEW_TYPE_TODO);

        if (leaves.length > 0) {
            leaf = leaves[0] ?? null;
        } else {
            const rightLeaf = workspace.getRightLeaf(false);
            if (rightLeaf) {
                leaf = rightLeaf;
                await leaf.setViewState({ type: VIEW_TYPE_TODO, active: true });
            }
        }

        if (leaf) {
            workspace.revealLeaf(leaf);
        }
    }

    async loadSettings(): Promise<void> {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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
