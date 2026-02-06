/**
 * Mock for Obsidian module used in tests
 */

export class TFile {
    path: string;
    extension: string;
    basename: string;

    constructor(path: string) {
        this.path = path;
        this.extension = path.split('.').pop() || '';
        this.basename = path.split('/').pop()?.replace(/\.[^/.]+$/, '') || '';
    }
}

export class TAbstractFile {
    path: string;
    constructor(path: string) {
        this.path = path;
    }
}

export class Vault {
    private files: Map<string, string> = new Map();

    getAbstractFileByPath(path: string): TAbstractFile | null {
        if (this.files.has(path)) {
            return new TFile(path);
        }
        return null;
    }

    getMarkdownFiles(): TFile[] {
        return Array.from(this.files.keys())
            .filter(p => p.endsWith('.md'))
            .map(p => new TFile(p));
    }

    async read(file: TFile): Promise<string> {
        return this.files.get(file.path) || '';
    }

    async cachedRead(file: TFile): Promise<string> {
        return this.read(file);
    }

    async create(path: string, content: string): Promise<TFile> {
        this.files.set(path, content);
        return new TFile(path);
    }

    async modify(file: TFile, content: string): Promise<void> {
        this.files.set(file.path, content);
    }

    on(event: string, callback: Function): { unload: () => void } {
        return { unload: () => { } };
    }

    // Test helpers
    _setFile(path: string, content: string): void {
        this.files.set(path, content);
    }

    _clear(): void {
        this.files.clear();
    }
}

export class App {
    vault: Vault = new Vault();
}

export class Modal {
    app: App;
    contentEl: HTMLElement;

    constructor(app: App) {
        this.app = app;
        this.contentEl = document.createElement('div');
    }

    open(): void { }
    close(): void { }
    onOpen(): void { }
    onClose(): void { }
}

export class Setting {
    constructor(containerEl: HTMLElement) { }
    setName(name: string): this { return this; }
    setDesc(desc: string): this { return this; }
    addText(cb: Function): this { return this; }
    addToggle(cb: Function): this { return this; }
    addDropdown(cb: Function): this { return this; }
    addButton(cb: Function): this { return this; }
}

export class ItemView {
    leaf: any;
    app: App;
    containerEl: HTMLElement;

    constructor(leaf: any) {
        this.leaf = leaf;
        this.app = new App();
        this.containerEl = document.createElement('div');
    }

    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
    async onOpen(): Promise<void> { }
    async onClose(): Promise<void> { }
}

export class Menu {
    addItem(cb: Function): this { return this; }
    addSeparator(): this { return this; }
    showAtMouseEvent(e: MouseEvent): void { }
}

export class WorkspaceLeaf { }
