import { App, Modal, setIcon } from 'obsidian';

export class DatePickerModal extends Modal {
    private selectedDate: string | null;
    private currentViewDate: Date;
    private onSelect: (date: string | null) => void;

    constructor(app: App, initialDate: string | null, onSelect: (date: string | null) => void) {
        super(app);
        this.selectedDate = initialDate;
        this.currentViewDate = initialDate ? new Date(initialDate) : new Date();
        this.onSelect = onSelect;
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('taskweaver-date-picker');
        this.render();
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();

        // Header
        const header = contentEl.createDiv({ cls: 'taskweaver-dp-header' });
        header.createEl('h3', { text: 'Select Due Date' });

        // Main container
        const main = contentEl.createDiv({ cls: 'taskweaver-dp-main' });

        // Left panel: Quick options
        const leftPanel = main.createDiv({ cls: 'taskweaver-dp-quick' });
        this.renderQuickOptions(leftPanel);

        // Right panel: Calendar
        const rightPanel = main.createDiv({ cls: 'taskweaver-dp-calendar' });
        this.renderCalendar(rightPanel);

        // Footer
        const footer = contentEl.createDiv({ cls: 'taskweaver-dp-footer' });

        const clearBtn = footer.createEl('button', { text: 'Clear', cls: 'taskweaver-btn-secondary' });
        clearBtn.addEventListener('click', () => {
            this.onSelect(null);
            this.close();
        });

        const confirmBtn = footer.createEl('button', { text: 'Confirm', cls: 'taskweaver-btn-primary' });
        confirmBtn.addEventListener('click', () => {
            this.onSelect(this.selectedDate);
            this.close();
        });
    }

    private renderQuickOptions(container: HTMLElement): void {
        const options = [
            { label: 'Today', days: 0 },
            { label: 'Tomorrow', days: 1 },
            { label: 'In 2 days', days: 2 },
            { label: 'In 3 days', days: 3 },
            { label: 'Next week', days: 7 },
            { label: 'In 2 weeks', days: 14 },
            { label: 'Next month', days: 30 },
        ];

        options.forEach(opt => {
            const date = new Date();
            date.setDate(date.getDate() + opt.days);
            const dateStr = this.formatDateString(date);

            const item = container.createDiv({ cls: 'taskweaver-dp-quick-item' });
            if (this.selectedDate === dateStr) {
                item.addClass('is-selected');
            }

            const label = item.createSpan({ cls: 'taskweaver-dp-quick-label' });
            label.setText(opt.label);

            const dateEl = item.createSpan({ cls: 'taskweaver-dp-quick-date' });
            dateEl.setText(dateStr);

            item.addEventListener('click', () => {
                this.selectedDate = dateStr;
                this.render();
            });
        });
    }

    private renderCalendar(container: HTMLElement): void {
        // Calendar navigation
        const nav = container.createDiv({ cls: 'taskweaver-dp-nav' });

        const prevBtn = nav.createDiv({ cls: 'taskweaver-dp-nav-btn' });
        setIcon(prevBtn, 'chevron-left');
        prevBtn.addEventListener('click', () => {
            this.currentViewDate.setMonth(this.currentViewDate.getMonth() - 1);
            this.render();
        });

        const monthYear = nav.createDiv({ cls: 'taskweaver-dp-month-year' });
        monthYear.setText(this.currentViewDate.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric'
        }));

        const nextBtn = nav.createDiv({ cls: 'taskweaver-dp-nav-btn' });
        setIcon(nextBtn, 'chevron-right');
        nextBtn.addEventListener('click', () => {
            this.currentViewDate.setMonth(this.currentViewDate.getMonth() + 1);
            this.render();
        });

        // Day headers
        const grid = container.createDiv({ cls: 'taskweaver-dp-grid' });
        const dayHeaders = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
        dayHeaders.forEach(day => {
            grid.createDiv({ cls: 'taskweaver-dp-day-header', text: day });
        });

        // Calendar days
        const year = this.currentViewDate.getFullYear();
        const month = this.currentViewDate.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startPadding = firstDay.getDay();

        // Previous month padding
        const prevMonthLast = new Date(year, month, 0).getDate();
        for (let i = startPadding - 1; i >= 0; i--) {
            const dayEl = grid.createDiv({ cls: 'taskweaver-dp-day other-month' });
            dayEl.setText(String(prevMonthLast - i));
        }

        // Current month days
        const today = this.formatDateString(new Date());
        for (let day = 1; day <= lastDay.getDate(); day++) {
            const date = new Date(year, month, day);
            const dateStr = this.formatDateString(date);

            const dayEl = grid.createDiv({ cls: 'taskweaver-dp-day' });
            dayEl.setText(String(day));

            if (dateStr === today) {
                dayEl.addClass('is-today');
            }
            if (dateStr === this.selectedDate) {
                dayEl.addClass('is-selected');
            }

            dayEl.addEventListener('click', () => {
                this.selectedDate = dateStr;
                this.render();
            });
        }

        // Next month padding
        const endPadding = 7 - ((startPadding + lastDay.getDate()) % 7);
        if (endPadding < 7) {
            for (let i = 1; i <= endPadding; i++) {
                const dayEl = grid.createDiv({ cls: 'taskweaver-dp-day other-month' });
                dayEl.setText(String(i));
            }
        }
    }

    private formatDateString(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    onClose(): void {
        this.contentEl.empty();
    }
}
