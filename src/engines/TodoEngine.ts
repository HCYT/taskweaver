import { TFile, Vault, MetadataCache, EventRef } from 'obsidian';

export interface TodoItem {
    id: string;
    text: string;
    filePath: string;
    lineNumber: number;
    completed: boolean;
    priority: number;
    rawLine: string;
    pinned: boolean;
    indentLevel: number;      // Indentation level (0 = root)
    parentId: string | null;  // Parent todo ID (null = no parent)
    dueDate: string | null;   // Due date in YYYY-MM-DD format
    tags: string[];           // Tags extracted from task text
}

export interface TodoEngineSettings {
    priorityOrder: string[]; // list of todo IDs in order
    hideCompleted: boolean;  // hide completed todos from display
    excludeFolders: string[]; // folders to exclude from scanning
    includeFolders: string[]; // folders to include (if set, only scan these)
    tagFilters: string[]; // only show todos with these tags (empty = all)
    pinnedIds: string[]; // pinned todo IDs
    priorities: Record<string, number>; // global priority map (1=high, 2=medium, 3=low)
    archivedIds: string[]; // archived todo IDs (hidden from list view)
}

export class TodoEngine {
    private vault: Vault;
    private metadataCache: MetadataCache;
    private todos: Map<string, TodoItem> = new Map();
    private settings: TodoEngineSettings;
    private onUpdateCallbacks: ((todos: TodoItem[]) => void)[] = [];
    private fileEventRef: EventRef | null = null;
    private debounceTimer: ReturnType<typeof setTimeout> | null = null;
    private pendingFiles: Set<string> = new Set();
    private readonly DEBOUNCE_MS = 150;

    constructor(vault: Vault, metadataCache: MetadataCache, settings: TodoEngineSettings) {
        this.vault = vault;
        this.metadataCache = metadataCache;
        this.settings = settings;
    }

    async initialize(): Promise<void> {
        await this.scanAllFiles();
        this.setupFileWatcher();
    }

    destroy(): void {
        if (this.fileEventRef) {
            this.vault.offref(this.fileEventRef);
        }
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
    }

