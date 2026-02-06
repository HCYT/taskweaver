import { describe, it, expect } from 'vitest';
import {
    getColumnTypeLabel,
    getColumnTypeIcon,
    getColumnTypeDescription,
    COLUMN_TYPE_LABELS,
    COLUMN_TYPE_ICONS,
} from '../src/utils/ColumnTypeUtils';

describe('ColumnTypeUtils', () => {
    describe('getColumnTypeLabel', () => {
        it('should return correct labels for all types', () => {
            expect(getColumnTypeLabel('manual')).toBe('Manual');
            expect(getColumnTypeLabel('completed')).toBe('Completed');
            expect(getColumnTypeLabel('undated')).toBe('No Date');
            expect(getColumnTypeLabel('overdue')).toBe('Overdue');
            expect(getColumnTypeLabel('dated')).toBe('Dated');
            expect(getColumnTypeLabel('namedTag')).toBe('Tag');
        });

        it('should return type as-is for unknown types', () => {
            expect(getColumnTypeLabel('unknown' as any)).toBe('unknown');
        });
    });

    describe('getColumnTypeIcon', () => {
        it('should return Lucide icon names for all types', () => {
            expect(getColumnTypeIcon('manual')).toBe('edit-3');
            expect(getColumnTypeIcon('completed')).toBe('check-circle-2');
            expect(getColumnTypeIcon('overdue')).toBe('alert-circle');
            expect(getColumnTypeIcon('dated')).toBe('calendar');
            expect(getColumnTypeIcon('namedTag')).toBe('tag');
        });

        it('should return default icon for unknown types', () => {
            expect(getColumnTypeIcon('unknown' as any)).toBe('edit-3');
        });
    });

    describe('getColumnTypeDescription', () => {
        it('should return descriptions for all types', () => {
            expect(getColumnTypeDescription('manual')).toContain('dragging');
            expect(getColumnTypeDescription('completed')).toContain('completed');
            expect(getColumnTypeDescription('undated')).toContain('without');
            expect(getColumnTypeDescription('overdue')).toContain('past');
        });
    });
});
