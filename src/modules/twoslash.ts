import {
	ApplicationCommandOptionType,
	ApplicationCommandType,
	ChatInputCommandInteraction,
	Message,
	MessageContextMenuCommandInteraction,
	MessageFlags,
} from 'discord.js';
import { twoslasher, TwoSlashReturn } from '@typescript/twoslash';
import { makeCodeBlock, findCode } from '../util/codeBlocks';
import { sendWithMessageOwnership } from '../util/send';
import { getTypeScriptModule, TypeScript } from '../util/getTypeScriptModule';
import { Bot } from '../bot';

// Preload typescript@latest
getTypeScriptModule('latest');

function getDefaultCompilerOptions(tsModule: typeof import('typescript')) {
	// TypeScript as of 6.0 has sane defaults for everything
	if (parseFloat(tsModule.versionMajorMinor) >= 6.0) {
		return {};
	}

	return {
		target: 'esnext',
	};
}

// Remove `@noErrorTruncation` from the source; this can cause lag/crashes for large errors
function redactNoErrorTruncation(code: string) {
	return code.replace(/@noErrorTruncation/g, '');
}

export function twoslashModule(bot: Bot) {
	bot.registerCommand({
		description:
			'Twoslash: Run twoslash on the latest codeblock, optionally returning the quick infos of specified symbols. You can use ts@4.8.3 or ts@next to run a specific version.',
		aliases: ['twoslash', 'ts'],
		options: [
			{
				name: 'version',
				description: 'Typescript version to use',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
			{
				name: 'symbol',
				description: 'The symbol to look for',
				type: ApplicationCommandOptionType.String,
				required: false,
			},
		],
		async listener(interaction) {
			await twoslash(
				interaction,
				interaction.options.getString('version') ?? 'latest',
				interaction.options.getString('symbol'),
			);
		},
	});

	bot.registerCommand({
		aliases: ['Twoslash'],
		description: '',
		type: ApplicationCommandType.Message,
		async listener(interaction) {
			await twoslash(interaction, 'latest');
		},
	});

	bot.client.on('messageCreate', async msg => {
		const match = msg.content.match(
			/^```(?:ts |typescript )?twoslash\n([\s\S]+)```$/im,
		);
		if (!msg.author.bot && match) {
			await twoslashBlock(
				msg,
				match[1],
				(await getTypeScriptModule('latest'))!,
			);
			await msg.delete();
		}
	});
}

async function twoslash(
	interaction:
		ChatInputCommandInteraction | MessageContextMenuCommandInteraction,
	version: string,
	symbol?: string | null,
) {
	const tsModule = await getTypeScriptModule(version);

	if (!tsModule)
		return await interaction.reply({
			content: ':x: Could not find that version of TypeScript',
			flags: MessageFlags.Ephemeral,
		});

	const code = interaction.isChatInputCommand()
		? interaction.options.getString('code', true)
		: await findCode(interaction.targetMessage);

	if (!code)
		return await interaction.reply({
			content: `:warning: could not find any TypeScript codeblocks in the past 10 messages`,
			flags: MessageFlags.Ephemeral,
		});

	if (!symbol) return await twoslashBlock(interaction, code, tsModule);

	if (!/^\s*([_$a-zA-Z][_$0-9a-zA-Z]*\b\s*)+/.test(symbol)) {
		return await interaction.reply({
			content: 'You need to give me a valid symbol name to look for!',
			flags: MessageFlags.Ephemeral,
		});
	}

	await interaction.deferReply();

	const symbols = [...new Set(symbol.trim().split(/\s+/g))];

	let ret: TwoSlashReturn;
	try {
		ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
			tsModule,
			defaultCompilerOptions: getDefaultCompilerOptions(tsModule),
			defaultOptions: { noErrorValidation: true },
		});
	} catch (e) {
		if (!(e instanceof Error)) throw e;
		return await interaction.editReply(`:x: ${e.message}`);
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

	await interaction.editReply(
		blocks.map(block => makeCodeBlock(block.join('\n'))).join(''),
	);
}

async function twoslashBlock(
	msgOrInt:
		| Message
		| ChatInputCommandInteraction
		| MessageContextMenuCommandInteraction,
	code: string,
	tsModule: TypeScript,
) {
	let ret: TwoSlashReturn;
	try {
		ret = twoslasher(redactNoErrorTruncation(code), 'ts', {
			tsModule,
			defaultCompilerOptions: getDefaultCompilerOptions(tsModule),
			defaultOptions: {
				noErrorValidation: true,
				noStaticSemanticInfo: false,
			},
		});
	} catch (e) {
		if (!(e instanceof Error)) throw e;
		if (msgOrInt instanceof Message)
			return await sendWithMessageOwnership(msgOrInt, `:x: ${e.message}`);
		return await msgOrInt.editReply(`:x: ${e.message}`);
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

			// Points to errors, e.g. '       ^^^^   ^^^^^'
			const hats = lineErrors
				// only those with a valid span
				.filter(x => x.character != null && x.length != null)
				// map to [start, end (non-inclusive)]
				.map(
					error =>
						[
							error.character!,
							error.character! + error.length!,
						] as const,
				)
				// sort by start, ascending
				.sort((a, b) => a[0] - b[0])
				// fix overlapping ranges
				.map((cur, i, a) => {
					let prev = a[i - 1];
					if (!prev) return cur;
					return [
						Math.max(prev[1], cur[0]),
						Math.max(prev[1], cur[1]),
					] as const;
				})
				// remove empty ranges
				.filter(([start, end]) => start < end)
				// map each to hats
				.map(([start, end], i, a) => {
					let prevEnd = a[i - 1]?.[1] ?? 0;
					return (
						' '.repeat(start - prevEnd) + '^'.repeat(end - start)
					);
				})
				// join the resulting strings
				.join('');

			if (hats.length > 0) {
				resultLines.push('//' + hats.slice(2));
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
					q.text?.replace(/\n/g, '\n//' + ' '.repeat(spaceBefore)) ||
					'';
			});
			resultLines.push(queryComment);
		}
	});

	const output = resultLines.join('\n');
	if (msgOrInt instanceof Message)
		return sendWithMessageOwnership(msgOrInt, makeCodeBlock(output) + '\n');
	return await msgOrInt.editReply(makeCodeBlock(output) + '\n');
}
