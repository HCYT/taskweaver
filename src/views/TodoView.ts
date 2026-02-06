import { ItemView, WorkspaceLeaf, TFile, Menu, setIcon } from 'obsidian';
import { TodoItem, TodoEngine } from '../engines/TodoEngine';
import { BoardEngine, Board, Column } from '../engines/BoardEngine';
import { EditTaskModal } from '../modals/EditTaskModal';

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

        // FORCE INJECT STYLES for debugging/robustness
        const styleId = 'taskweaver-injected-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .taskweaver-header {
                    display: flex !important;
                    gap: 8px !important;
                    align-items: center !important;
                }
                .taskweaver-view-selector {
                    margin-bottom: 0 !important;
                    flex-shrink: 0;
                    min-width: 120px;
                }
                .taskweaver-search {
                    flex: 1 !important;
                    width: auto !important;
                }
                .taskweaver-edit-modal {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }
                .taskweaver-meta-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
            `;
            document.head.appendChild(style);
        }

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
        const listOption = select.createEl('option', { text: 'List View', value: 'list' });
        if (this.viewMode === 'list') listOption.selected = true;

        // Board options
        if (this.boardEngine) {
            const boards = this.boardEngine.getAllBoards();
            for (const board of boards) {
                const option = select.createEl('option', {
                    text: board.name,
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

        // Priority colors (synced with BoardView)
        if (board && this.boardEngine) {
            const priority = this.boardEngine.getTodoPriority(board.id, todo.id);
            if (priority === 1) {
                item.addClass('priority-high');
            } else if (priority === 2) {
                item.addClass('priority-medium');
            } else if (priority === 3) {
                item.addClass('priority-low');
            }
        } else {
            // List View - use global priority
            const priority = this.engine.getGlobalPriority(todo.id);
            if (priority === 1) {
                item.addClass('priority-high');
            } else if (priority === 2) {
                item.addClass('priority-medium');
            } else if (priority === 3) {
                item.addClass('priority-low');
            }
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
        setIcon(handle, isPinned ? 'pin' : 'grip-vertical');

        // Checkbox
        const checkbox = item.createEl('input', { type: 'checkbox', cls: 'taskweaver-checkbox' });
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', async () => {
            await this.engine.toggleTodo(todo.id);
        });

        // Text (clean like BoardView)
        const cleanText = todo.text
            .replace(/(?:📅|📆|due::?)\d{4}-\d{2}-\d{2}/g, '')
            .replace(/#[\w\-\/]+/g, '')
            .trim();
        const text = item.createDiv({ cls: 'taskweaver-text' });
        text.setText(cleanText || todo.text);

        // Meta row (due date, tags)
        const meta = item.createDiv({ cls: 'taskweaver-item-meta' });

        // Due date badge
        if (todo.dueDate) {
            const dateClass = this.getDateStatusClass(todo.dueDate);
            const dateBadge = meta.createSpan({ cls: `taskweaver-date-badge ${dateClass}` });
            dateBadge.setText(this.formatDateRelative(todo.dueDate));
        }

        // Tags (max 3)
        if (todo.tags && todo.tags.length > 0) {
            for (const tag of todo.tags.slice(0, 3)) {
                const tagEl = meta.createSpan({ cls: 'taskweaver-item-tag' });
                tagEl.setText(tag);
            }
            if (todo.tags.length > 3) {
                const moreEl = meta.createSpan({ cls: 'taskweaver-item-tag-more' });
                moreEl.setText(`+${todo.tags.length - 3}`);
            }
        }

        // Sub-task progress indicator
        if (this.engine.hasSubTasks(todo.id)) {
            const progress = this.engine.getSubTaskProgress(todo.id);
            const progressEl = meta.createSpan({ cls: 'taskweaver-subtask-progress' });
            const percent = Math.round((progress.completed / progress.total) * 100);
            progressEl.innerHTML = `<span class="taskweaver-progress-bar-mini"><span style="width:${percent}%"></span></span> ${progress.completed}/${progress.total}`;
        }

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

    private getDateStatusClass(dateStr: string): string {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return 'is-overdue';
        if (diffDays === 0) return 'is-today';
        if (diffDays <= 3) return 'is-soon';
        return '';
    }

    private formatDateRelative(dateStr: string): string {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const date = new Date(dateStr);
        date.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays === -1) return 'Yesterday';
        if (diffDays > 0 && diffDays <= 7) return `${diffDays}d`;
        if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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

        menu.addItem((item) => {
            item.setTitle('Edit task')
                .setIcon('pencil')
                .onClick(() => {
                    new EditTaskModal(this.app, this.engine, todo, async () => {
                        await this.engine.initialize();
                        this.onSettingsChange();
                    }).open();
                });
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

            menu.addSeparator();

            // Priority options (synced with BoardView)
            const currentPriority = this.boardEngine.getTodoPriority(board.id, todo.id);
            menu.addItem((item) => {
                item.setTitle('High Priority')
                    .setIcon(currentPriority === 1 ? 'check' : 'circle')
                    .onClick(() => {
                        this.boardEngine!.setTodoPriority(board.id, todo.id, currentPriority === 1 ? 0 : 1);
                        this.onSettingsChange();
                    });
            });
            menu.addItem((item) => {
                item.setTitle('Medium Priority')
                    .setIcon(currentPriority === 2 ? 'check' : 'circle')
                    .onClick(() => {
                        this.boardEngine!.setTodoPriority(board.id, todo.id, currentPriority === 2 ? 0 : 2);
                        this.onSettingsChange();
                    });
            });
            menu.addItem((item) => {
                item.setTitle('Low Priority')
                    .setIcon(currentPriority === 3 ? 'check' : 'circle')
                    .onClick(() => {
                        this.boardEngine!.setTodoPriority(board.id, todo.id, currentPriority === 3 ? 0 : 3);
                        this.onSettingsChange();
                    });
            });

            menu.addSeparator();

            // Archive option (synced with BoardView)
            menu.addItem((item) => {
                item.setTitle('Archive task')
                    .setIcon('archive')
                    .onClick(() => {
                        this.boardEngine!.archiveTodo(board.id, todo.id);
                        this.onSettingsChange();
                    });
            });
        } else {
            // List View mode - use global priority/archive
            menu.addItem((item) => {
                item.setTitle(todo.pinned ? 'Unpin' : 'Pin to top')
                    .setIcon('pin')
                    .onClick(() => {
                        this.engine.togglePin(todo.id);
                        this.onSettingsChange();
                    });
            });

            menu.addSeparator();

            // Global priority options
            const currentPriority = this.engine.getGlobalPriority(todo.id);
            menu.addItem((item) => {
                item.setTitle('High Priority')
                    .setIcon(currentPriority === 1 ? 'check' : 'circle')
                    .onClick(() => {
                        this.engine.setGlobalPriority(todo.id, currentPriority === 1 ? 0 : 1);
                        this.onSettingsChange();
                    });
            });
            menu.addItem((item) => {
                item.setTitle('Medium Priority')
                    .setIcon(currentPriority === 2 ? 'check' : 'circle')
                    .onClick(() => {
                        this.engine.setGlobalPriority(todo.id, currentPriority === 2 ? 0 : 2);
                        this.onSettingsChange();
                    });
            });
            menu.addItem((item) => {
                item.setTitle('Low Priority')
                    .setIcon(currentPriority === 3 ? 'check' : 'circle')
                    .onClick(() => {
                        this.engine.setGlobalPriority(todo.id, currentPriority === 3 ? 0 : 3);
                        this.onSettingsChange();
                    });
            });

            menu.addSeparator();

            // Archive option
            menu.addItem((item) => {
                item.setTitle('Archive task')
                    .setIcon('archive')
                    .onClick(() => {
                        this.engine.toggleArchive(todo.id);
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
