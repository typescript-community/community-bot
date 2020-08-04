module.exports = {
    apps: [
        {
            interpreter: 'node',
            interpreter_args: '-r source-map-support/register',
            name: 'TypeScript Community Bot',
            script: './build',
        },
    ],
};
