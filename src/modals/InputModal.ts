import { App, Modal, Setting } from 'obsidian';

/**
 * Simple input modal for text prompts
 */
export class InputModal extends Modal {
    private title: string;
    private label: string;
    private defaultValue: string;
    private onSubmit: (value: string) => void;
    private inputEl: HTMLInputElement;

    constructor(
        app: App,
        title: string,
        label: string,
        defaultValue: string,
        onSubmit: (value: string) => void
    ) {
        super(app);
        this.title = title;
        this.label = label;
        this.defaultValue = defaultValue;
        this.onSubmit = onSubmit;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl('h3', { text: this.title });

        const setting = new Setting(contentEl).setName(this.label);
        setting.addText((text) => {
            this.inputEl = text.inputEl;
            text.setValue(this.defaultValue);
            text.inputEl.focus();
            text.inputEl.select();
            text.inputEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.submit();
                }
            });
        });

        new Setting(contentEl)
            .addButton((btn) =>
                btn.setButtonText('Cancel').onClick(() => this.close())
            )
            .addButton((btn) =>
                btn
                    .setButtonText('OK')
                    .setCta()
                    .onClick(() => this.submit())
            );
    }

    private submit(): void {
        this.onSubmit(this.inputEl.value);
        this.close();
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
