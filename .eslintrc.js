module.exports = {
    parser: '@typescript-eslint/parser',
    parserOptions: {
        sourceType: 'module',
    },
    plugins: ['@typescript-eslint', 'jest', 'prettier', 'simple-import-sort', 'import'],
    env: {
        node: true,
        es2020: true,
    },
    extends: [
        'eslint:recommended',
        'prettier',
        'prettier/@typescript-eslint',
        'plugin:@typescript-eslint/recommended',
        'plugin:jest/recommended',
        'plugin:import/errors',
        'plugin:import/warnings',
        'plugin:import/typescript',
    ],
    rules: {
        'prettier/prettier': 'error',
        'simple-import-sort/sort': 'error',

        /**
         * ESLint
         */
        'no-dupe-class-members': 'off', // Disables TS Method Overloads

        /**
         * @typescript-eslint
         */
        '@typescript-eslint/no-unused-vars': [
            'warn',
            {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
            },
        ],
        '@typescript-eslint/indent': 'off',
        '@typescript-eslint/class-name-casing': 'warn',
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/member-ordering': 'error',
        '@typescript-eslint/prefer-interface': 'off',
        '@typescript-eslint/no-non-null-assertion': 'off',
    },
    overrides: [
        {
            files: ['./__tests__/**/*', '*.test.ts', '*.spec.ts'],
            env: {
                'jest/globals': true,
            },
        },
        {
            files: ['./declarations/**/*'],
            rules: {
                '@typescript-eslint/no-explicit-any': 'off',
            },
        },
        {
            files: ['./src/**/*'],
            rules: {
                '@typescript-eslint/camelcase': 'warn',
            },
        },
    ],
};
