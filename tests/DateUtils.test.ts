import { describe, it, expect } from 'vitest';
import {
    getDaysFromToday,
    isOverdue,
    isInDateRange,
    getDateStatusClass,
    formatDateRelative,
} from '../src/utils/DateUtils';

describe('DateUtils', () => {
    // Helper to create date strings using LOCAL time
    const formatLocalDate = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const addDays = (days: number): string => {
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        d.setDate(d.getDate() + days);
        return formatLocalDate(d);
    };

    describe('getDaysFromToday', () => {
        it('should return 0 for today', () => {
            expect(getDaysFromToday(addDays(0))).toBe(0);
        });

        it('should return positive for future dates', () => {
            expect(getDaysFromToday(addDays(5))).toBe(5);
        });

        it('should return negative for past dates', () => {
            expect(getDaysFromToday(addDays(-3))).toBe(-3);
        });
    });

    describe('isOverdue', () => {
        it('should return true for past dates', () => {
            expect(isOverdue(addDays(-1))).toBe(true);
            expect(isOverdue(addDays(-7))).toBe(true);
        });

        it('should return false for today and future', () => {
            expect(isOverdue(addDays(0))).toBe(false);
            expect(isOverdue(addDays(1))).toBe(false);
        });
    });

    describe('isInDateRange', () => {
        it('should return true when within range', () => {
            expect(isInDateRange(addDays(0), 0, 7)).toBe(true);
            expect(isInDateRange(addDays(3), 0, 7)).toBe(true);
            expect(isInDateRange(addDays(7), 0, 7)).toBe(true);
        });

        it('should return false when outside range', () => {
            expect(isInDateRange(addDays(-1), 0, 7)).toBe(false);
            expect(isInDateRange(addDays(8), 0, 7)).toBe(false);
        });
    });

    describe('getDateStatusClass', () => {
        it('should return is-overdue for past dates', () => {
            expect(getDateStatusClass(addDays(-1))).toBe('is-overdue');
        });

        it('should return is-today for today', () => {
            expect(getDateStatusClass(addDays(0))).toBe('is-today');
        });

        it('should return is-soon for dates within 3 days', () => {
            expect(getDateStatusClass(addDays(1))).toBe('is-soon');
            expect(getDateStatusClass(addDays(3))).toBe('is-soon');
        });

        it('should return empty for future dates beyond 3 days', () => {
            expect(getDateStatusClass(addDays(4))).toBe('');
            expect(getDateStatusClass(addDays(10))).toBe('');
        });
    });

    describe('formatDateRelative', () => {
        it('should return Today for today', () => {
            expect(formatDateRelative(addDays(0))).toBe('Today');
        });

        it('should return Tomorrow for tomorrow', () => {
            expect(formatDateRelative(addDays(1))).toBe('Tomorrow');
        });

        it('should return Yesterday for yesterday', () => {
            expect(formatDateRelative(addDays(-1))).toBe('Yesterday');
        });

        it('should return Xd for days within a week', () => {
            expect(formatDateRelative(addDays(3))).toBe('3d');
            expect(formatDateRelative(addDays(7))).toBe('7d');
        });

        it('should return Xd ago for past days within a week', () => {
            expect(formatDateRelative(addDays(-3))).toBe('3d ago');
            expect(formatDateRelative(addDays(-7))).toBe('7d ago');
        });
    });
});
