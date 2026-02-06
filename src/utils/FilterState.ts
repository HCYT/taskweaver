/**
 * Filter State and Types for Advanced Filtering
 */

export interface FilterState {
    showCompleted: boolean;
    showOverdue: boolean;
    showToday: boolean;
    showUpcoming: boolean;  // next 7 days
    showNoDate: boolean;
    priorityFilter: 'all' | 'high' | 'medium' | 'low' | 'none';
    tagFilter: string | null;  // null = all tags
}

export const DEFAULT_FILTER_STATE: FilterState = {
    showCompleted: true,
    showOverdue: true,
    showToday: true,
    showUpcoming: true,
    showNoDate: true,
    priorityFilter: 'all',
    tagFilter: null,
};

/**
 * Check if any filter is active (not default)
 */
export function isFilterActive(state: FilterState): boolean {
    return (
        !state.showCompleted ||
        !state.showOverdue ||
        !state.showToday ||
        !state.showUpcoming ||
        !state.showNoDate ||
        state.priorityFilter !== 'all' ||
        state.tagFilter !== null
    );
}

/**
 * Count active filters
 */
export function countActiveFilters(state: FilterState): number {
    let count = 0;
    if (!state.showCompleted) count++;
    if (!state.showOverdue) count++;
    if (!state.showToday) count++;
    if (!state.showUpcoming) count++;
    if (!state.showNoDate) count++;
    if (state.priorityFilter !== 'all') count++;
    if (state.tagFilter !== null) count++;
    return count;
}
