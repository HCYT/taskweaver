import { ItemView, WorkspaceLeaf, TFile, Menu } from 'obsidian';
import { TodoItem, TodoEngine } from './TodoEngine';

export const VIEW_TYPE_TODO = 'taskweaver-view';

export class TodoView extends ItemView {
    private engine: TodoEngine;
    private searchInput: HTMLInputElement;
    private listEl: HTMLElement;
    private currentFilter: string = '';
    private duplicateIds: Set<string> = new Set();
    private draggedItem: HTMLElement | null = null;
    private onSettingsChange: () => void;

    constructor(leaf: WorkspaceLeaf, engine: TodoEngine, onSettingsChange: () => void) {
        super(leaf);
        this.engine = engine;
        this.onSettingsChange = onSettingsChange;
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

        // Header with search
        const header = contentEl.createDiv({ cls: 'taskweaver-header' });
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

        let todos = this.currentFilter
            ? this.engine.search(this.currentFilter)
            : this.engine.getTodos();

        // Update stats
        const statsBar = this.contentEl.querySelector('.taskweaver-stats');
        if (statsBar) this.updateStats(statsBar as HTMLElement);

        if (todos.length === 0) {
            this.listEl.createDiv({
                text: this.currentFilter ? 'No matching todos' : 'No todos found',
                cls: 'taskweaver-empty',
            });
            return;
        }

        for (const todo of todos) {
            this.renderTodoItem(todo);
        }
    }

    private renderTodoItem(todo: TodoItem): void {
        const item = this.listEl.createDiv({ cls: 'taskweaver-item' });
        item.setAttribute('data-id', todo.id);
        item.setAttribute('draggable', 'true');

        if (todo.completed) {
            item.addClass('is-completed');
        }
        if (this.duplicateIds.has(todo.id)) {
            item.addClass('is-duplicate');
        }

        // Drag handle
        const handle = item.createDiv({ cls: 'taskweaver-drag-handle' });
        handle.innerHTML = '⋮⋮';

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

        // Drag events
        item.addEventListener('dragstart', (e) => this.onDragStart(e, item));
        item.addEventListener('dragend', () => this.onDragEnd());
        item.addEventListener('dragover', (e) => this.onDragOver(e, item));
        item.addEventListener('drop', (e) => this.onDrop(e, item));

        // Context menu
        item.addEventListener('contextmenu', (e) => this.showContextMenu(e, todo));
    }

    private async openFile(todo: TodoItem): Promise<void> {
        const file = this.app.vault.getAbstractFileByPath(todo.filePath);
        if (file instanceof TFile) {
            const leaf = this.app.workspace.getLeaf(false);
            await leaf.openFile(file);
            // Scroll to line
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

    private onDragStart(e: DragEvent, item: HTMLElement): void {
        this.draggedItem = item;
        item.addClass('is-dragging');
        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.getAttribute('data-id') || '');
        }
    }

    private onDragEnd(): void {
        if (this.draggedItem) {
            this.draggedItem.removeClass('is-dragging');
            this.draggedItem = null;
        }
        // Remove all drag-over classes
        this.listEl.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));
    }

    private onDragOver(e: DragEvent, item: HTMLElement): void {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }

        // Remove previous drag-over classes
        this.listEl.querySelectorAll('.drag-over').forEach(el => el.removeClass('drag-over'));

        if (item !== this.draggedItem) {
            item.addClass('drag-over');
        }
    }

    private onDrop(e: DragEvent, targetItem: HTMLElement): void {
        e.preventDefault();

        if (!this.draggedItem || targetItem === this.draggedItem) return;

        // Get all item IDs in new order
        const items = Array.from(this.listEl.querySelectorAll('.taskweaver-item'));
        const draggedIndex = items.indexOf(this.draggedItem);
        const targetIndex = items.indexOf(targetItem);

        // Reorder in DOM
        if (draggedIndex < targetIndex) {
            targetItem.after(this.draggedItem);
        } else {
            targetItem.before(this.draggedItem);
        }

        // Update engine priorities
        const newOrder = Array.from(this.listEl.querySelectorAll('.taskweaver-item'))
            .map(el => el.getAttribute('data-id'))
            .filter((id): id is string => id !== null);

        this.engine.updatePriorities(newOrder);
        this.onSettingsChange();

        targetItem.removeClass('drag-over');
    }

    private showContextMenu(e: MouseEvent, todo: TodoItem): void {
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

        menu.addItem((item) => {
            item.setTitle(todo.completed ? 'Mark incomplete' : 'Mark complete')
                .setIcon(todo.completed ? 'square' : 'check-square')
                .onClick(() => this.engine.toggleTodo(todo.id));
        });

        menu.showAtMouseEvent(e);
    }

    private async showMoveDialog(todo: TodoItem): Promise<void> {
        const files = this.app.vault.getMarkdownFiles()
            .filter(f => f.path !== todo.filePath)
            .sort((a, b) => a.path.localeCompare(b.path));

        const menu = new Menu();

        for (const file of files.slice(0, 20)) { // Limit to 20 files
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

        menu.showAtPosition({ x: 0, y: 0 }); // Will be positioned by Obsidian
    }

    async onClose(): Promise<void> {
        // Cleanup
    }
}
