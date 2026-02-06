import { ItemView, WorkspaceLeaf, Menu, TFile, Modal, App, Setting } from 'obsidian';
import { TodoItem, TodoEngine } from './TodoEngine';
import { BoardEngine, Board, Column } from './BoardEngine';

export const VIEW_TYPE_BOARD = 'taskweaver-board-view';

export class BoardView extends ItemView {
    private todoEngine: TodoEngine;
    private boardEngine: BoardEngine;
    private onSettingsChange: () => void;
    private containerEl_: HTMLElement;
    private draggedItem: HTMLElement | null = null;
    private draggedTodoId: string | null = null;
    private draggedColumnId: string | null = null;

    constructor(
        leaf: WorkspaceLeaf,
        todoEngine: TodoEngine,
        boardEngine: BoardEngine,
        onSettingsChange: () => void
    ) {
        super(leaf);
        this.todoEngine = todoEngine;
        this.boardEngine = boardEngine;
        this.onSettingsChange = onSettingsChange;
    }

    getViewType(): string {
        return VIEW_TYPE_BOARD;
    }

    getDisplayText(): string {
        const board = this.boardEngine.getActiveBoard();
        return board ? `Board: ${board.name}` : 'Kanban Board';
    }

    getIcon(): string {
        return 'layout-grid';
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-board-container');

        this.containerEl_ = contentEl;
        this.render();

        // Subscribe to updates
        this.todoEngine.onUpdate(() => this.render());
        this.boardEngine.onUpdate(() => this.render());
    }

    private render(): void {
        this.containerEl_.empty();

        // Header with board selector
        const header = this.containerEl_.createDiv({ cls: 'taskweaver-board-header' });
        this.renderBoardSelector(header);

        const board = this.boardEngine.getActiveBoard();
        if (!board) {
            this.containerEl_.createDiv({
                text: 'No boards yet. Click + to create one.',
                cls: 'taskweaver-board-empty',
            });
            return;
        }

        // Columns container
        const columnsEl = this.containerEl_.createDiv({ cls: 'taskweaver-board-columns' });

        for (const column of board.columns) {
            this.renderColumn(columnsEl, board, column);
        }

        // Add column button
        const addColumnBtn = columnsEl.createDiv({ cls: 'taskweaver-board-add-column' });
        addColumnBtn.setText('+ Add Column');
        addColumnBtn.addEventListener('click', () => this.promptAddColumn(board.id));
    }

    private renderBoardSelector(container: HTMLElement): void {
        const boards = this.boardEngine.getAllBoards();
        const activeBoard = this.boardEngine.getActiveBoard();

        const selector = container.createDiv({ cls: 'taskweaver-board-selector' });

        // Dropdown
        const select = selector.createEl('select', { cls: 'taskweaver-board-select' });

        if (boards.length === 0) {
            select.createEl('option', { text: 'No boards', value: '' });
        } else {
            for (const board of boards) {
                const option = select.createEl('option', {
                    text: board.name,
                    value: board.id,
                });
                if (activeBoard && board.id === activeBoard.id) {
                    option.selected = true;
                }
            }
        }

        select.addEventListener('change', () => {
            if (select.value) {
                this.boardEngine.setActiveBoard(select.value);
                this.onSettingsChange();
            }
        });

        // Add board button
        const addBtn = selector.createEl('button', { cls: 'taskweaver-board-add-btn' });
        addBtn.setText('+');
        addBtn.setAttribute('title', 'New board');
        addBtn.addEventListener('click', () => this.promptCreateBoard());

        // Delete board button
        if (activeBoard) {
            const deleteBtn = selector.createEl('button', { cls: 'taskweaver-board-delete-btn' });
            deleteBtn.setText('🗑');
            deleteBtn.setAttribute('title', 'Delete board');
            deleteBtn.addEventListener('click', () => {
                if (confirm(`Delete board "${activeBoard.name}"?`)) {
                    this.boardEngine.deleteBoard(activeBoard.id);
                    this.onSettingsChange();
                }
            });
        }
    }

    private renderColumn(container: HTMLElement, board: Board, column: Column): void {
        const columnEl = container.createDiv({ cls: 'taskweaver-board-column' });
        columnEl.setAttribute('data-column-id', column.id);
        columnEl.setAttribute('draggable', 'true');

        // Column drag events for reordering
        columnEl.addEventListener('dragstart', (e) => {
            // Only allow column drag if starting from header area
            if (e.target === columnEl) {
                this.draggedColumnId = column.id;
                columnEl.addClass('is-column-dragging');
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('column-id', column.id);
                }
            }
        });

