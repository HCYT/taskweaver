import { App, Modal, Setting } from 'obsidian';
import { Board, Column, BoardEngine, ColumnType } from '../engines/BoardEngine';

export class BoardSettingsModal extends Modal {
    private board: Board;
    private boardEngine: BoardEngine;
    private onSave: () => void;

    constructor(app: App, board: Board, boardEngine: BoardEngine, onSave: () => void) {
        super(app);
        this.board = board;
        this.boardEngine = boardEngine;
        this.onSave = onSave;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-board-settings-modal');

        // Header
        contentEl.createEl('h2', { text: `Board Settings: ${this.board.name}` });

        // Board name
        new Setting(contentEl)
            .setName('Board Name')
            .addText(text => {
                text.setValue(this.board.name)
                    .onChange(value => {
                        this.boardEngine.renameBoard(this.board.id, value);
                    });
            });

        // Columns section
        contentEl.createEl('h3', { text: 'Columns' });

        const columnsContainer = contentEl.createDiv({ cls: 'taskweaver-columns-list' });
        this.renderColumns(columnsContainer);

        // Add column button
        const addColumnBtn = contentEl.createEl('button', {
            text: '+ Add Column',
            cls: 'mod-cta taskweaver-add-column-btn'
        });
        addColumnBtn.addEventListener('click', () => {
            this.boardEngine.addColumn(this.board.id, 'New Column');
            this.onSave();
            this.renderColumns(columnsContainer);
        });

        // Options section
        contentEl.createEl('h3', { text: 'Options' });

        new Setting(contentEl)
            .setName('Hide Empty Columns')
            .setDesc('Automatically hide columns with no tasks')
            .addToggle(toggle => {
                toggle.setValue(this.board.hideEmptyColumns || false)
                    .onChange(() => {
                        this.boardEngine.toggleHideEmptyColumns(this.board.id);
                        this.onSave();
                    });
            });

        // Footer
        const footer = contentEl.createDiv({ cls: 'taskweaver-modal-actions' });
        const closeBtn = footer.createEl('button', { text: 'Done', cls: 'mod-cta' });
        closeBtn.addEventListener('click', () => this.close());
    }

    private renderColumns(container: HTMLElement): void {
        container.empty();

        for (const column of this.board.columns) {
            const columnRow = container.createDiv({ cls: 'taskweaver-column-row' });

            // Drag handle (visual only for now)
            columnRow.createSpan({ text: '☰', cls: 'taskweaver-column-drag' });

            // Column name input
            const nameInput = columnRow.createEl('input', {
                type: 'text',
                value: column.name,
                cls: 'taskweaver-column-name-input'
            });
            nameInput.addEventListener('change', () => {
                this.boardEngine.renameColumn(this.board.id, column.id, nameInput.value);
                this.onSave();
            });

            // Type badge
            const typeBadge = columnRow.createSpan({
                text: this.getTypeLabel(column.type || 'manual'),
                cls: 'taskweaver-column-type-badge'
            });

            // Delete button
            const deleteBtn = columnRow.createEl('button', { text: '×', cls: 'taskweaver-column-delete' });
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Delete column "${column.name}"?`)) {
                    this.boardEngine.removeColumn(this.board.id, column.id);
                    this.onSave();
                    this.renderColumns(container);
                }
            });
        }
    }

    private getTypeLabel(type: ColumnType): string {
        switch (type) {
            case 'completed': return '✅';
            case 'undated': return '📭';
            case 'overdue': return '🔴';
            case 'dated': return '📅';
            case 'namedTag': return '🏷️';
            default: return '📝';
        }
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
