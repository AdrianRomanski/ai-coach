import { builtinModules } from 'node:module';
import nx from '@nx/eslint-plugin';

const NODE = ['node:*'];

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
  {
    ignores: ['**/dist', '**/out-tsc', '**/vitest.config.*.timestamp*'],
  },
  {
    files: ['packages/domain/src/**/*.ts', 'packages/application/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^node:',
              message: 'The core is pure TypeScript: reach I/O through a port.',
            },
            {
              regex: `^(${builtinModules.join('|')})(/.*)?$`,
              message: 'The core is pure TypeScript: reach I/O through a port.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          banTransitiveDependencies: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          depConstraints: [
            {
              sourceTag: 'type:domain',
              onlyDependOnLibsWithTags: ['type:domain'],
              allowedExternalImports: [],
            },
            {
              sourceTag: 'type:application',
              onlyDependOnLibsWithTags: ['type:domain', 'type:application'],
              allowedExternalImports: [],
            },
            {
              sourceTag: 'type:adapter',
              onlyDependOnLibsWithTags: ['type:domain', 'type:application'],
            },
            {
              sourceTag: 'adapter:vault-mcp',
              allowedExternalImports: [
                '@modelcontextprotocol/sdk/*',
                'zod',
                ...NODE,
              ],
            },
            {
              sourceTag: 'adapter:ollama',
              allowedExternalImports: ['zod', ...NODE],
            },
            {
              sourceTag: 'adapter:gemini',
              allowedExternalImports: ['@google/genai', 'zod', ...NODE],
            },
            {
              sourceTag: 'adapter:local-state',
              allowedExternalImports: ['zod', ...NODE],
            },
            {
              sourceTag: 'type:app',
              onlyDependOnLibsWithTags: [
                'type:domain',
                'type:application',
                'type:adapter',
              ],
              allowedExternalImports: ['zod', ...NODE],
            },
          ],
        },
      ],
    },
  },
];