        columnEl.addEventListener('dragend', () => {
            columnEl.removeClass('is-column-dragging');
            this.draggedColumnId = null;
            container.querySelectorAll('.column-drag-over').forEach(el => el.removeClass('column-drag-over'));
        });

        columnEl.addEventListener('dragover', (e) => {
            if (this.draggedColumnId && this.draggedColumnId !== column.id) {
                e.preventDefault();
                if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
                columnEl.addClass('column-drag-over');
            }
        });

        columnEl.addEventListener('dragleave', () => {
            columnEl.removeClass('column-drag-over');
        });

        columnEl.addEventListener('drop', (e) => {
            e.preventDefault();
            columnEl.removeClass('column-drag-over');
            if (this.draggedColumnId && this.draggedColumnId !== column.id) {
                // Get current order and reorder
                const columns = board.columns.map(c => c.id);
                const fromIndex = columns.indexOf(this.draggedColumnId);
                const toIndex = columns.indexOf(column.id);
                if (fromIndex !== -1 && toIndex !== -1) {
                    columns.splice(fromIndex, 1);
                    columns.splice(toIndex, 0, this.draggedColumnId);
                    this.boardEngine.reorderColumns(board.id, columns);
                    this.onSettingsChange();
                }
            }
        });

        // Column header
        const headerEl = columnEl.createDiv({ cls: 'taskweaver-column-header' });
        const titleEl = headerEl.createSpan({ text: column.name, cls: 'taskweaver-column-title' });

