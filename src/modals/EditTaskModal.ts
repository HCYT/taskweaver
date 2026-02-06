import { App, Modal, Setting, Notice } from 'obsidian';
import { TodoItem, TodoEngine } from '../engines/TodoEngine';

export class EditTaskModal extends Modal {
    private todoEngine: TodoEngine;
    private todo: TodoItem;
    private onTaskUpdated: () => void;

    private taskText: string;
    private dueDate: string = '';
    private tags: string[] = [];
    private completedState: boolean; // Local state for checkbox

    constructor(app: App, todoEngine: TodoEngine, todo: TodoItem, onTaskUpdated: () => void) {
        super(app);
        this.todoEngine = todoEngine;
        this.todo = todo;
        this.onTaskUpdated = onTaskUpdated;

        // Parse existing task data
        this.taskText = this.parseTaskText(todo.text);
        this.dueDate = this.parseDueDate(todo.text);
        this.tags = this.parseTags(todo.text);
        this.completedState = todo.completed;
    }

    private parseTaskText(text: string): string {
        // Remove date markers, priority emojis, and tags
        return text
            .replace(/📅\s*\d{4}-\d{2}-\d{2}/g, '')
            .replace(/[⏫🔼🔽]/g, '')
            .replace(/#\w+/g, '')
            .trim();
    }

    private parseDueDate(text: string): string {
        const match = text.match(/📅\s*(\d{4}-\d{2}-\d{2})/);
        return match?.[1] ?? '';
    }

    private parseTags(text: string): string[] {
        const matches = text.match(/#\w+/g);
        return matches || [];
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-edit-modal');

        // Header
        const header = contentEl.createDiv('taskweaver-modal-header');
        header.createEl('h2', { text: 'Edit Task' });

        // Main Content Area
        const main = contentEl.createDiv('taskweaver-modal-body');

        // 1. Task Description (Large Textarea)
        const taskSection = main.createDiv('taskweaver-field-group full-width');
        taskSection.createEl('label', { text: 'Description' });
        const textArea = taskSection.createEl('textarea', { cls: 'taskweaver-task-textarea' });
        textArea.value = this.taskText;
        textArea.placeholder = 'What needs to be done?';
        textArea.rows = 4;
        textArea.addEventListener('input', (e) => {
            this.taskText = (e.target as HTMLTextAreaElement).value;
        });

        // 2. Metadata Grid (Date, Status)
        const metaGrid = main.createDiv('taskweaver-meta-grid');

        // Due Date
        const dateSection = metaGrid.createDiv('taskweaver-field-group');
        dateSection.createEl('label', { text: 'Due Date' });
        const dateInput = dateSection.createEl('input', { type: 'date', cls: 'taskweaver-input' });
        dateInput.value = this.dueDate;
        dateInput.addEventListener('change', (e) => {
            this.dueDate = (e.target as HTMLInputElement).value;
        });

        // Status
        const statusSection = metaGrid.createDiv('taskweaver-field-group');
        statusSection.createEl('label', { text: 'Status' });
        const statusToggle = new Setting(statusSection)
            .addToggle(toggle => {
                toggle.setValue(this.completedState)
                    .onChange((value) => {
                        this.completedState = value;
                    });
            });

        // Tags Preview (Read-only for now or simple display)
        if (this.tags.length > 0) {
            const tagSection = main.createDiv('taskweaver-field-group');
            tagSection.createEl('label', { text: 'Tags' });
            const tagContainer = tagSection.createDiv('taskweaver-tags-list');
            this.tags.forEach(tag => {
                tagContainer.createSpan({ text: tag, cls: 'taskweaver-tag' });
            });
        }

        // Footer Info
        const footerInfo = contentEl.createDiv('taskweaver-modal-info');
        footerInfo.createSpan({ text: `${this.todo.filePath}:${this.todo.lineNumber}`, cls: 'taskweaver-monospace' });


        // Actions Footer
        const actions = contentEl.createDiv('taskweaver-modal-actions');

        const deleteBtn = actions.createEl('button', { text: 'Delete', cls: 'mod-warning' });
        deleteBtn.addEventListener('click', () => this.confirmDelete());

        const spacer = actions.createDiv({ cls: 'spacer' });
        spacer.style.flex = '1';

        const cancelBtn = actions.createEl('button', { text: 'Cancel' });
        cancelBtn.addEventListener('click', () => this.close());

        const saveBtn = actions.createEl('button', { text: 'Save', cls: 'mod-cta' });
        saveBtn.addEventListener('click', () => this.submit());
    }

    private async submit(): Promise<void> {
        if (!this.taskText.trim()) {
            new Notice('Task text cannot be empty');
            return;
        }

        // Rebuild task line
        let newTaskLine = this.taskText.trim();

        // Add tags back
        if (this.tags.length > 0) {
            newTaskLine += ' ' + this.tags.join(' ');
        }

        // Add due date
        if (this.dueDate) {
            newTaskLine += ` 📅 ${this.dueDate}`;
        }

        // Update in file
        try {
            const file = this.app.vault.getAbstractFileByPath(this.todo.filePath);
            if (file) {
                const content = await this.app.vault.read(file as any);
                const lines = content.split('\n');
                const lineIndex = this.todo.lineNumber - 1;

                if (lineIndex >= 0 && lineIndex < lines.length) {
                    // Preserve checkbox state
                    const checkbox = this.completedState ? '- [x]' : '- [ ]';
                    lines[lineIndex] = `${checkbox} ${newTaskLine}`;

                    await this.app.vault.modify(file as any, lines.join('\n'));
                    new Notice('Task updated');
                    this.close();
                    try {
                        this.onTaskUpdated();
                    } catch (e) {
                        console.error('Error updating task view:', e);
                    }
                }
            }
        } catch (error) {
            new Notice('Failed to update task: ' + error);
        }
    }

    private async confirmDelete(): Promise<void> {
        if (!confirm('Delete this task permanently?')) {
            return;
        }

        try {
            const file = this.app.vault.getAbstractFileByPath(this.todo.filePath);
            if (file) {
                const content = await this.app.vault.read(file as any);
                const lines = content.split('\n');
                const lineIndex = this.todo.lineNumber - 1;

                if (lineIndex >= 0 && lineIndex < lines.length) {
                    lines.splice(lineIndex, 1);
                    await this.app.vault.modify(file as any, lines.join('\n'));
                    new Notice('Task deleted');
                    this.close();
                    try {
                        this.onTaskUpdated();
                    } catch (e) {
                        console.error('Error updating task view:', e);
                    }
                }
            }
        } catch (error) {
            new Notice('Failed to delete task: ' + error);
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
