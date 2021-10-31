import { command, Module, listener } from 'cookiecord';
import { Message, TextChannel } from 'discord.js';
import { twoslasher, TwoSlashReturn } from '@typescript/twoslash';
import { makeCodeBlock, findCode } from '../util/codeBlocks';
import { sendWithMessageOwnership } from '../util/send';
import { getTypeScriptModule, TypeScript } from '../util/getTypeScriptModule';
import { splitCustomCommand } from '../util/customCommand';

// Preload typescript@latest
getTypeScriptModule('latest');

// Remove `@noErrorTruncation` from the source; this can cause lag/crashes for large errors
function redactNoErrorTruncation(code: string) {
	return code.replace(/@noErrorTruncation/g, '');
}

export class TwoslashModule extends Module {
	@command({
		single: true,
		description:
			'Twoslash: Run twoslash on the latest codeblock, optionally returning the quickinfos of specified symbols',
		aliases: ['ts'],
	})
	async twoslash(msg: Message, content: string) {
		await this._twoslash(msg, 'latest', content);
	}

	@listener({ event: 'messageCreate' })
	async twoslashVersion(msg: Message) {
		const commandData = await splitCustomCommand(this.client, msg);
		if (!commandData) return;
		const { command, args } = commandData;
		if (!command.startsWith('ts@') && !command.startsWith('twoslash@'))
			return;
		const version = command.split('@').slice(1).join('@');
		await this._twoslash(msg, version, args);
	}

	async _twoslash(msg: Message, version: string, content: string) {
		const tsModule = await getTypeScriptModule(version);

		if (!tsModule)
			return await sendWithMessageOwnership(
				msg,
				':x: Could not find that version of TypeScript',
			);

		const code = await findCode(msg);

		if (!code)
			return await sendWithMessageOwnership(
				msg,
				`:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			);

		if (!content) return await this.twoslashBlock(msg, code, tsModule);

		if (!/^\s*([_$a-zA-Z][_$0-9a-zA-Z]*\b\s*)+/.test(content)) {
			return sendWithMessageOwnership(
				msg,
				'You need to give me a valid symbol name to look for!',
			);
		}

		const symbols = [...new Set(content.trim().split(/\s+/g))];

		let ret: TwoSlashReturn;
		try {
			ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
				tsModule,
				defaultOptions: { noErrorValidation: true },
			});
		} catch (e) {
			if (!(e instanceof Error)) throw e;
			return await sendWithMessageOwnership(msg, `:x: ${e.message}`);
		}

		const blocks = [];

		for (const symbol of symbols) {
			const block = [];
			const matches: Record<string, Set<string>> = {};
			for (const quickInfo of ret.staticQuickInfos) {
				if (quickInfo.targetString !== symbol) continue;
				(matches[quickInfo.text] =
					matches[quickInfo.text] ?? new Set()).add(
					`${quickInfo.line + 1}:${quickInfo.character + 1}`,
				);
			}
			if (!Object.entries(matches).length)
				block.push(`/* No symbol named \`${symbol}\` found */`);
			for (const [info, locSet] of Object.entries(matches)) {
				block.push(`${info} /* ${[...locSet].join(', ')} */`);
			}
			blocks.push(block);
		}

		await sendWithMessageOwnership(
			msg,
			blocks.map(block => makeCodeBlock(block.join('\n'))).join(''),
		);
	}

	@listener({ event: 'messageCreate' })
	async onTwoslashCodeBlock(msg: Message) {
		const match = msg.content.match(
			/^```(?:ts |typescript )?twoslash\n([\s\S]+)```$/im,
		);
		if (!msg.author.bot && match) {
			await this.twoslashBlock(
				msg,
				match[1],
				(await getTypeScriptModule('latest'))!,
			);
			await msg.delete();
		}
	}

	private async twoslashBlock(
		msg: Message,
		code: string,
		tsModule: TypeScript,
	) {
		let ret: TwoSlashReturn;
		try {
			ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
				tsModule,
				defaultOptions: {
					noErrorValidation: true,
					noStaticSemanticInfo: false,
				},
			});
		} catch (e) {
			if (!(e instanceof Error)) throw e;
			return await sendWithMessageOwnership(msg, `:x: ${e.message}`);
		}

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
		return sendWithMessageOwnership(msg, makeCodeBlock(output) + '\n');
	}
}
