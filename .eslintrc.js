/* eslint-disable sort-keys */
/* eslint-disable sort-keys-fix/sort-keys-fix */
module.exports = {
    env: {
        node: true,
        es2020: true,
    },
    parserOptions: {
        sourceType: 'module',
    },
    extends: [
        /* Base ESLint Config */
        'eslint:recommended',

        /* Lint JSON Files */
        'plugin:json/recommended-with-comments',

        /* Prettier Integration */
        'prettier',
        'plugin:prettier/recommended',
    ],
    plugins: ['@typescript-eslint', 'simple-import-sort', 'json', 'markdown', 'optimize-regex', 'sort-keys-fix'],
    rules: {
        /**
         * Object Formatting
         */
        'object-shorthand': ['error', 'always', { avoidQuotes: true }],
        'sort-keys': ['error', 'asc', { caseSensitive: true, natural: false, minKeys: 2 }],
        'sort-keys-fix/sort-keys-fix': 2,

        /**
         * JSON
         */
        'json/*': 'error',

        /**
         * Regular Expressions
         */
        'optimize-regex/optimize-regex': 'error',

        /**
         * TypeScript
         */
        '@typescript-eslint/indent': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/no-parameter-properties': 'off',
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/no-var-requires': 'off',
        '@typescript-eslint/class-name-casing': 'warn',
        '@typescript-eslint/no-namespace': 'off',
        '@typescript-eslint/member-ordering': 'error',
        '@typescript-eslint/prefer-interface': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',

        /* Sorting */
        'simple-import-sort/sort': 'error',
    },
    globals: { Atomics: 'readonly', SharedArrayBuffer: 'readonly' },
    overrides: [
        {
            files: ['**/*.ts'],
            parser: '@typescript-eslint/parser',
            parserOptions: {
                //project: './tsconfig.json',
                sourceType: 'module',
            },
            plugins: ['@typescript-eslint', 'simple-import-sort'],
            extends: [
                /* TypeScript ESLint */
                'plugin:@typescript-eslint/recommended',
                'plugin:@typescript-eslint/eslint-recommended',
                //'plugin:@typescript-eslint/recommended-requiring-type-checking',

                /* Prettier Integration */
                'prettier/@typescript-eslint',

                /* Import */
                'plugin:import/errors',
                'plugin:import/warnings',
                'plugin:import/typescript',
            ],
            rules: {
                /**
                 * TypeScript Linting
                 */
                '@typescript-eslint/indent': 'off',
                '@typescript-eslint/explicit-function-return-type': 'off',
                '@typescript-eslint/interface-name-prefix': 'off',
                '@typescript-eslint/no-parameter-properties': 'off',
                '@typescript-eslint/camelcase': 'off',
                '@typescript-eslint/no-var-requires': 'off',
                '@typescript-eslint/class-name-casing': 'warn',
                '@typescript-eslint/no-namespace': 'off',
                '@typescript-eslint/member-ordering': 'error',
                '@typescript-eslint/prefer-interface': 'off',
                '@typescript-eslint/no-non-null-assertion': 'off',

                /* Sorting */
                'simple-import-sort/sort': 'error',
            },
            overrides: [
                {
                    files: ['**/__tests__/**/*', '**/*.{spec,test}.ts'],
                    env: {
                        'jest/globals': true,
                    },
                    extends: [
                        /* Jest */
                        'plugin:jest/recommended',
                    ],
                },
            ],
        },
    ],
};
