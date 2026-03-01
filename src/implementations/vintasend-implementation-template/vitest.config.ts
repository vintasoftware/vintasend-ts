import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['**/__tests__/**/*.test.ts'],
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			include: ['src/**/*.ts'],
			exclude: ['src/**/*.d.ts', 'src/**/__tests__/**'],
		},
	},
});
