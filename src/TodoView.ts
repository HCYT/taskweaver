import { ItemView, WorkspaceLeaf, TFile, Menu } from 'obsidian';
import { TodoItem, TodoEngine } from './TodoEngine';
import { BoardEngine, Board, Column } from './BoardEngine';

export const VIEW_TYPE_TODO = 'taskweaver-view';

type ViewMode = 'list' | string; // 'list' or board ID

export class TodoView extends ItemView {
    private engine: TodoEngine;
    private boardEngine: BoardEngine | null = null;
    private searchInput: HTMLInputElement;
    private listEl: HTMLElement;
    private currentFilter: string = '';
    private duplicateIds: Set<string> = new Set();
    private draggedItem: HTMLElement | null = null;
    private draggedTodoId: string | null = null;
    private onSettingsChange: () => void;
    private viewMode: ViewMode = 'list';

    constructor(leaf: WorkspaceLeaf, engine: TodoEngine, onSettingsChange: () => void, boardEngine?: BoardEngine) {
        super(leaf);
        this.engine = engine;
        this.onSettingsChange = onSettingsChange;
        this.boardEngine = boardEngine || null;
    }

    getViewType(): string {
        return VIEW_TYPE_TODO;
    }

    getDisplayText(): string {
        return 'All Todo';
    }

    getIcon(): string {
        return 'check-square';
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-container');

        // Header with search and view mode
        const header = contentEl.createDiv({ cls: 'taskweaver-header' });

        // View mode selector
        this.renderViewModeSelector(header);

        this.searchInput = header.createEl('input', {
            type: 'text',
            placeholder: 'Search todos...',
            cls: 'taskweaver-search',
        });
        this.searchInput.addEventListener('input', () => {
            this.currentFilter = this.searchInput.value;
            this.renderList();
        });

        // Stats bar
        const statsBar = contentEl.createDiv({ cls: 'taskweaver-stats' });
        this.updateStats(statsBar);

        // Todo list
        this.listEl = contentEl.createDiv({ cls: 'taskweaver-list' });

        // Initial render
        this.duplicateIds = this.engine.getDuplicateIds();
        this.renderList();

        // Subscribe to updates
        this.engine.onUpdate(() => {
            this.duplicateIds = this.engine.getDuplicateIds();
            this.renderList();
        });

        if (this.boardEngine) {
            this.boardEngine.onUpdate(() => this.renderList());
        }
    }

    private renderViewModeSelector(container: HTMLElement): void {
        const selectorWrap = container.createDiv({ cls: 'taskweaver-view-selector' });
        const select = selectorWrap.createEl('select', { cls: 'taskweaver-view-select' });

        // List option
        const listOption = select.createEl('option', { text: '📋 List View', value: 'list' });
        if (this.viewMode === 'list') listOption.selected = true;

        // Board options
        if (this.boardEngine) {
            const boards = this.boardEngine.getAllBoards();
            for (const board of boards) {
                const option = select.createEl('option', {
                    text: `📊 ${board.name}`,
                    value: board.id,
                });
                if (this.viewMode === board.id) option.selected = true;
            }
        }

        select.addEventListener('change', () => {
            this.viewMode = select.value as ViewMode;
            this.renderList();
        });
    }

    private updateStats(container: HTMLElement): void {
        const todos = this.engine.getTodos();
        const completed = todos.filter(t => t.completed).length;
        const duplicates = this.engine.getDuplicateIds().size;

        container.empty();
        container.createSpan({ text: `${todos.length} todos`, cls: 'taskweaver-stat' });
        container.createSpan({ text: `${completed} done`, cls: 'taskweaver-stat taskweaver-stat-done' });
        if (duplicates > 0) {
            container.createSpan({ text: `${duplicates} duplicates`, cls: 'taskweaver-stat taskweaver-stat-dup' });
        }
    }

    private renderList(): void {
        this.listEl.empty();

        // Update stats
        const statsBar = this.contentEl.querySelector('.taskweaver-stats');
        if (statsBar) this.updateStats(statsBar as HTMLElement);

        if (this.viewMode === 'list') {
            this.renderFlatList();
        } else {
            this.renderBoardGroupedList();
        }
    }

    private renderFlatList(): void {
        let todos = this.currentFilter
            ? this.engine.search(this.currentFilter)
            : this.engine.getTodos();

        if (todos.length === 0) {
            this.listEl.createDiv({
                text: this.currentFilter ? 'No matching todos' : 'No todos found',
                cls: 'taskweaver-empty',
            });
            return;
        }

        for (const todo of todos) {
            this.renderTodoItem(todo, this.listEl);
        }
    }

