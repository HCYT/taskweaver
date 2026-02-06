import { setIcon } from 'obsidian';
import { FilterState, DEFAULT_FILTER_STATE, countActiveFilters } from '../utils/FilterState';
import { getAllTags } from '../utils/TodoFilterer';
import { TodoItem } from '../engines/TodoEngine';

export class FilterPopover {
    private containerEl: HTMLElement;
    private popoverEl: HTMLElement | null = null;
    private state: FilterState;
    private onChange: (state: FilterState) => void;
    private todos: TodoItem[];

    constructor(
        containerEl: HTMLElement,
        todos: TodoItem[],
        initialState: FilterState | null,
        onChange: (state: FilterState) => void
    ) {
        this.containerEl = containerEl;
        this.todos = todos;
        this.state = initialState || { ...DEFAULT_FILTER_STATE };
        this.onChange = onChange;
        this.render();
    }

    private render(): void {
        // Filter button
        const filterBtn = this.containerEl.createDiv({ cls: 'taskweaver-filter-btn' });
        setIcon(filterBtn, 'filter');

        const activeCount = countActiveFilters(this.state);
        if (activeCount > 0) {
            filterBtn.addClass('has-active-filters');
            const badge = filterBtn.createSpan({ cls: 'taskweaver-filter-badge' });
            badge.setText(String(activeCount));
        }

        filterBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.togglePopover(filterBtn);
        });
    }

    private togglePopover(anchorEl: HTMLElement): void {
        if (this.popoverEl) {
            this.closePopover();
            return;
        }

        this.popoverEl = document.body.createDiv({ cls: 'taskweaver-filter-popover' });

        // Position relative to button
        const rect = anchorEl.getBoundingClientRect();
        this.popoverEl.style.top = `${rect.bottom + 4}px`;
        this.popoverEl.style.left = `${rect.left}px`;

        this.renderPopoverContent();

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', this.handleOutsideClick);
        }, 0);
    }

    private handleOutsideClick = (e: MouseEvent): void => {
        if (this.popoverEl && !this.popoverEl.contains(e.target as Node)) {
            this.closePopover();
        }
    };

    private closePopover(): void {
        document.removeEventListener('click', this.handleOutsideClick);
        if (this.popoverEl) {
            this.popoverEl.remove();
            this.popoverEl = null;
        }
    }

    private renderPopoverContent(): void {
        if (!this.popoverEl) return;
        this.popoverEl.empty();

        // Header
        const header = this.popoverEl.createDiv({ cls: 'taskweaver-fp-header' });
        header.createEl('h4', { text: 'Filters' });
        const clearBtn = header.createEl('button', { text: 'Clear All', cls: 'taskweaver-fp-clear' });
        clearBtn.addEventListener('click', () => {
            this.state = { ...DEFAULT_FILTER_STATE };
            this.renderPopoverContent();
            this.onChange(this.state);
        });

        // Status Section
        const statusSection = this.popoverEl.createDiv({ cls: 'taskweaver-fp-section' });
        statusSection.createEl('label', { text: 'Status' });
        this.createToggle(statusSection, 'Show Completed', this.state.showCompleted, (v) => {
            this.state.showCompleted = v;
            this.onChange(this.state);
        });

        // Date Section
        const dateSection = this.popoverEl.createDiv({ cls: 'taskweaver-fp-section' });
        dateSection.createEl('label', { text: 'Due Date' });
        this.createToggle(dateSection, 'Overdue', this.state.showOverdue, (v) => {
            this.state.showOverdue = v;
            this.onChange(this.state);
        });
        this.createToggle(dateSection, 'Today', this.state.showToday, (v) => {
            this.state.showToday = v;
            this.onChange(this.state);
        });
        this.createToggle(dateSection, 'Upcoming', this.state.showUpcoming, (v) => {
            this.state.showUpcoming = v;
            this.onChange(this.state);
        });
        this.createToggle(dateSection, 'No Date', this.state.showNoDate, (v) => {
            this.state.showNoDate = v;
            this.onChange(this.state);
        });

        // Priority Section
        const prioritySection = this.popoverEl.createDiv({ cls: 'taskweaver-fp-section' });
        prioritySection.createEl('label', { text: 'Priority' });
        const prioritySelect = prioritySection.createEl('select', { cls: 'taskweaver-fp-select' });
        const options = [
            { value: 'all', label: 'All Priorities' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
            { value: 'none', label: 'No Priority' },
        ];
        options.forEach(opt => {
            const optEl = prioritySelect.createEl('option', { value: opt.value, text: opt.label });
            if (opt.value === this.state.priorityFilter) {
                optEl.selected = true;
            }
        });
        prioritySelect.addEventListener('change', () => {
            this.state.priorityFilter = prioritySelect.value as FilterState['priorityFilter'];
            this.onChange(this.state);
        });

        // Tags Section
        const tags = getAllTags(this.todos);
        if (tags.length > 0) {
            const tagSection = this.popoverEl.createDiv({ cls: 'taskweaver-fp-section' });
            tagSection.createEl('label', { text: 'Tag' });
            const tagSelect = tagSection.createEl('select', { cls: 'taskweaver-fp-select' });
            tagSelect.createEl('option', { value: '', text: 'All Tags' });
            tags.forEach(tag => {
                const optEl = tagSelect.createEl('option', { value: tag, text: tag });
                if (tag === this.state.tagFilter) {
                    optEl.selected = true;
                }
            });
            tagSelect.addEventListener('change', () => {
                this.state.tagFilter = tagSelect.value || null;
                this.onChange(this.state);
            });
        }
    }

    private createToggle(container: HTMLElement, label: string, value: boolean, onChange: (v: boolean) => void): void {
        const row = container.createDiv({ cls: 'taskweaver-fp-toggle-row' });
        const checkbox = row.createEl('input', { type: 'checkbox' });
        checkbox.checked = value;
        row.createSpan({ text: label });
        checkbox.addEventListener('change', () => {
            onChange(checkbox.checked);
        });
    }

    public destroy(): void {
        this.closePopover();
    }
}
