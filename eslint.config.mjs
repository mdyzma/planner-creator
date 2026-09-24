import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/out/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.wrangler/**',
      'docs/reference/**',
      '**/next-env.d.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
    },
  },
  {
    // Dependency rule (docs/architecture/system-design.md §3): engine packages must not
    // depend on the app or on template data.
    files: ['packages/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/apps/**', '@planner/web', '@planner/web/*'],
              message: 'packages/ must not import from apps/.',
            },
            {
              group: ['**/templates/**'],
              message:
                'Templates are runtime data; load them, do not import them from engine code.',
            },
          ],
        },
      ],
    },
  },
);
