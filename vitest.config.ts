import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['tests/**/*.test.ts'],
        coverage: {
            reporter: ['text', 'lcov'],
            include: ['src/**/*.ts'],
            exclude: ['src/**/*.d.ts', 'src/main.ts'],
        },
    },
    resolve: {
        alias: {
            obsidian: './tests/mocks/obsidian.ts',
        },
    },
});
