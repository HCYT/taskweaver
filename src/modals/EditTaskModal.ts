import { App, Modal, Setting, Notice } from 'obsidian';
import { TodoItem, TodoEngine } from '../engines/TodoEngine';

export class EditTaskModal extends Modal {
    private todoEngine: TodoEngine;
    private todo: TodoItem;
    private onTaskUpdated: () => void;

    private taskText: string;
    private dueDate: string = '';
    private tags: string[] = [];

    constructor(app: App, todoEngine: TodoEngine, todo: TodoItem, onTaskUpdated: () => void) {
        super(app);
        this.todoEngine = todoEngine;
        this.todo = todo;
        this.onTaskUpdated = onTaskUpdated;

        // Parse existing task data
        this.taskText = this.parseTaskText(todo.text);
        this.dueDate = this.parseDueDate(todo.text);
        this.tags = this.parseTags(todo.text);
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
        contentEl.addClass('taskweaver-edit-task-modal');
        contentEl.createEl('h2', { text: 'Edit Task' });

        // Task text input
        new Setting(contentEl)
            .setName('Task')
            .addTextArea(text => {
                text.setValue(this.taskText)
                    .setPlaceholder('Task description')
                    .onChange(value => { this.taskText = value; });
                text.inputEl.rows = 3;
                text.inputEl.addClass('taskweaver-task-textarea');
            });

        // Due date
        new Setting(contentEl)
            .setName('Due date')
            .addText(text => {
                text.setValue(this.dueDate)
                    .setPlaceholder('YYYY-MM-DD')
                    .onChange(value => { this.dueDate = value; });
                text.inputEl.type = 'date';
            });

        // Tags display
        new Setting(contentEl)
            .setName('Tags')
            .setDesc(this.tags.length > 0 ? this.tags.join(' ') : 'No tags');

        // File info
        const fileInfo = contentEl.createDiv({ cls: 'taskweaver-edit-file-info' });
        fileInfo.createSpan({ text: `File: ${this.todo.filePath}` });
        fileInfo.createSpan({ text: ` (line ${this.todo.lineNumber})` });

        // Status
        new Setting(contentEl)
            .setName('Status')
            .addToggle(toggle => {
                toggle.setValue(this.todo.completed)
                    .onChange(async (value) => {
                        if (value !== this.todo.completed) {
                            await this.todoEngine.toggleTodo(this.todo.id);
                        }
                    });
            })
            .setDesc(this.todo.completed ? 'Completed' : 'Not completed');

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Save')
                .setCta()
                .onClick(() => this.submit()))
            .addButton(btn => btn
                .setButtonText('Delete')
                .setWarning()
                .onClick(() => this.confirmDelete()))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()));
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
                    const checkbox = this.todo.completed ? '- [x]' : '- [ ]';
                    lines[lineIndex] = `${checkbox} ${newTaskLine}`;

                    await this.app.vault.modify(file as any, lines.join('\n'));
                    new Notice('Task updated');
                    this.close();
                    this.onTaskUpdated();
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
                    this.onTaskUpdated();
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
