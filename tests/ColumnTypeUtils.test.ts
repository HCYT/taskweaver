import { describe, it, expect } from 'vitest';
import {
    getColumnTypeLabel,
    getColumnTypeEmoji,
    getColumnTypeDescription,
    COLUMN_TYPE_LABELS,
} from '../src/utils/ColumnTypeUtils';

describe('ColumnTypeUtils', () => {
    describe('getColumnTypeLabel', () => {
        it('should return correct labels for all types', () => {
            expect(getColumnTypeLabel('manual')).toBe('📝 Manual');
            expect(getColumnTypeLabel('completed')).toBe('✅ Completed');
            expect(getColumnTypeLabel('undated')).toBe('📭 No Date');
            expect(getColumnTypeLabel('overdue')).toBe('🔴 Overdue');
            expect(getColumnTypeLabel('dated')).toBe('📅 Dated');
            expect(getColumnTypeLabel('namedTag')).toBe('🏷️ Tag');
        });

        it('should return type as-is for unknown types', () => {
            expect(getColumnTypeLabel('unknown' as any)).toBe('unknown');
        });
    });

    describe('getColumnTypeEmoji', () => {
        it('should return emoji for all types', () => {
            expect(getColumnTypeEmoji('manual')).toBe('📝');
            expect(getColumnTypeEmoji('completed')).toBe('✅');
            expect(getColumnTypeEmoji('overdue')).toBe('🔴');
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