    private setupFileWatcher(): void {
        this.fileEventRef = this.vault.on('modify', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.queueFileUpdate(file.path);
            }
        });

        this.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.removeTodosFromFile(file.path);
                this.scheduleDebouncedUpdate();
            }
        });

        this.vault.on('create', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.queueFileUpdate(file.path);
            }
        });

        this.vault.on('rename', async (file, oldPath) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.removeTodosFromFile(oldPath);
                this.queueFileUpdate(file.path);
            }
        });
    }

    private queueFileUpdate(filePath: string): void {
        this.pendingFiles.add(filePath);
        this.scheduleDebouncedUpdate();
    }

    private scheduleDebouncedUpdate(): void {
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        this.debounceTimer = setTimeout(() => this.processPendingUpdates(), this.DEBOUNCE_MS);
    }

    private async processPendingUpdates(): Promise<void> {
        const filesToProcess = Array.from(this.pendingFiles);
        this.pendingFiles.clear();

        for (const filePath of filesToProcess) {
            const file = this.vault.getAbstractFileByPath(filePath);
            if (file instanceof TFile) {
                await this.scanFile(file);
            }
        }

        if (filesToProcess.length > 0) {
            this.notifyUpdate();
        }
    }

    private async scanAllFiles(): Promise<void> {
        const files = this.vault.getMarkdownFiles().filter(f => !this.isExcluded(f.path));
        for (const file of files) {
            await this.scanFile(file);
        }
    }

    private isExcluded(filePath: string): boolean {
        // If includeFolders is set and not empty, only include those folders
        const includeFolders = this.settings.includeFolders || [];
        if (includeFolders.length > 0) {
            const included = includeFolders.some(folder => {
                const normalized = folder.endsWith('/') ? folder : folder + '/';
                return filePath.startsWith(normalized) || filePath.startsWith(folder);
            });
            if (!included) return true;
        }

        // Check excludeFolders
        return (this.settings.excludeFolders || []).some(folder => {
            const normalized = folder.endsWith('/') ? folder : folder + '/';
            return filePath.startsWith(normalized) || filePath.startsWith(folder);
        });
    }

    private async scanFile(file: TFile): Promise<void> {
        // Remove existing todos from this file
        this.removeTodosFromFile(file.path);

        // Use vault.read (not cachedRead) for fresh content
        const content = await this.vault.read(file);
        const lines = content.split('\n');

        // Regex for markdown todo items: - [ ] or - [x] or * [ ] or * [x]
        const todoRegex = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/;

        // Track parent stack for sub-task hierarchy
        const parentStack: { id: string; indent: number }[] = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const match = line.match(todoRegex);

            if (match && match[1] !== undefined && match[2] && match[3]) {
                const indent = match[1].length;
                const indentLevel = Math.floor(indent / 2); // Assume 2-space indentation
                const completed = match[2].toLowerCase() === 'x';
                const text = match[3].trim();
                const id = this.generateId(file.path, i + 1, text);

                // Pop parents with equal or greater indent
                while (parentStack.length > 0) {
                    const lastParent = parentStack[parentStack.length - 1];
                    if (lastParent && lastParent.indent >= indent) {
                        parentStack.pop();
                    } else {
                        break;
                    }
                }

                // Find parent (last item in stack if any)
                const lastItem = parentStack[parentStack.length - 1];
                const parentId = lastItem ? lastItem.id : null;

                // Extract due date (📅YYYY-MM-DD or due::YYYY-MM-DD or 📆YYYY-MM-DD)
                const dueDateMatch = text.match(/(?:📅|📆|due::?)(\d{4}-\d{2}-\d{2})/);
                const dueDate = dueDateMatch ? dueDateMatch[1] ?? null : null;

                // Extract tags (#tag format)
                const tagMatches = text.match(/#[\w\-\/]+/g);
                const tags = tagMatches ? tagMatches : [];

                const todo: TodoItem = {
                    id,
                    text,
                    filePath: file.path,
                    lineNumber: i + 1,
                    completed,
                    priority: this.getPriority(id),
                    rawLine: line,
                    pinned: this.isPinned(id),
                    indentLevel,
                    parentId,
                    dueDate,
                    tags,
                };

                this.todos.set(id, todo);

                // Push current todo as potential parent
                parentStack.push({ id, indent });
            }
        }
    }

    private removeTodosFromFile(filePath: string): void {
        for (const [id, todo] of this.todos) {
            if (todo.filePath === filePath) {
                this.todos.delete(id);
            }
        }
    }

    private generateId(filePath: string, lineNumber: number, _text: string): string {
        // Use only file path and line number for stable ID (column assignments survive text edits)
        return `${filePath}:${lineNumber}`;
    }

    private hashString(str: string): string {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return Math.abs(hash).toString(36);
    }

    private getPriority(id: string): number {
        const index = this.settings.priorityOrder.indexOf(id);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    }

    // Public API

    getTodos(respectFilters: boolean = true): TodoItem[] {
        let todos = Array.from(this.todos.values());

        if (respectFilters && this.settings.hideCompleted) {
            todos = todos.filter(t => !t.completed);
        }

        // Tag filter: only show todos containing specified tags
        const tagFilters = this.settings.tagFilters || [];
        if (respectFilters && tagFilters.length > 0) {
            todos = todos.filter(todo =>
                tagFilters.some(tag => todo.text.includes(tag))
            );
        }

        // Pinned items always on top, then sort by priority
        return todos.sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return a.priority - b.priority;
        });
    }

    getAllTodos(): TodoItem[] {
        return this.getTodos(false);
    }

    // Sub-task methods
    getSubTasks(todoId: string): TodoItem[] {
        return Array.from(this.todos.values())
            .filter(t => t.parentId === todoId)
            .sort((a, b) => a.lineNumber - b.lineNumber);
    }

    getRootTodos(): TodoItem[] {
        return this.getTodos().filter(t => t.parentId === null);
    }

    hasSubTasks(todoId: string): boolean {
        return Array.from(this.todos.values()).some(t => t.parentId === todoId);
    }

    getSubTaskProgress(todoId: string): { completed: number; total: number } {
        const subTasks = this.getSubTasks(todoId);
        return {
            completed: subTasks.filter(t => t.completed).length,
            total: subTasks.length
        };
    }

    findDuplicates(): Map<string, TodoItem[]> {
        const textMap = new Map<string, TodoItem[]>();

        for (const todo of this.todos.values()) {
            const key = todo.text.toLowerCase().trim();
            if (!textMap.has(key)) {
                textMap.set(key, []);
            }
            textMap.get(key)!.push(todo);
        }

        // Filter to only duplicates
        const duplicates = new Map<string, TodoItem[]>();
        for (const [key, todos] of textMap) {
            if (todos.length > 1) {
                duplicates.set(key, todos);
            }
        }

        return duplicates;
    }

    getDuplicateIds(): Set<string> {
        const duplicates = this.findDuplicates();
        const ids = new Set<string>();
        for (const todos of duplicates.values()) {
            for (const todo of todos) {
                ids.add(todo.id);
            }
        }
        return ids;
    }

    updatePriorities(orderedIds: string[]): void {
        this.settings.priorityOrder = orderedIds;
        // Update priority values in todos
        for (const [id, todo] of this.todos) {
            todo.priority = this.getPriority(id);
        }
    }

    isPinned(todoId: string): boolean {
        return (this.settings.pinnedIds || []).includes(todoId);
    }

    togglePin(todoId: string): void {
        // Ensure pinnedIds exists
        if (!this.settings.pinnedIds) {
            this.settings.pinnedIds = [];
        }
        const index = this.settings.pinnedIds.indexOf(todoId);
        if (index === -1) {
            this.settings.pinnedIds.push(todoId);
        } else {
            this.settings.pinnedIds.splice(index, 1);
        }
        // Update the todo's pinned state
        const todo = this.todos.get(todoId);
        if (todo) {
            todo.pinned = this.isPinned(todoId);
        }
        this.notifyUpdate();
    }

    // Global priority (for List View mode)
    getGlobalPriority(todoId: string): number {
        return (this.settings.priorities || {})[todoId] || 0;
    }

    setGlobalPriority(todoId: string, priority: number): void {
        if (!this.settings.priorities) {
            this.settings.priorities = {};
        }
        if (priority === 0) {
            delete this.settings.priorities[todoId];
        } else {
            this.settings.priorities[todoId] = priority;
        }
        this.notifyUpdate();
    }

    // Global archive (for List View mode)
    isArchived(todoId: string): boolean {
        return (this.settings.archivedIds || []).includes(todoId);
    }

    toggleArchive(todoId: string): void {
        if (!this.settings.archivedIds) {
            this.settings.archivedIds = [];
        }
        const index = this.settings.archivedIds.indexOf(todoId);
        if (index === -1) {
            this.settings.archivedIds.push(todoId);
        } else {
            this.settings.archivedIds.splice(index, 1);
        }
        this.notifyUpdate();
    }

    getArchivedTodos(): TodoItem[] {
        const archivedIds = this.settings.archivedIds || [];
        return Array.from(this.todos.values()).filter(t => archivedIds.includes(t.id));
    }

    async moveTodoToFile(todoId: string, targetFilePath: string): Promise<boolean> {
        const todo = this.todos.get(todoId);
        if (!todo) return false;

        const sourceFile = this.vault.getAbstractFileByPath(todo.filePath);
        const targetFile = this.vault.getAbstractFileByPath(targetFilePath);

        if (!(sourceFile instanceof TFile) || !(targetFile instanceof TFile)) {
            return false;
        }

        // Remove from source file
        const sourceContent = await this.vault.read(sourceFile);
        const sourceLines = sourceContent.split('\n');
        sourceLines.splice(todo.lineNumber - 1, 1);
        await this.vault.modify(sourceFile, sourceLines.join('\n'));

        // Add to target file
        const targetContent = await this.vault.read(targetFile);
        const newContent = targetContent + '\n' + todo.rawLine;
        await this.vault.modify(targetFile, newContent);

        return true;
    }

    async toggleTodo(todoId: string): Promise<boolean> {
        const todo = this.todos.get(todoId);
        if (!todo) return false;

        const file = this.vault.getAbstractFileByPath(todo.filePath);
        if (!(file instanceof TFile)) return false;

        const content = await this.vault.read(file);
        const lines = content.split('\n');
        const line = lines[todo.lineNumber - 1];
        if (!line) return false;

        // Toggle the checkbox
        const newLine = todo.completed
            ? line.replace(/\[x\]/i, '[ ]')
            : line.replace(/\[ \]/, '[x]');

        lines[todo.lineNumber - 1] = newLine;
        await this.vault.modify(file, lines.join('\n'));

        return true;
    }

    onUpdate(callback: (todos: TodoItem[]) => void): void {
        this.onUpdateCallbacks.push(callback);
    }

    private notifyUpdate(): void {
        const todos = this.getTodos();
        for (const callback of this.onUpdateCallbacks) {
            callback(todos);
        }
    }

    search(query: string): TodoItem[] {
        const lowerQuery = query.toLowerCase();
        return this.getTodos().filter(todo =>
            todo.text.toLowerCase().includes(lowerQuery) ||
            todo.filePath.toLowerCase().includes(lowerQuery)
        );
    }
}