        // Column context menu
        headerEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const menu = new Menu();
            menu.addItem(item => {
                item.setTitle('Rename')
                    .setIcon('pencil')
                    .onClick(() => this.promptRenameColumn(board.id, column));
            });
            menu.addSeparator();
            menu.addItem(item => {
                item.setTitle('Move Left')
                    .setIcon('arrow-left')
                    .onClick(() => {
                        this.boardEngine.moveColumn(board.id, column.id, 'left');
                        this.onSettingsChange();
                    });
            });
            menu.addItem(item => {
                item.setTitle('Move Right')
                    .setIcon('arrow-right')
                    .onClick(() => {
                        this.boardEngine.moveColumn(board.id, column.id, 'right');
                        this.onSettingsChange();
                    });
            });
            menu.addSeparator();
            menu.addItem(item => {
                item.setTitle('Delete')
                    .setIcon('trash')
                    .onClick(() => {
                        this.boardEngine.removeColumn(board.id, column.id);
                        this.onSettingsChange();
                    });
            });
            menu.showAtMouseEvent(e);
        });

        // Todos in this column
        const todos = this.boardEngine.getTodosForColumn(board.id, column.id);
        const todosEl = columnEl.createDiv({ cls: 'taskweaver-column-todos' });

        // Drop zone events - supports both internal and cross-view drop
        todosEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
            todosEl.addClass('drag-over');
        });
        todosEl.addEventListener('dragleave', () => {
            todosEl.removeClass('drag-over');
        });
        todosEl.addEventListener('drop', (e) => {
            e.preventDefault();
            todosEl.removeClass('drag-over');

            // Try to get todo ID from dataTransfer (cross-view) or internal state
            let todoId = this.draggedTodoId;
            if (!todoId && e.dataTransfer) {
                todoId = e.dataTransfer.getData('text/plain');
            }

            if (todoId) {
                this.boardEngine.assignTodoToColumn(board.id, todoId, column.id);
                this.onSettingsChange();
            }
        });

        const count = headerEl.createSpan({ text: ` (${todos.length})`, cls: 'taskweaver-column-count' });

        for (const todo of todos) {
            this.renderTodoCard(todosEl, board, todo);
        }
    }

    private renderTodoCard(container: HTMLElement, board: Board, todo: TodoItem): void {
        const card = container.createDiv({ cls: 'taskweaver-board-card' });
        card.setAttribute('data-todo-id', todo.id);
        card.setAttribute('draggable', 'true');

        if (todo.completed) {
            card.addClass('is-completed');
        }
        if (this.boardEngine.isBoardPinned(board.id, todo.id)) {
            card.addClass('is-pinned');
        }

        // Checkbox
        const checkbox = card.createEl('input', { type: 'checkbox', cls: 'taskweaver-card-checkbox' });
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', async () => {
            await this.todoEngine.toggleTodo(todo.id);
        });

        // Text
        const text = card.createDiv({ cls: 'taskweaver-card-text' });
        text.setText(todo.text);

        // File link
        const link = card.createDiv({ cls: 'taskweaver-card-link' });
        const fileName = todo.filePath.split('/').pop() || todo.filePath;
        link.setText(fileName);
        link.addEventListener('click', () => this.openFile(todo));

        // Drag events
        card.addEventListener('dragstart', (e) => {
            this.draggedItem = card;
            this.draggedTodoId = todo.id;
            card.addClass('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', todo.id);
            }
        });
        card.addEventListener('dragend', () => {
            card.removeClass('is-dragging');
            this.draggedItem = null;
            this.draggedTodoId = null;
        });

        // Context menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showCardContextMenu(e, board, todo);
        });
    }

    private showCardContextMenu(e: MouseEvent, board: Board, todo: TodoItem): void {
        const menu = new Menu();

        menu.addItem(item => {
            item.setTitle('Open file')
                .setIcon('file')
                .onClick(() => this.openFile(todo));
        });

        menu.addSeparator();

        // Move to column submenu
        for (const column of board.columns) {
            menu.addItem(item => {
                item.setTitle(`Move to ${column.name}`)
                    .setIcon('arrow-right')
                    .onClick(() => {
                        this.boardEngine.assignTodoToColumn(board.id, todo.id, column.id);
                        this.onSettingsChange();
                    });
            });
        }

        menu.addSeparator();

        const isPinned = this.boardEngine.isBoardPinned(board.id, todo.id);
        menu.addItem(item => {
            item.setTitle(isPinned ? 'Unpin from this board' : 'Pin in this board')
                .setIcon('pin')
                .onClick(() => {
                    this.boardEngine.toggleBoardPin(board.id, todo.id);
                    this.onSettingsChange();
                });
        });

        menu.addItem(item => {
            item.setTitle(todo.completed ? 'Mark incomplete' : 'Mark complete')
                .setIcon(todo.completed ? 'square' : 'check-square')
                .onClick(() => this.todoEngine.toggleTodo(todo.id));
        });

        menu.showAtMouseEvent(e);
    }

    private async openFile(todo: TodoItem): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(todo.filePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            const view = leaf.view;
            if (view.getViewType() === 'markdown') {
                const editor = (view as any).editor;
                if (editor) {
                    const line = todo.lineNumber - 1;
                    editor.setCursor({ line, ch: 0 });
                    editor.scrollIntoView({ from: { line, ch: 0 }, to: { line, ch: 0 } }, true);
                }
            }
        }
    }

    private promptCreateBoard(): void {
        new InputModal(this.app, 'New Board', 'Enter board name:', '', (name) => {
            if (name && name.trim()) {
                this.boardEngine.createBoard(name.trim());
                this.onSettingsChange();
            }
        }).open();
    }

    private promptAddColumn(boardId: string): void {
        new InputModal(this.app, 'New Column', 'Enter column name:', '', (name) => {
            if (name && name.trim()) {
                this.boardEngine.addColumn(boardId, name.trim());
                this.onSettingsChange();
            }
        }).open();
    }

    private promptRenameColumn(boardId: string, column: Column): void {
        new InputModal(this.app, 'Rename Column', 'Enter new column name:', column.name, (name) => {
            if (name && name.trim()) {
                this.boardEngine.renameColumn(boardId, column.id, name.trim());
                this.onSettingsChange();
            }
        }).open();
    }

    async onClose(): Promise<void> {
        // Cleanup
    }
}

// Input Modal for Obsidian
class InputModal extends Modal {
    private title: string;
    private label: string;
    private defaultValue: string;
    private onSubmit: (value: string) => void;
    private inputEl: HTMLInputElement;

    constructor(app: App, title: string, label: string, defaultValue: string, onSubmit: (value: string) => void) {
        super(app);
        this.title = title;
        this.label = label;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.createEl('h3', { text: this.title });

        new Setting(contentEl)
            .setName(this.label)
            .addText(text => {
                this.inputEl = text.inputEl;
                text.setValue(this.defaultValue);
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        this.submit();
                    }
                });
            });

        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Create')
                .setCta()
                .onClick(() => this.submit()))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()));

        // Focus input
        setTimeout(() => this.inputEl?.focus(), 50);
    }

    private submit(): void {
        const value = this.inputEl?.value || '';
        this.close();
        this.onSubmit(value);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
