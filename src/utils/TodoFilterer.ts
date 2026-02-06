/**
 * Filter logic for todo items
 */

import { TodoItem } from '../engines/TodoEngine';
import { FilterState } from './FilterState';

/**
 * Apply filters to a list of todo items
 */
export function filterTodos(todos: TodoItem[], filter: FilterState): TodoItem[] {
    return todos.filter(todo => matchesFilter(todo, filter));
}

/**
 * Check if a single todo matches the filter criteria
 */
export function matchesFilter(todo: TodoItem, filter: FilterState): boolean {
    // Completed filter
    if (!filter.showCompleted && todo.completed) {
        return false;
    }

    // Date filters
    if (todo.dueDate) {
        const dateStatus = getDateStatus(todo.dueDate);

        if (!filter.showOverdue && dateStatus === 'overdue') {
            return false;
        }
        if (!filter.showToday && dateStatus === 'today') {
            return false;
        }
        if (!filter.showUpcoming && dateStatus === 'upcoming') {
            return false;
        }
    } else {
        // No due date
        if (!filter.showNoDate) {
            return false;
        }
    }

    // Priority filter
    if (filter.priorityFilter !== 'all') {
        const priority = extractPriority(todo.text);
        if (filter.priorityFilter === 'high' && priority !== 'high') return false;
        if (filter.priorityFilter === 'medium' && priority !== 'medium') return false;
        if (filter.priorityFilter === 'low' && priority !== 'low') return false;
        if (filter.priorityFilter === 'none' && priority !== 'none') return false;
    }

    // Tag filter
    if (filter.tagFilter !== null) {
        if (!todo.tags || !todo.tags.includes(filter.tagFilter)) {
            return false;
        }
    }

    return true;
}

/**
 * Get date status (overdue, today, upcoming, future)
 */
function getDateStatus(dateStr: string): 'overdue' | 'today' | 'upcoming' | 'future' {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dueDate = new Date(dateStr);
    dueDate.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays === 0) return 'today';
    if (diffDays <= 7) return 'upcoming';
    return 'future';
}

/**
 * Extract priority from task text
 */
function extractPriority(text: string): 'high' | 'medium' | 'low' | 'none' {
    if (text.includes('⏫') || text.includes('🔺')) return 'high';
    if (text.includes('🔼')) return 'medium';
    if (text.includes('🔽')) return 'low';
    return 'none';
}

/**
 * Get all unique tags from todos
 */
export function getAllTags(todos: TodoItem[]): string[] {
    const tagSet = new Set<string>();
    todos.forEach(todo => {
        if (todo.tags) {
            todo.tags.forEach(tag => tagSet.add(tag));
        }
    });
    return Array.from(tagSet).sort();
}
