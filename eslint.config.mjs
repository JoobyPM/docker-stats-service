// eslint.config.mjs
import js from '@eslint/js'; // ESLint’s built-in config for JS
import prettierPlugin from 'eslint-plugin-prettier'; // The plugin (CommonJS)
import jsdoc from 'eslint-plugin-jsdoc';
import sonarjs from 'eslint-plugin-sonarjs';

import globals from 'globals'; // optional: to define browser/node globals

/** @type {import("eslint").Linter.Config[]} */
export default [
  // 1) Start with ESLint’s recommended rules
  js.configs.recommended,
  jsdoc.configs['flat/recommended'],
  sonarjs.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    plugins: {
      jsdoc
    },
    rules: {
      'jsdoc/require-description': 'warn'
    }
  },
  {
    rules: {
      'arrow-body-style': 'off',
      'comma-dangle': 'off',
      'max-len': 'off',
      'semi-spacing': 'off'
    }
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest
      }
    },
    plugins: {
      prettier: prettierPlugin
    },
    rules: {
      'prettier/prettier': 'error',
      'no-unused-vars': 'warn',
      'no-console': process.env.NODE_ENV === 'production' ? 'warn' : 'off',
      'sonarjs/cognitive-complexity': 'warn'
    }
  }
];