    private renderBoardGroupedList(): void {
        if (!this.boardEngine) {
            this.listEl.createDiv({ text: 'No board engine', cls: 'taskweaver-empty' });
            return;
        }

        const board = this.boardEngine.getBoard(this.viewMode);
        if (!board) {
            this.listEl.createDiv({ text: 'Board not found', cls: 'taskweaver-empty' });
            return;
        }

        for (const column of board.columns) {
            this.renderColumnGroup(board, column);
        }
    }

    private renderColumnGroup(board: Board, column: Column): void {
        const groupEl = this.listEl.createDiv({ cls: 'taskweaver-group' });

        // Group header
        const headerEl = groupEl.createDiv({ cls: 'taskweaver-group-header' });
        headerEl.createSpan({ text: column.name, cls: 'taskweaver-group-title' });

        // Drop zone for this column
        const todosEl = groupEl.createDiv({ cls: 'taskweaver-group-todos' });
        todosEl.setAttribute('data-column-id', column.id);
        todosEl.setAttribute('data-board-id', board.id);

        // Drop zone events
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
            if (this.draggedTodoId && this.boardEngine) {
                this.boardEngine.assignTodoToColumn(board.id, this.draggedTodoId, column.id);
                this.onSettingsChange();
            }
        });

        // Get todos for this column
        const todos = this.boardEngine!.getTodosForColumn(board.id, column.id);
        const filteredTodos = this.currentFilter
            ? todos.filter(t => t.text.toLowerCase().includes(this.currentFilter.toLowerCase()))
            : todos;

        headerEl.createSpan({ text: ` (${filteredTodos.length})`, cls: 'taskweaver-group-count' });

        for (const todo of filteredTodos) {
            this.renderTodoItem(todo, todosEl, board);
        }
    }

    private renderTodoItem(todo: TodoItem, container: HTMLElement, board?: Board): void {
        const item = container.createDiv({ cls: 'taskweaver-item' });
        item.setAttribute('data-id', todo.id);
        item.setAttribute('draggable', 'true');

        if (todo.completed) {
            item.addClass('is-completed');
        }
        if (this.duplicateIds.has(todo.id)) {
            item.addClass('is-duplicate');
        }

        // Check pinned status
        const isPinned = board
            ? this.boardEngine?.isBoardPinned(board.id, todo.id)
            : todo.pinned;
        if (isPinned) {
            item.addClass('is-pinned');
        }

        // Drag handle
        const handle = item.createDiv({ cls: 'taskweaver-drag-handle' });
        handle.innerHTML = isPinned ? '📌' : '⋮⋮';

        // Checkbox
        const checkbox = item.createEl('input', { type: 'checkbox', cls: 'taskweaver-checkbox' });
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', async () => {
            await this.engine.toggleTodo(todo.id);
        });

        // Text
        const text = item.createDiv({ cls: 'taskweaver-text' });
        text.setText(todo.text);

        // File link
        const link = item.createDiv({ cls: 'taskweaver-link' });
        const fileName = todo.filePath.split('/').pop() || todo.filePath;
        link.setText(fileName);
        link.setAttribute('title', `${todo.filePath}:${todo.lineNumber}`);
        link.addEventListener('click', async (e) => {
            e.stopPropagation();
            await this.openFile(todo);
        });

        // Duplicate badge
        if (this.duplicateIds.has(todo.id)) {
            const badge = item.createDiv({ cls: 'taskweaver-badge-dup' });
            badge.setText('DUP');
            badge.setAttribute('title', 'This todo appears in multiple files');
        }

        // Drag events - set on item level
        item.addEventListener('dragstart', (e: DragEvent) => {
            e.stopPropagation();
            this.draggedItem = item;
            this.draggedTodoId = todo.id;
            item.addClass('is-dragging');
            if (e.dataTransfer) {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', todo.id);
            }
        });
        item.addEventListener('dragend', () => this.onDragEnd());
        item.addEventListener('dragover', (e) => this.onDragOver(e, item));
        item.addEventListener('drop', (e) => this.onDrop(e, item));

        // Context menu
        item.addEventListener('contextmenu', (e) => this.showContextMenu(e, todo, board));
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

    private onDragStart(e: DragEvent, item: HTMLElement, todoId: string): void {
        this.draggedItem = item;
        this.draggedTodoId = todoId;
        item.addClass('is-dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', todoId);
        }
    }

    private onDragEnd(): void {
        if (this.draggedItem) {
            this.draggedItem.removeClass('is-dragging');
            this.draggedItem = null;
            this.draggedTodoId = null;
        }
        this.listEl.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));
    }

    private onDragOver(e: DragEvent, item: HTMLElement): void {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        this.listEl.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));
        if (item !== this.draggedItem) {
            item.addClass('drag-over');
        }
    }

    private onDrop(e: DragEvent, targetItem: HTMLElement): void {
        e.preventDefault();
        e.stopPropagation();

        if (!this.draggedItem || targetItem === this.draggedItem) return;

        if (this.viewMode === 'list') {
            // Reorder in flat list mode
            const items = Array.from(this.listEl.querySelectorAll('.taskweaver-item'));
            const draggedIndex = items.indexOf(this.draggedItem);
            const targetIndex = items.indexOf(targetItem);

            if (draggedIndex < targetIndex) {
                targetItem.after(this.draggedItem);
            } else {
                targetItem.before(this.draggedItem);
            }

            const newOrder = Array.from(this.listEl.querySelectorAll('.taskweaver-item'))
                .map(el => el.getAttribute('data-id'))
                .filter((id): id is string => id !== null);

            this.engine.updatePriorities(newOrder);
            this.onSettingsChange();
        } else if (this.boardEngine && this.draggedTodoId) {
            // Board mode: the parent is the group-todos container
            const parent = targetItem.parentElement;
            if (parent) {
                const columnId = parent.getAttribute('data-column-id');
                if (columnId) {
                    this.boardEngine.assignTodoToColumn(this.viewMode, this.draggedTodoId, columnId);
                    this.onSettingsChange();
                }
            }
        }

        targetItem.removeClass('drag-over');
    }

    private showContextMenu(e: MouseEvent, todo: TodoItem, board?: Board): void {
        e.preventDefault();
        const menu = new Menu();

        menu.addItem((item) => {
            item.setTitle('Open file')
                .setIcon('file')
                .onClick(() => this.openFile(todo));
        });

        menu.addItem((item) => {
            item.setTitle('Move to file...')
                .setIcon('file-input')
                .onClick(() => this.showMoveDialog(todo));
        });

        menu.addSeparator();

        // Board column options
        if (this.boardEngine && board) {
            for (const column of board.columns) {
                menu.addItem((item) => {
                    item.setTitle(`Move to ${column.name}`)
                        .setIcon('arrow-right')
                        .onClick(() => {
                            this.boardEngine!.assignTodoToColumn(board.id, todo.id, column.id);
                            this.onSettingsChange();
                        });
                });
            }
            menu.addSeparator();
        }

        menu.addItem((item) => {
            item.setTitle(todo.completed ? 'Mark incomplete' : 'Mark complete')
                .setIcon(todo.completed ? 'square' : 'check-square')
                .onClick(() => this.engine.toggleTodo(todo.id));
        });

        menu.addSeparator();

        // Pin options
        if (board && this.boardEngine) {
            const isPinned = this.boardEngine.isBoardPinned(board.id, todo.id);
            menu.addItem((item) => {
                item.setTitle(isPinned ? 'Unpin from board' : 'Pin in board')
                    .setIcon('pin')
                    .onClick(() => {
                        this.boardEngine!.toggleBoardPin(board.id, todo.id);
                        this.onSettingsChange();
                    });
            });
        } else {
            menu.addItem((item) => {
                item.setTitle(todo.pinned ? 'Unpin' : 'Pin to top')
                    .setIcon('pin')
                    .onClick(() => {
                        this.engine.togglePin(todo.id);
                        this.onSettingsChange();
                    });
            });
        }

        menu.showAtMouseEvent(e);
    }

    private async showMoveDialog(todo: TodoItem): Promise<void> {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => f.path !== todo.filePath)
            .sort((a, b) => a.path.localeCompare(b.path));

        const menu = new Menu();

        for (const file of files.slice(0, 20)) {
            menu.addItem((item) => {
                item.setTitle(file.path)
                    .onClick(async () => {
                        const success = await this.engine.moveTodoToFile(todo.id, file.path);
                        if (success) {
                            this.renderList();
                        }
                    });
            });
        }

        if (files.length > 20) {
            menu.addItem((item) => {
                item.setTitle(`... and ${files.length - 20} more files`)
                    .setDisabled(true);
            });
        }

        menu.showAtPosition({ x: 0, y: 0 });
    }

    async onClose(): Promise<void> {
        // Cleanup
    }
}
