module.exports = {
    hooks: {
        'pre-commit': 'npm run lint:fix && npm run build && npm test',
    },
};
