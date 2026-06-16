/* eslint-disable @typescript-eslint/naming-convention */
/*
 * Copyright (C) 2024 AudioCodes Ltd.
 */
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    languageOptions: {
      globals: {
        ...globals.node,
        globalThis: 'readonly',
        NodeJS: 'readonly'
      },

      parser: tsParser,
      ecmaVersion: 2023,
      sourceType: 'module',

      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: true
    }
  },
  {
    ignores: [
      'dist/',
      'node_modules/',
      '**/*js'
    ]
  },
  {
    files: ['**/*.ts']
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked, {
  plugins: {
    '@stylistic': stylistic
  },
});
