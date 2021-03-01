import { command, Module, listener } from 'cookiecord';
import { Message, TextChannel } from 'discord.js';
import { twoslasher } from '@typescript/twoslash';
import { findCodeFromChannel } from '../util/findCodeblockFromChannel';
import { sendWithMessageOwnership } from '../util/send';

const CODEBLOCK = '```';

// Custom escape function instead of using discord.js Util.escapeCodeBlock because this
// produces better results with template literal types. Discord's markdown handling is pretty
// bad. It doesn't properly handle escaping back ticks, so we instead insert zero width spaces
// so that users cannot escape our code block.
function escapeCode(code: string) {
	return code.replace(/`(?=`)/g, '`\u200B');
}

// Remove `@noErrorTruncation` from the source; this can cause lag/crashes for large errors
function redactNoErrorTruncation(code: string) {
	return code.replace(/@noErrorTruncation/g, '');
}

export class TwoslashModule extends Module {
	@command({
		single: true,
		description:
			'Twoslash: Search for a symbol and get the type of it in the latest codeblock',
	})
	async ts(msg: Message, content: string) {
		const match = /^[_$a-zA-Z][_$0-9a-zA-Z]*/.exec(content);

		if (!match) {
			return sendWithMessageOwnership(
				msg,
				'You need to give me a valid symbol name to look for!',
			);
		}

		const symbol = match[0];

		const code = await findCodeFromChannel(msg.channel as TextChannel);

		if (!code)
			return sendWithMessageOwnership(
				msg,
				`:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			);

		const ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
			defaultOptions: { noErrorValidation: true },
		});

		const value = ret.staticQuickInfos.find(
			i => i.targetString === symbol.trim(),
		);
		if (!value)
			return sendWithMessageOwnership(
				msg,
				`:warning: no symbol named \`${symbol}\` in the most recent codeblock`,
			);

		await sendWithMessageOwnership(
			msg,
			`${CODEBLOCK}typescript\n${escapeCode(value.text)}${CODEBLOCK}`,
		);
	}

	@command({
		description:
			'Twoslash: Run twoslash on the latest codeblock, returning compiler errors and queries',
	})
	async twoslash(msg: Message) {
		const code = await findCodeFromChannel(msg.channel as TextChannel);

		if (!code)
			return sendWithMessageOwnership(
				msg,
				`:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			);

		return this.twoslashBlock(msg, code);
	}

	@listener({ event: 'message' })
	async onTwoslashCodeBlock(msg: Message) {
		const match = msg.content.match(/^```ts twoslash\n([\s\S]+)```$/im);
		if (!msg.author.bot && match) {
			await this.twoslashBlock(msg, match[1]);
			await msg.delete();
		}
	}

	private async twoslashBlock(msg: Message, code: string) {
		const ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
			defaultOptions: {
				noErrorValidation: true,
				noStaticSemanticInfo: false,
			},
		});

		const resultLines: string[] = [];
		const twoslashLines = ret.code.split('\n');

		twoslashLines.forEach((line, index) => {
			resultLines.push(line);

			const lineErrors = ret.errors.filter(e => e.line === index);
			const lineQueries = ret.queries.filter(e => e.line === index + 1);

			if (lineErrors.length + lineQueries.length === 0) return;

			if (lineErrors.length) {
				// Make sure all lines of errors start with a comment
				const errors = lineErrors.map(
					e => '// ' + e.renderedMessage.split('\n').join('\n// '),
				);

				//  ^^^^^ ^^^^^
				// hats to indicate what token is causing the issue
				let linkWithHats = '';
				lineErrors.forEach(e => {
					if (!e.character) return;
					const spaceBefore = e.character - linkWithHats.length;
					linkWithHats += ' '.repeat(spaceBefore);
					linkWithHats += '^'.repeat(e.length || 0);
				});

				if (linkWithHats.length > 0) {
					resultLines.push('//' + linkWithHats.substr(2));
				}

				resultLines.push(...errors);
			}

			// Inline queries for showing the LSP lookup for a token
			if (lineQueries.length) {
				let queryComment = '//';
				lineQueries.forEach(q => {
					const spaceBefore = q.offset - queryComment.length;
					queryComment += ' '.repeat(spaceBefore);
					queryComment += '^? - ';
					queryComment +=
						q.text?.replace(
							/\n/g,
							'\n//' + ' '.repeat(spaceBefore),
						) || '';
				});
				resultLines.push(queryComment);
			}
		});

		const output = resultLines.join('\n');
		return sendWithMessageOwnership(
			msg,
			`${CODEBLOCK}ts\n${escapeCode(output)}${CODEBLOCK}\n`,
		);
	}
}
