import { TodoItem, TodoEngine } from './TodoEngine';

export interface Column {
    id: string;
    name: string;
}

export interface Board {
    id: string;
    name: string;
    columns: Column[];
    pinnedIds: string[];
    todoAssignments: Record<string, string>; // todoId -> columnId
}

export interface BoardSettings {
    boards: Board[];
    activeBoardId: string | null;
}

const DEFAULT_COLUMNS: Column[] = [
    { id: 'todo', name: 'To Do' },
    { id: 'in-progress', name: 'In Progress' },
    { id: 'done', name: 'Done' },
];

export class BoardEngine {
    private settings: BoardSettings;
    private todoEngine: TodoEngine;
    private onUpdateCallbacks: (() => void)[] = [];

    constructor(settings: BoardSettings, todoEngine: TodoEngine) {
        this.settings = settings;
        this.todoEngine = todoEngine;

        // Ensure settings has boards array
        if (!this.settings.boards) {
            this.settings.boards = [];
        }
    }

    // Board CRUD
    createBoard(name: string): Board {
        const board: Board = {
            id: this.generateId(),
            name,
            columns: [...DEFAULT_COLUMNS],
            pinnedIds: [],
            todoAssignments: {},
        };
        this.settings.boards.push(board);
        if (!this.settings.activeBoardId) {
            this.settings.activeBoardId = board.id;
        }
        this.notifyUpdate();
        return board;
    }

    deleteBoard(boardId: string): void {
        const index = this.settings.boards.findIndex(b => b.id === boardId);
        if (index !== -1) {
            this.settings.boards.splice(index, 1);
            if (this.settings.activeBoardId === boardId) {
                this.settings.activeBoardId = this.settings.boards[0]?.id ?? null;
            }
            this.notifyUpdate();
        }
    }

    renameBoard(boardId: string, name: string): void {
        const board = this.getBoard(boardId);
        if (board) {
            board.name = name;
            this.notifyUpdate();
        }
    }

    getBoard(boardId: string): Board | undefined {
        return this.settings.boards.find(b => b.id === boardId);
    }

    getActiveBoard(): Board | undefined {
        if (!this.settings.activeBoardId) return undefined;
        return this.getBoard(this.settings.activeBoardId);
    }

    setActiveBoard(boardId: string): void {
        if (this.getBoard(boardId)) {
            this.settings.activeBoardId = boardId;
            this.notifyUpdate();
        }
    }

    getAllBoards(): Board[] {
        return this.settings.boards;
    }

    // Column management
    addColumn(boardId: string, name: string): void {
        const board = this.getBoard(boardId);
        if (board) {
            board.columns.push({
                id: this.generateId(),
                name,
            });
            this.notifyUpdate();
        }
    }

    removeColumn(boardId: string, columnId: string): void {
        const board = this.getBoard(boardId);
        if (board) {
            board.columns = board.columns.filter(c => c.id !== columnId);
            // Remove assignments to this column
            for (const todoId of Object.keys(board.todoAssignments)) {
                if (board.todoAssignments[todoId] === columnId) {
                    delete board.todoAssignments[todoId];
                }
            }
            this.notifyUpdate();
        }
    }

    renameColumn(boardId: string, columnId: string, name: string): void {
        const board = this.getBoard(boardId);
        if (board) {
            const column = board.columns.find(c => c.id === columnId);
            if (column) {
                column.name = name;
                this.notifyUpdate();
            }
        }
    }

    reorderColumns(boardId: string, orderedColumnIds: string[]): void {
        const board = this.getBoard(boardId);
        if (!board) return;

        const newColumns: Column[] = [];
        for (const id of orderedColumnIds) {
            const column = board.columns.find(c => c.id === id);
            if (column) {
                newColumns.push(column);
            }
        }
        board.columns = newColumns;
        this.notifyUpdate();
    }

    moveColumn(boardId: string, columnId: string, direction: 'left' | 'right'): void {
        const board = this.getBoard(boardId);
        if (!board) return;

        const index = board.columns.findIndex(c => c.id === columnId);
        if (index === -1) return;

        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= board.columns.length) return;

        // Swap columns
        const temp = board.columns[index]!;
        board.columns[index] = board.columns[newIndex]!;
        board.columns[newIndex] = temp;
        this.notifyUpdate();
    }

    // Todo assignment to columns
    assignTodoToColumn(boardId: string, todoId: string, columnId: string): void {
        const board = this.getBoard(boardId);
        if (board) {
            board.todoAssignments[todoId] = columnId;
            this.notifyUpdate();
        }
    }

    getTodoColumn(boardId: string, todoId: string): string | undefined {
        const board = this.getBoard(boardId);
        if (!board) return undefined;
        return board.todoAssignments[todoId];
    }

    // Get todos for a specific column
    getTodosForColumn(boardId: string, columnId: string): TodoItem[] {
        const board = this.getBoard(boardId);
        if (!board) return [];

        const allTodos = this.todoEngine.getTodos();
        const defaultColumnId = board.columns[0]?.id;

        return allTodos.filter(todo => {
            const assignedColumn = board.todoAssignments[todo.id] ?? defaultColumnId;
            return assignedColumn === columnId;
        }).sort((a, b) => {
            // Board-specific pinned items on top
            const aPinned = board.pinnedIds.includes(a.id);
            const bPinned = board.pinnedIds.includes(b.id);
            if (aPinned && !bPinned) return -1;
            if (!aPinned && bPinned) return 1;
            return 0;
        });
    }

    // Board-specific pinning
    toggleBoardPin(boardId: string, todoId: string): void {
        const board = this.getBoard(boardId);
        if (!board) return;

        const index = board.pinnedIds.indexOf(todoId);
        if (index === -1) {
            board.pinnedIds.push(todoId);
        } else {
            board.pinnedIds.splice(index, 1);
        }
        this.notifyUpdate();
    }

    isBoardPinned(boardId: string, todoId: string): boolean {
        const board = this.getBoard(boardId);
        if (!board) return false;
        return board.pinnedIds.includes(todoId);
    }

    // Callbacks
    onUpdate(callback: () => void): void {
        this.onUpdateCallbacks.push(callback);
    }

    private notifyUpdate(): void {
        for (const callback of this.onUpdateCallbacks) {
            callback();
        }
    }

    private generateId(): string {
        return Math.random().toString(36).substring(2, 10);
    }
}
