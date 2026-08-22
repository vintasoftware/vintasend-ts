import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		environment: 'node',
		globals: true,
		include: ['**/__tests__/**/*.test.ts'],
		exclude: [
			'**/node_modules/**',
			'**/dist/**',
			'**/src/examples/**',
			'**/src/implementations/**',
			'**/src/tools/**',
		],
		coverage: {
			provider: 'v8',
			reportsDirectory: 'coverage',
			include: ['src/**/*.ts'],
			exclude: [
				'src/**/*.d.ts',
				'src/**/__tests__/**',
				'src/examples/**/*',
				'src/implementations/**/*',
				'src/tools/**/*',
			],
		},
	},
});
