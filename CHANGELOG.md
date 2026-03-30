# 2023-08-20

-   Reworked modules to avoid sending messages in embeds.
-   Show up to 5 search results from `!hb`.

# 2022-12-16

-   Remove `!close`, update `!helper` to include thread tags.

# 2022-11-19

-   Removed `HELP_CATEGORY`, `GENERAL_HELP_CHANNEL` environment variables.
-   Added `HELP_FORUM_CHANNEL`, `HELP_REQUESTS_CHANNEL` environment variables.
-   Updated how to get help and how to give help channel content to not use embeds.
-   Updated to Discord.js 14, removed Cookiecord to prevent future delays in updating versions.
-   The bot will now react on the configured autorole messages to indicate available roles.
-   Unhandled rejections will now only be ignored if `NODE_ENV` is set to `production`.
-   Removed admin `checkThreads` command as using it would result in the bot checking for closed threads twice as often until restarted.
