import { ColumnType } from '../engines/BoardEngine';

/**
 * Column type display labels and emojis
 */
export const COLUMN_TYPE_LABELS: Record<ColumnType, string> = {
    manual: '📝 Manual',
    completed: '✅ Completed',
    undated: '📭 No Date',
    overdue: '🔴 Overdue',
    dated: '📅 Dated',
    namedTag: '🏷️ Tag',
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
 * Get display label for column type (with emoji)
 */
export function getColumnTypeLabel(type: ColumnType): string {
    return COLUMN_TYPE_LABELS[type] || type;
}

/**
 * Get emoji-only for compact display
 */
export function getColumnTypeEmoji(type: ColumnType): string {
    return COLUMN_TYPE_LABELS[type]?.split(' ')[0] || '📝';
}

/**
 * Get description for column type
 */
export function getColumnTypeDescription(type: ColumnType): string {
    return COLUMN_TYPE_DESCRIPTIONS[type] || '';
}
