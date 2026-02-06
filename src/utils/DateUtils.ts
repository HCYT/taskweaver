/**
 * Shared date utilities for TaskWeaver
 */

/**
 * Get days difference from today
 */
export function getDaysFromToday(dateStr: string): number {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    date.setHours(0, 0, 0, 0);
    return Math.floor((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Check if a date is overdue
 */
export function isOverdue(dateStr: string): boolean {
    return getDaysFromToday(dateStr) < 0;
}

/**
 * Check if a date is within a range (days from today)
 */
export function isInDateRange(dateStr: string, fromDays: number, toDays: number): boolean {
    const days = getDaysFromToday(dateStr);
    return days >= fromDays && days <= toDays;
}

/**
 * Get CSS class for date status
 */
export function getDateStatusClass(dateStr: string): string {
    const diffDays = getDaysFromToday(dateStr);
    if (diffDays < 0) return 'is-overdue';
    if (diffDays === 0) return 'is-today';
    if (diffDays <= 3) return 'is-soon';
    return '';
}

/**
 * Format a date for display
 */
export function formatDateRelative(dateStr: string): string {
    const diffDays = getDaysFromToday(dateStr);
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';
    if (diffDays > 0 && diffDays <= 7) return `${diffDays}d`;
    if (diffDays < 0 && diffDays >= -7) return `${Math.abs(diffDays)}d ago`;

    // Default: show date
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
