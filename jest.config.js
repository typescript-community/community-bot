module.exports = {
    coverageDirectory: './coverage/',
    preset: 'ts-jest',
    testEnvironment: 'node',
    testPathIgnorePatterns: ['<rootDir>/build/', '<rootDir>/node_modules/'],
};
