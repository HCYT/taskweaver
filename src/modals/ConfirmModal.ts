import { App, Modal, Setting } from 'obsidian';

/**
 * A confirmation modal that replaces the browser's native confirm() dialog.
 * Required by Obsidian plugin guidelines.
 */
export class ConfirmModal extends Modal {
    private title: string;
    private message: string;
    private onConfirm: () => void;
    private onCancel: () => void;

    constructor(
        app: App,
        title: string,
        message: string,
        onConfirm: () => void,
        onCancel?: () => void
    ) {
        super(app);
        this.title = title;
        this.message = message;
        this.onConfirm = onConfirm;
        this.onCancel = onCancel || (() => { });
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-confirm-modal');

        // Title
        contentEl.createEl('h3', { text: this.title });

        // Message
        contentEl.createEl('p', { text: this.message, cls: 'taskweaver-confirm-message' });

        // Actions
        new Setting(contentEl)
            .addButton(btn => btn
                .setButtonText('Cancel')
                .onClick(() => {
                    this.close();
                    this.onCancel();
                }))
            .addButton(btn => btn
                .setButtonText('Confirm')
                .setCta()
                .setWarning()
                .onClick(() => {
                    this.close();
                    this.onConfirm();
                }));
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
