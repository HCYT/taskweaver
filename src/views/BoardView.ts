import { ItemView, WorkspaceLeaf, Menu, TFile, setIcon } from 'obsidian';
import { TodoItem, TodoEngine } from '../engines/TodoEngine';
import { BoardEngine, Board, Column, ColumnType } from '../engines/BoardEngine';
import { EditTaskModal } from '../modals/EditTaskModal';
import { ColumnTypeModal } from '../modals/ColumnTypeModal';
import { BoardSettingsModal } from '../modals/BoardSettingsModal';
import { InputModal } from '../modals/InputModal';
import { FilterPopover } from '../components/FilterPopover';
import { FilterState, DEFAULT_FILTER_STATE } from '../utils/FilterState';
import { filterTodos } from '../utils/TodoFilterer';
import { getDateStatusClass, formatDateRelative } from '../utils/DateUtils';
import { getColumnTypeLabel, getColumnTypeIcon } from '../utils/ColumnTypeUtils';

export const VIEW_TYPE_BOARD = 'taskweaver-board-view';

export class BoardView extends ItemView {
    private todoEngine: TodoEngine;
    private boardEngine: BoardEngine;
    private onSettingsChange: () => void;
    private containerEl_: HTMLElement;
    private draggedItem: HTMLElement | null = null;
    private draggedTodoId: string | null = null;
    private draggedColumnId: string | null = null;
    private searchFilter: string = '';
    private searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    private isComposing: boolean = false;
    private filterState: FilterState = { ...DEFAULT_FILTER_STATE };
    private filterPopover: FilterPopover | null = null;

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

    private triggerDebouncedSearch(searchInput: HTMLInputElement): void {
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        this.searchDebounceTimer = setTimeout(() => {
            const cursorPos = searchInput.selectionStart;
            this.render();
            // Restore focus after render
            const newInput = this.containerEl_.querySelector('.taskweaver-board-search') as HTMLInputElement;
            if (newInput) {
                newInput.focus();
                if (cursorPos !== null) {
                    newInput.setSelectionRange(cursorPos, cursorPos);
                }
            }
        }, 300);
    }

    private render(): void {
        this.containerEl_.empty();

        // Header with board selector and search
        const header = this.containerEl_.createDiv({ cls: 'taskweaver-board-header' });
        this.renderBoardSelector(header);

        // Search input
        const searchWrap = header.createDiv({ cls: 'taskweaver-board-search-wrap' });
        const searchInput = searchWrap.createEl('input', {
            type: 'text',
            placeholder: 'Search todos...',
            cls: 'taskweaver-board-search',
        });
        searchInput.value = this.searchFilter;

        // Track IME composition state to avoid interrupting Chinese input
        searchInput.addEventListener('compositionstart', () => {
            this.isComposing = true;
        });
        searchInput.addEventListener('compositionend', () => {
            this.isComposing = false;
            // Trigger search after composition ends
            this.triggerDebouncedSearch(searchInput);
        });

        searchInput.addEventListener('input', () => {
            this.searchFilter = searchInput.value;
            // Skip render if in IME composition mode
            if (this.isComposing) return;
            this.triggerDebouncedSearch(searchInput);
        });

        // Filter button
        const filterWrap = header.createDiv({ cls: 'taskweaver-filter-wrap' });
        const allTodos = this.todoEngine.getTodos();
        this.filterPopover = new FilterPopover(filterWrap, allTodos, this.filterState, (newState) => {
            this.filterState = newState;
            this.render();
        });

        // Settings button
        const settingsBtn = header.createEl('button', { cls: 'taskweaver-settings-btn' });
        setIcon(settingsBtn, 'settings');
        settingsBtn.setAttribute('aria-label', 'Board Settings');

        const board = this.boardEngine.getActiveBoard();
        if (board) {
            settingsBtn.addEventListener('click', () => {
                new BoardSettingsModal(this.app, board, this.boardEngine, () => {
                    this.onSettingsChange();
                }).open();
            });
        }

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
            // Skip empty columns if hideEmptyColumns is enabled
            if (board.hideEmptyColumns) {
                const todos = this.boardEngine.getTodosForColumn(board.id, column.id);
                if (todos.length === 0) continue;
            }
            this.renderColumn(columnsEl, board, column);
        }

