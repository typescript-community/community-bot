module.exports = {
    /**
     * Include parentheses around a sole arrow function parameter.
     *
     * avoid - Omit parens when possible. Example: `x => x`
     * always - Always include parens. Example: `(x) => x`
     */
    arrowParens: 'avoid',

    /**
     * Print spaces between brackets.
     *
     * Type: boolean
     */
    bracketSpacing: true,

    /**
     * Print (to stderr) where a cursor at the given position would move to after formatting.
     * This option cannot be used with --range-start and --range-end.
     *
     * Type: integer
     */
    cursorOffset: -1,

    /**
     * Which end of line characters to apply.
     *
     * auto - Maintain existing (mixed values within one file are normalised by looking at what's used after the first line)
     * lf - Line Feed only (\n), common on Linux and macOS as well as inside git repos
     * crlf - Carriage Return + Line Feed characters (\r\n), common on Windows
     * cr - Carriage Return character only (\r), used very rarely
     */
    endOfLine: 'auto',

    /**
     * The line length where Prettier will try wrap.
     *
     * Type: integer
     */
    printWidth: 160,

    /**
     * How to wrap prose.
     *
     * always - Wrap prose if it exceeds the print width.
     * never - Do not wrap prose.
     * preserve - Wrap prose as-is.
     */
    proseWrap: 'preserve',

    /**
     * Change when properties in objects are quoted.
     *
     * as-needed - Only add quotes around object properties where required.
     * consistent - If at least one property in an object requires quotes, quote all properties.
     * preserve - Respect the input use of quotes in object properties.
     */
    quoteProps: 'as-needed',

    /**
     * Print semicolons.
     *
     * Type: boolean
     */
    semi: true,

    /**
     * Use single quotes instead of double quotes.
     *
     * Type: boolean
     */
    singleQuote: true,

    /**
     * Number of spaces per indentation level.
     *
     * Type: integer
     */
    tabWidth: 4,

    /**
     * Print trailing commas wherever possible when multi-line.
     *
     * none - No trailing commas.
     * es5 - Trailing commas where valid in ES5 (objects, arrays, etc.)
     * all - Trailing commas wherever possible (including function arguments).
     */
    trailingComma: 'all',

    /**
     * Indent with tabs instead of spaces.
     *
     * Type: boolean
     */
    useTabs: false,
};
