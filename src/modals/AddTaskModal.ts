import { App, Modal, Setting, TFile, Notice } from 'obsidian';
import { TodoEngine } from '../engines/TodoEngine';

export class AddTaskModal extends Modal {
    private todoEngine: TodoEngine;
    private onTaskAdded: () => void;

    private taskText: string = '';
    private targetFile: TFile | null = null;
    private dueDate: string = '';
    private priority: number = 0; // 0=none, 1=high, 2=medium, 3=low

    constructor(app: App, todoEngine: TodoEngine, onTaskAdded: () => void) {
        super(app);
        this.todoEngine = todoEngine;
        this.onTaskAdded = onTaskAdded;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.addClass('taskweaver-add-task-modal');
        contentEl.createEl('h2', { text: 'Add New Task' });

        // Task text input
        new Setting(contentEl)
            .setName('Task')
            .setDesc('Enter the task description')
            .addText(text => {
                text.setPlaceholder('What needs to be done?')
                    .onChange(value => { this.taskText = value; });
                text.inputEl.addClass('taskweaver-task-input');
                // Focus on open
                setTimeout(() => text.inputEl.focus(), 50);
                // Enter to submit
                text.inputEl.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.submit();
                    }
                });
            });

        // Target file selector
        new Setting(contentEl)
            .setName('Add to file')
            .setDesc('Select where to add this task')
            .addDropdown(dropdown => {
                const files = this.app.vault.getMarkdownFiles()
                    .sort((a, b) => b.stat.mtime - a.stat.mtime);

                dropdown.addOption('', '-- Active file --');

                for (const file of files.slice(0, 50)) {
                    dropdown.addOption(file.path, file.basename);
                }

                dropdown.onChange(value => {
                    this.targetFile = value
                        ? this.app.vault.getAbstractFileByPath(value) as TFile
                        : null;
                });
            });

        // Due date (optional)
        new Setting(contentEl)
            .setName('Due date')
            .setDesc('Optional: Set a due date')
            .addText(text => {
                text.setPlaceholder('YYYY-MM-DD')
                    .onChange(value => { this.dueDate = value; });
                text.inputEl.type = 'date';
            });

        // Priority
        new Setting(contentEl)
            .setName('Priority')
            .addDropdown(dropdown => {
                dropdown
                    .addOption('0', 'None')
                    .addOption('1', '🔴 High')
                    .addOption('2', '🟡 Medium')
                    .addOption('3', '🟢 Low')
                    .onChange(value => { this.priority = parseInt(value); });
            });

        // Buttons
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Add Task')
                .setCta()
                .onClick(() => this.submit()))
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => this.close()));
    }

    private async submit(): Promise<void> {
        if (!this.taskText.trim()) {
            new Notice('Task text cannot be empty');
            return;
        }

        // Build task line
        let taskLine = `- [ ] ${this.taskText.trim()}`;

        // Add due date if provided
        if (this.dueDate) {
            taskLine += ` 📅 ${this.dueDate}`;
        }

        // Add priority emoji
        if (this.priority === 1) {
            taskLine += ' ⏫';
        } else if (this.priority === 2) {
            taskLine += ' 🔼';
        } else if (this.priority === 3) {
            taskLine += ' 🔽';
        }

        // Determine target file
        let file = this.targetFile;
        if (!file) {
            // Use active file
            const activeFile = this.app.workspace.getActiveFile();
            if (activeFile && activeFile.extension === 'md') {
                file = activeFile;
            }
        }

        if (!file) {
            new Notice('No target file selected');
            return;
        }

        // Append task to file
        try {
            const content = await this.app.vault.read(file);
            const newContent = content + '\n' + taskLine;
            await this.app.vault.modify(file, newContent);

            new Notice(`Task added to ${file.basename}`);
            this.close();
            this.onTaskAdded();
        } catch (error) {
            new Notice('Failed to add task: ' + error);
        }
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