        // Archive column (if there are archived items)
        const archivedTodos = this.boardEngine.getArchivedTodos(board.id);
        if (archivedTodos.length > 0) {
            this.renderArchiveColumn(columnsEl, board, archivedTodos);
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

        // Minimized column handling
        if (column.minimized) {
            columnEl.addClass('is-minimized');
        }

        // Work limit warning
        const todoCount = this.boardEngine.getTodosForColumn(board.id, column.id).length;
        if (column.workLimit && todoCount > column.workLimit) {
            columnEl.addClass('over-work-limit');
        }

        // Title with count
        const titleEl = headerEl.createSpan({ text: column.name, cls: 'taskweaver-column-title' });
        const countEl = headerEl.createSpan({
            text: `(${todoCount}${column.workLimit ? '/' + column.workLimit : ''})`,
            cls: 'taskweaver-column-count'
        });

        // Work limit warning icon
        if (column.workLimit && todoCount > column.workLimit) {
            const warningEl = headerEl.createSpan({ cls: 'taskweaver-work-limit-warning' });
            setIcon(warningEl, 'alert-triangle');
            warningEl.setAttribute('aria-label', `Over work limit (${todoCount}/${column.workLimit})`);
        }

        // Click to toggle minimize
        titleEl.addEventListener('click', () => {
            this.boardEngine.toggleColumnMinimized(board.id, column.id);
            this.onSettingsChange();
        });

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
                item.setTitle('Move left')
                    .setIcon('arrow-left')
                    .onClick(() => {
                        this.boardEngine.moveColumn(board.id, column.id, 'left');
                        this.onSettingsChange();
                    });
            });
            menu.addItem(item => {
                item.setTitle('Move right')
                    .setIcon('arrow-right')
                    .onClick(() => {
                        this.boardEngine.moveColumn(board.id, column.id, 'right');
                        this.onSettingsChange();
                    });
            });
            menu.addSeparator();

            // Minimize toggle
            menu.addItem(item => {
                item.setTitle(column.minimized ? 'Expand Column' : 'Minimize Column')
                    .setIcon(column.minimized ? 'maximize-2' : 'minimize-2')
                    .onClick(() => {
                        this.boardEngine.toggleColumnMinimized(board.id, column.id);
                        this.onSettingsChange();
                    });
            });

            // Work limit setting
            menu.addItem(item => {
                item.setTitle('Set work limit')
                    .setIcon('gauge')
                    .onClick(() => this.promptSetWorkLimit(board.id, column));
            });

            // Column type configuration
            menu.addItem(item => {
                const typeLabel = column.type ? `Type: ${getColumnTypeLabel(column.type)}` : 'Configure Type';
                item.setTitle(typeLabel)
                    .setIcon('settings-2')
                    .onClick(() => {
                        new ColumnTypeModal(
                            this.app,
                            column.name,
                            column.type || 'manual',
                            column.typeConfig,
                            (type, config) => {
                                this.boardEngine.setColumnType(board.id, column.id, type, config);
                                this.onSettingsChange();
                            }
                        ).open();
                    });
            });

            // Sorting options sub-menu
            menu.addItem(item => {
                item.setTitle('Sort by priority')
                    .setIcon('arrow-up-down')
                    .onClick(() => {
                        this.boardEngine.setColumnSortConfig(board.id, column.id,
                            { criteria: 'priority', order: 'asc' });
                        this.onSettingsChange();
                    });
            });
            menu.addItem(item => {
                item.setTitle('Sort by name')
                    .setIcon('sort-asc')
                    .onClick(() => {
                        this.boardEngine.setColumnSortConfig(board.id, column.id,
                            { criteria: 'name', order: 'asc' });
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

        // Todos in this column (with search filter)
        let todos = this.boardEngine.getTodosForColumn(board.id, column.id);
        if (this.searchFilter) {
            const filter = this.searchFilter.toLowerCase();
            todos = todos.filter(t =>
                t.text.toLowerCase().includes(filter) ||
                t.filePath.toLowerCase().includes(filter)
            );
        }
        // Apply advanced filters
        todos = filterTodos(todos, this.filterState);
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

        // Quick add task input (only for manual columns)
        const columnType = column.type || 'manual';
        if (columnType === 'manual') {
            const quickAddContainer = columnEl.createDiv({ cls: 'taskweaver-quick-add' });
            const quickAddInput = quickAddContainer.createEl('input', {
                type: 'text',
                placeholder: '+ Add task...',
                cls: 'taskweaver-quick-add-input'
            });

            quickAddInput.addEventListener('keydown', async (e) => {
                if (e.key === 'Enter' && quickAddInput.value.trim()) {
                    const taskText = quickAddInput.value.trim();
                    await this.quickAddTask(taskText, board.id, column.id);
                    quickAddInput.value = '';
                }
            });

            // Also add when input loses focus with content
            quickAddInput.addEventListener('blur', async () => {
                if (quickAddInput.value.trim()) {
                    const taskText = quickAddInput.value.trim();
                    await this.quickAddTask(taskText, board.id, column.id);
                    quickAddInput.value = '';
                }
            });
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
        // Priority color (1=high, 2=medium, 3=low)
        const priority = this.boardEngine.getTodoPriority(board.id, todo.id);
        if (priority === 1) {
            card.addClass('priority-high');
        } else if (priority === 2) {
            card.addClass('priority-medium');
        } else if (priority === 3) {
            card.addClass('priority-low');
        }

        // === CARD HEADER ===
        const header = card.createDiv({ cls: 'taskweaver-card-header' });

        // Checkbox
        const checkbox = header.createEl('input', { type: 'checkbox', cls: 'taskweaver-card-checkbox' });
        checkbox.checked = todo.completed;
        checkbox.addEventListener('change', async () => {
            await this.todoEngine.toggleTodo(todo.id);
        });

        // Text (strip date/tag syntax for cleaner display)
        const cleanText = todo.text
            .replace(/(?:📅|📆|due::?)\d{4}-\d{2}-\d{2}/g, '')
            .replace(/#[\w\-\/]+/g, '')
            .trim();
        const textEl = header.createDiv({ cls: 'taskweaver-card-text' });
        textEl.setText(cleanText || todo.text);

        // === CARD FOOTER ===
        const footer = card.createDiv({ cls: 'taskweaver-card-footer' });

        // Due date badge
        if (todo.dueDate) {
            const dateStatus = this.getDateStatus(todo.dueDate);
            const dateBadge = footer.createSpan({ cls: `taskweaver-card-date ${dateStatus}` });
            dateBadge.setText(this.formatDate(todo.dueDate));
        }

        // Tags
        if (todo.tags && todo.tags.length > 0) {
            const tagsContainer = footer.createDiv({ cls: 'taskweaver-card-tags' });
            for (const tag of todo.tags.slice(0, 3)) { // Max 3 tags
                const tagEl = tagsContainer.createSpan({ cls: 'taskweaver-card-tag' });
                tagEl.setText(tag);
            }
            if (todo.tags.length > 3) {
                const moreEl = tagsContainer.createSpan({ cls: 'taskweaver-card-tag-more' });
                moreEl.setText(`+${todo.tags.length - 3}`);
            }
        }

        // Sub-task expandable section
        if (this.todoEngine.hasSubTasks(todo.id)) {
            const progress = this.todoEngine.getSubTaskProgress(todo.id);
            const subTasksSection = card.createDiv({ cls: 'taskweaver-subtasks-section' });

            // Toggle header
            const toggleHeader = subTasksSection.createDiv({ cls: 'taskweaver-subtasks-toggle' });
            const expandIcon = toggleHeader.createSpan({ cls: 'taskweaver-subtasks-icon', text: '▶' });
            const progressText = toggleHeader.createSpan({ cls: 'taskweaver-subtasks-progress' });
            const percent = Math.round((progress.completed / progress.total) * 100);
            const progressBar = progressText.createSpan({ cls: 'taskweaver-progress-bar' });
            const progressFill = progressBar.createSpan();
            progressFill.style.width = `${percent}%`;
            progressText.createSpan({ text: ` ${progress.completed}/${progress.total}` });

            // Sub-task list (hidden by default)
            const subTasksList = subTasksSection.createDiv({ cls: 'taskweaver-subtasks-list is-collapsed' });
            const subTasks = this.todoEngine.getSubTasks(todo.id);
            for (const subTask of subTasks) {
                const subItem = subTasksList.createDiv({ cls: 'taskweaver-subtask-item' });
                const checkbox = subItem.createEl('input', { type: 'checkbox' });
                checkbox.checked = subTask.completed;
                checkbox.addEventListener('change', async () => {
                    await this.todoEngine.toggleTodo(subTask.id);
                    this.render();
                });
                subItem.createSpan({
                    text: subTask.text.replace(/^[-*]\s*\[.\]\s*/, '').substring(0, 50),
                    cls: subTask.completed ? 'is-completed' : ''
                });
            }

            // Toggle click handler
            toggleHeader.addEventListener('click', (e) => {
                e.stopPropagation();
                const isCollapsed = subTasksList.classList.toggle('is-collapsed');
                expandIcon.setText(isCollapsed ? '▶' : '▼');
            });
        }

        // File link
        const link = footer.createDiv({ cls: 'taskweaver-card-link' });
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

        // Double-click to edit
        card.addEventListener('dblclick', (e) => {
            e.preventDefault();
            e.stopPropagation();
            new EditTaskModal(this.app, this.todoEngine, todo, () => {
                this.render();
            }).open();
        });

        // Context menu
        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showCardContextMenu(e, board, todo);
        });
    }

    // Delegate to shared utilities
    private getDateStatus(dateStr: string): string {
        return getDateStatusClass(dateStr);
    }

    private formatDate(dateStr: string): string {
        return '📅 ' + formatDateRelative(dateStr);
    }

    private renderArchiveColumn(container: HTMLElement, board: Board, archivedTodos: TodoItem[]): void {
        const columnEl = container.createDiv({ cls: 'taskweaver-board-column taskweaver-archive-column' });

        // Header
        const header = columnEl.createDiv({ cls: 'taskweaver-column-header' });
        const titleEl = header.createDiv({ cls: 'taskweaver-column-title' });
        titleEl.setText(`Archive (${archivedTodos.length})`);

        // Clear all button
        const clearBtn = header.createEl('button', { cls: 'taskweaver-archive-clear-btn' });
        clearBtn.setText('Clear All');
        clearBtn.setAttribute('title', 'Remove all archived items');
        clearBtn.addEventListener('click', () => {
            if (confirm('Remove all archived tasks from this board?')) {
                for (const todo of archivedTodos) {
                    this.boardEngine.unarchiveTodo(board.id, todo.id);
                }
                this.onSettingsChange();
            }
        });

        // Archived items list
        const listEl = columnEl.createDiv({ cls: 'taskweaver-column-todos' });

        for (const todo of archivedTodos) {
            const card = listEl.createDiv({
                cls: `taskweaver-card taskweaver-archived-card ${todo.completed ? 'is-completed' : ''}`
            });

            // Text
            const text = card.createDiv({ cls: 'taskweaver-card-text' });
            text.setText(todo.text);

            // File link
            const link = card.createDiv({ cls: 'taskweaver-card-link' });
            const fileName = todo.filePath.split('/').pop() || todo.filePath;
            link.setText(fileName);
            link.addEventListener('click', () => this.openFile(todo));

            // Context menu for unarchive
            card.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const menu = new Menu();

                menu.addItem(item => {
                    item.setTitle('Restore from archive')
                        .setIcon('archive-restore')
                        .onClick(() => {
                            this.boardEngine.unarchiveTodo(board.id, todo.id);
                            this.onSettingsChange();
                        });
                });

                menu.addItem(item => {
                    item.setTitle('Open file')
                        .setIcon('file')
                        .onClick(() => this.openFile(todo));
                });

                menu.showAtMouseEvent(e);
            });
        }
    }

    private showCardContextMenu(e: MouseEvent, board: Board, todo: TodoItem): void {
        const menu = new Menu();

        menu.addItem(item => {
            item.setTitle('Open file')
                .setIcon('file')
                .onClick(() => this.openFile(todo));
        });

        menu.addItem(item => {
            item.setTitle('Move to file...')
                .setIcon('file-input')
                .onClick(() => this.showMoveDialog(todo));
        });

        menu.addItem(item => {
            item.setTitle('Edit task')
                .setIcon('pencil')
                .onClick(() => {
                    new EditTaskModal(this.app, this.todoEngine, todo, async () => {
                        await this.todoEngine.initialize();
                        this.onSettingsChange();
                    }).open();
                });
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

        menu.addSeparator();

        // Priority options
        const currentPriority = this.boardEngine.getTodoPriority(board.id, todo.id);
        menu.addItem(item => {
            item.setTitle('High priority')
                .setIcon(currentPriority === 1 ? 'check' : 'circle')
                .onClick(() => {
                    this.boardEngine.setTodoPriority(board.id, todo.id, currentPriority === 1 ? 0 : 1);
                    this.onSettingsChange();
                });
        });
        menu.addItem(item => {
            item.setTitle('Medium priority')
                .setIcon(currentPriority === 2 ? 'check' : 'circle')
                .onClick(() => {
                    this.boardEngine.setTodoPriority(board.id, todo.id, currentPriority === 2 ? 0 : 2);
                    this.onSettingsChange();
                });
        });
        menu.addItem(item => {
            item.setTitle('Low priority')
                .setIcon(currentPriority === 3 ? 'check' : 'circle')
                .onClick(() => {
                    this.boardEngine.setTodoPriority(board.id, todo.id, currentPriority === 3 ? 0 : 3);
                    this.onSettingsChange();
                });
        });

        menu.addSeparator();

        // Archive option
        menu.addItem(item => {
            item.setTitle('Archive task')
                .setIcon('archive')
                .onClick(() => {
                    this.boardEngine.archiveTodo(board.id, todo.id);
                    this.onSettingsChange();
                });
        });

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
                    .onClick(() => {
                        void this.todoEngine.moveTodoToFile(todo.id, file.path).then((success) => {
                            if (success) {
                                this.onSettingsChange();
                            }
                        });
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

    private async quickAddTask(text: string, boardId: string, columnId: string): Promise<void> {
        // Find or create a default tasks file
        const defaultFilePath = 'Tasks.md';
        let file = this.app.vault.getAbstractFileByPath(defaultFilePath);

        if (!file) {
            // Create the file if it doesn't exist
            await this.app.vault.create(defaultFilePath, '# Tasks\n\n');
            file = this.app.vault.getAbstractFileByPath(defaultFilePath);
        }

        if (file instanceof TFile) {
            const content = await this.app.vault.read(file);
            const newTask = `- [ ] ${text}`;
            const newContent = content.trimEnd() + '\n' + newTask + '\n';
            await this.app.vault.modify(file, newContent);

            // Wait for file to be scanned, then assign to column
            setTimeout(() => {
                // Find the newly created todo
                const todos = this.todoEngine.getTodos(false);
                const newTodo = todos.find(t =>
                    t.filePath === defaultFilePath && t.text.includes(text)
                );
                if (newTodo) {
                    this.boardEngine.assignTodoToColumn(boardId, newTodo.id, columnId);
                    this.onSettingsChange();
                }
            }, 300);
        }
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

    private promptSetWorkLimit(boardId: string, column: Column): void {
        const currentLimit = column.workLimit?.toString() || '';
        new InputModal(this.app, 'Set Work Limit', 'Enter max tasks (leave empty to disable):', currentLimit, (value) => {
            const limit = value.trim() ? parseInt(value.trim(), 10) : undefined;
            if (limit === undefined || (!isNaN(limit) && limit > 0)) {
                this.boardEngine.setColumnWorkLimit(boardId, column.id, limit);
                this.onSettingsChange();
            }
        }).open();
    }

    async onClose(): Promise<void> {
        // Cleanup
    }
}
