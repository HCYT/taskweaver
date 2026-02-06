import { ColumnType } from '../engines/BoardEngine';

/**
 * Lucide icon names for column types
 */
export const COLUMN_TYPE_ICONS: Record<ColumnType, string> = {
    manual: 'edit-3',
    completed: 'check-circle-2',
    undated: 'inbox',
    overdue: 'alert-circle',
    dated: 'calendar',
    namedTag: 'tag',
};

/**
 * Column type display labels (text only, no emoji)
 */
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
    manual: 'Manual',
    completed: 'Completed',
    undated: 'No Date',
    overdue: 'Overdue',
    dated: 'Dated',
    namedTag: 'Tag',
};

/**
 * Column type descriptions
 */
export const COLUMN_TYPE_DESCRIPTIONS: Record<ColumnType, string> = {
    manual: 'Tasks are assigned by dragging or from context menu.',
    completed: 'Automatically shows all completed tasks.',
    undated: 'Shows tasks without a due date.',
    overdue: 'Shows tasks with past due dates.',
    dated: 'Shows tasks within a date range.',
    namedTag: 'Shows tasks with a specific tag.',
};

/**
 * Get Lucide icon name for column type
 */
export function getColumnTypeIcon(type: ColumnType): string {
    return COLUMN_TYPE_ICONS[type] || 'edit-3';
}

/**
 * Get display label for column type (text only)
 */
export function getColumnTypeLabel(type: ColumnType): string {
    return COLUMN_TYPE_LABELS[type] || type;
}

/**
 * Get description for column type
 */
export function getColumnTypeDescription(type: ColumnType): string {
    return COLUMN_TYPE_DESCRIPTIONS[type] || '';
}
