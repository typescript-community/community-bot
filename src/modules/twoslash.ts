import { command, Module } from 'cookiecord';
import { Message, TextChannel } from 'discord.js';
import { twoslasher } from '@typescript/twoslash';
import { findCodeFromChannel } from '../util/findCodeblockFromChannel';

const CODEBLOCK = '```';

export class TwoslashModule extends Module {
	@command({ single: true })
	async ts(msg: Message, symbol: string) {
		const code = await findCodeFromChannel(msg.channel as TextChannel);

		if (!code)
			return msg.channel.send(
				`:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			);

		const ret = twoslasher(code, 'ts', {
			defaultOptions: { noErrorValidation: true },
		});

		const value = ret.staticQuickInfos.find(
			i => i.targetString === symbol.trim(),
		);
		if (!value)
			return msg.channel.send(
				`:warning: no symbol named \`${symbol}\` in the most recent codeblock`,
			);

		return msg.channel.send(
			`${CODEBLOCK}typescript\n${value.text}${CODEBLOCK}`,
		);
	}

	@command()
	async twoslash(msg: Message) {
		const code = await findCodeFromChannel(msg.channel as TextChannel);

		if (!code)
			return msg.channel.send(
				`:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			);

		const ret = twoslasher(code, 'ts', {
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
				resultLines.push(linkWithHats);
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
		return msg.channel.send(`${CODEBLOCK}ts\n${output}${CODEBLOCK}\n`);
	}
}
