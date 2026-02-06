import { TFile, Vault, MetadataCache, EventRef } from 'obsidian';

export interface TodoItem {
    id: string;
    text: string;
    filePath: string;
    lineNumber: number;
    completed: boolean;
    priority: number;
    rawLine: string;
}

export interface TodoEngineSettings {
    priorityOrder: string[]; // list of todo IDs in order
    hideCompleted: boolean;  // hide completed todos from display
    excludeFolders: string[]; // folders to exclude from scanning
}

export class TodoEngine {
    private vault: Vault;
    private metadataCache: MetadataCache;
    private todos: Map<string, TodoItem> = new Map();
    private settings: TodoEngineSettings;
    private onUpdateCallbacks: ((todos: TodoItem[]) => void)[] = [];
    private fileEventRef: EventRef | null = null;

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
    }

    private setupFileWatcher(): void {
        this.fileEventRef = this.vault.on('modify', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                await this.scanFile(file);
                this.notifyUpdate();
            }
        });

        this.vault.on('delete', (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.removeTodosFromFile(file.path);
                this.notifyUpdate();
            }
        });

        this.vault.on('create', async (file) => {
            if (file instanceof TFile && file.extension === 'md') {
                await this.scanFile(file);
                this.notifyUpdate();
            }
        });

        this.vault.on('rename', async (file, oldPath) => {
            if (file instanceof TFile && file.extension === 'md') {
                this.removeTodosFromFile(oldPath);
                await this.scanFile(file);
                this.notifyUpdate();
            }
        });
    }

    private async scanAllFiles(): Promise<void> {
        const files = this.vault.getMarkdownFiles().filter(f => !this.isExcluded(f.path));
        for (const file of files) {
            await this.scanFile(file);
        }
    }

    private isExcluded(filePath: string): boolean {
        return this.settings.excludeFolders.some(folder => {
            const normalized = folder.endsWith('/') ? folder : folder + '/';
            return filePath.startsWith(normalized) || filePath.startsWith(folder);
        });
    }

    private async scanFile(file: TFile): Promise<void> {
        // Remove existing todos from this file
        this.removeTodosFromFile(file.path);

        const content = await this.vault.cachedRead(file);
        const lines = content.split('\n');

        // Regex for markdown todo items: - [ ] or - [x] or * [ ] or * [x]
        const todoRegex = /^(\s*)[-*]\s+\[([ xX])\]\s+(.+)$/;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) continue;
            const match = line.match(todoRegex);

            if (match && match[2] && match[3]) {
                const completed = match[2].toLowerCase() === 'x';
                const text = match[3].trim();
                const id = this.generateId(file.path, i + 1, text);

                const todo: TodoItem = {
                    id,
                    text,
                    filePath: file.path,
                    lineNumber: i + 1,
                    completed,
                    priority: this.getPriority(id),
                    rawLine: line,
                };

                this.todos.set(id, todo);
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

    private generateId(filePath: string, lineNumber: number, text: string): string {
        // Create a stable ID based on file path and text content
        const hash = this.hashString(`${filePath}:${text}`);
        return `${hash}-${lineNumber}`;
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

        return todos.sort((a, b) => a.priority - b.priority);
    }

    getAllTodos(): TodoItem[] {
        return this.getTodos(false);
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
