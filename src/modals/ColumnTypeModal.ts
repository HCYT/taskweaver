import { App, Modal, Setting } from 'obsidian';
import { ColumnType, ColumnTypeConfig } from '../engines/BoardEngine';
import { getColumnTypeDescription } from '../utils/ColumnTypeUtils';

export class ColumnTypeModal extends Modal {
    private columnName: string;
    private currentType: ColumnType;
    private currentConfig: ColumnTypeConfig;
    private onSave: (type: ColumnType, config?: ColumnTypeConfig) => void;

    constructor(
        app: App,
        columnName: string,
        currentType: ColumnType,
        currentConfig: ColumnTypeConfig | undefined,
        onSave: (type: ColumnType, config?: ColumnTypeConfig) => void
    ) {
        super(app);
        this.columnName = columnName;
        this.currentType = currentType || 'manual';
        this.currentConfig = currentConfig || {};
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-column-type-modal');

        // Header
        contentEl.createEl('h3', { text: `Configure Column: ${this.columnName}` });

        // Type selector
        new Setting(contentEl)
            .setName('Column type')
            .setDesc('How tasks are assigned to this column')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('manual', 'Manual (drag & drop)')
                    .addOption('completed', 'Completed Tasks')
                    .addOption('undated', 'No Due Date')
                    .addOption('overdue', 'Overdue')
                    .addOption('dated', 'Date Range')
                    .addOption('namedTag', 'By Tag')
                    .setValue(this.currentType)
                    .onChange((value) => {
                        this.currentType = value as ColumnType;
                        this.renderTypeConfig(contentEl);
                    });
            });

        // Type-specific config container
        const configContainer = contentEl.createDiv({ cls: 'taskweaver-type-config' });
        this.renderTypeConfig(contentEl);

        // Footer actions
        const footer = contentEl.createDiv({ cls: 'taskweaver-modal-actions' });

        const cancelBtn = footer.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = footer.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => {
            this.onSave(this.currentType, this.currentConfig);
            this.close();
        });
    }

    private renderTypeConfig(container: HTMLElement): void {
        // Remove old config UI
        const oldConfig = container.querySelector('.taskweaver-type-config');
        if (oldConfig) oldConfig.remove();

        const configEl = container.createDiv({ cls: 'taskweaver-type-config' });

        switch (this.currentType) {
            case 'dated':
                new Setting(configEl)
                    .setName('Date range')
                    .setDesc('Days from today')
                    .addText(text => {
                        text.setPlaceholder('From (e.g., 0)')
                            .setValue(String(this.currentConfig.dateFrom ?? 0))
                            .onChange(val => {
                                this.currentConfig.dateFrom = parseInt(val) || 0;
                            });
                        text.inputEl.type = 'number';
                        text.inputEl.style.width = '60px';
                    })
                    .addText(text => {
                        text.setPlaceholder('To (e.g., 7)')
                            .setValue(String(this.currentConfig.dateTo ?? 7))
                            .onChange(val => {
                                this.currentConfig.dateTo = parseInt(val) || 7;
                            });
                        text.inputEl.type = 'number';
                        text.inputEl.style.width = '60px';
                    });
                break;

            case 'namedTag':
                new Setting(configEl)
                    .setName('Tag')
                    .setDesc('Filter by this tag (e.g., #project)')
                    .addText(text => {
                        text.setPlaceholder('#tag')
                            .setValue(this.currentConfig.tag || '')
                            .onChange(val => {
                                this.currentConfig.tag = val;
                            });
                    });
                break;

            default:
                configEl.createEl('p', {
                    text: getColumnTypeDescription(this.currentType),
                    cls: 'setting-item-description'
                });
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
