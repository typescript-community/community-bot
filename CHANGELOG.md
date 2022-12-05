# 2022-11-19

-   Updated to Discord.js 14, removed Cookiecord to prevent future delays in updating versions.
-   The bot will now react on the configured autorole messages to indicate available roles.
-   Unhandled rejections will now only be ignored if `NODE_ENV` is set to `production`.
-   Removed admin `checkThreads` command as using it would result in the bot checking for closed threads twice as often until restarted.
