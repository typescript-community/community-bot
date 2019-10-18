module.exports = {
    apps: [
        {
            name: 'TypeScript Community Bot',
            interpreter: 'node',
            interpreter_args: '-r source-map-support/register',
            script: './build',
        },
    ],
};
