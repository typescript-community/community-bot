import { Message, User } from 'discord.js';
import {
	compressToEncodedURIComponent,
	decompressFromEncodedURIComponent,
} from 'lz-string';
import { format } from 'prettier';
import { URLSearchParams } from 'url';
import {
	makeCodeBlock,
	findCode,
	matchPlaygroundLink,
	PlaygroundLinkMatch,
} from '../util/codeBlocks';
import { LimitedSizeMap } from '../util/limitedSizeMap';
import { addMessageOwnership, sendWithMessageOwnership } from '../util/send';
import { fetch } from 'undici';
import { Bot } from '../bot';
import { MessageBuilder } from '../util/messageBuilder';

const PLAYGROUND_BASE = 'https://www.typescriptlang.org/play/#code/';
const LINK_SHORTENER_ENDPOINT = 'https://tsplay.dev/api/short';
const MAX_PREVIEW_LENGTH = 512;
const DEFAULT_PREVIEW_LENGTH = 256;

export async function playgroundModule(bot: Bot) {
	const editedLongLink = new LimitedSizeMap<
		string,
		[Message, MessageBuilder]
	>(1000);

	bot.registerCommand({
		aliases: ['playground', 'pg', 'playg'],
		description: 'Shorten a TypeScript playground link',
		async listener(msg, content) {
			console.log('Playground', msg.content);

			let code: string | undefined = content;

			if (!code) {
				code = await findCode(msg, true);
				if (!code)
					return sendWithMessageOwnership(
						msg,
						":warning: couldn't find a codeblock!",
					);
			}
			const builder = new MessageBuilder()
				.setTitle('View in Playground')
				.setURL(PLAYGROUND_BASE + compressToEncodedURIComponent(code));
			await sendWithMessageOwnership(msg, builder.build());
		},
	});

	bot.client.on('messageCreate', async msg => {
		if (msg.author.bot) return;
		if (msg.content[0] === '!') return;
		const exec = matchPlaygroundLink(msg.content);
		if (!exec) return;
		const builder = createPlaygroundMessage(msg.author, exec);
		if (exec.isWholeMatch) {
			// Message only contained the link
			await sendWithMessageOwnership(msg, builder.build());
			await msg.delete();
		} else {
			// Message also contained other characters
			builder.setFooter(
				`${msg.author} Here's a shortened URL of your playground link! You can remove the full link from your message.`,
			);
			builder.setAllowMentions('users');
			const botMsg = await msg.channel.send(builder.build());
			editedLongLink.set(msg.id, [botMsg, builder]);
			await addMessageOwnership(botMsg, msg.author);
		}
	});

	bot.client.on('messageCreate', async msg => {
		const attachment = msg.attachments.find(a => a.name === 'message.txt');
		if (msg.author.bot || !attachment) return;
		const content = await fetch(attachment.url).then(r => r.text());
		const exec = matchPlaygroundLink(content);
		// By default, if you write a message in the box and then paste a long
		// playground link, it will only put the paste in message.txt and will
		// put the rest of the message in msg.content
		if (!exec?.isWholeMatch) return;
		const shortenedUrl = await shortenPlaygroundLink(exec.url);
		const builder = createPlaygroundMessage(msg.author, exec, shortenedUrl);
		await sendWithMessageOwnership(msg, builder.build());
		if (!msg.content) await msg.delete();
	});

	bot.client.on('messageUpdate', async (_oldMsg, msg) => {
		if (msg.partial) msg = await msg.fetch();
		const exec = matchPlaygroundLink(msg.content);
		if (msg.author.bot || !editedLongLink.has(msg.id) || exec) return;
		const [botMsg, builder] = editedLongLink.get(msg.id)!;
		// Edit the message to only have the preview and not the "please edit your message" message
		await botMsg?.edit(builder.setFooter('').setAllowMentions().build());
		editedLongLink.delete(msg.id);
	});
}

// Take care when messing with the truncation, it's extremely finnicky
function createPlaygroundMessage(
	author: User,
	{ url: _url, query, code, isEscaped }: PlaygroundLinkMatch,
	url: string = _url,
) {
	const builder = new MessageBuilder().setAuthor(
		`From ${author}: [View in Playground](<${url}>)`,
	);

	const unzipped = decompressFromEncodedURIComponent(code);
	if (!unzipped) return builder;

	// Without 'normalized' you can't get consistent lengths across platforms
	// Matters because the playground uses the line breaks of whoever created it
	const lines = unzipped.split(/\r\n|\r|\n/);
	const normalized = lines.join('\n');

	const lengths = lines.map(l => l.length);
	const cum = lengths.slice(1).reduce((acc, len, i) => {
		acc.push(len + acc[i] + '\n'.length);
		return acc;
	}, lengths.slice(0, 1));
	const lineIndices = [0].concat(cum);

	// Note: lines are 1-indexed
	let { startLine, endLine } = getSelectionQueryParams(query, lines.length);

	const startChar = startLine ? lineIndices[startLine - 1] : 0;
	const cutoff = endLine
		? Math.min(lineIndices[endLine], startChar + MAX_PREVIEW_LENGTH)
		: startChar + DEFAULT_PREVIEW_LENGTH;
	// End of the line containing the cutoff
	const endChar = lineIndices.find(len => len >= cutoff) ?? normalized.length;

	let pretty;
	try {
		// Make lines as short as reasonably possible, so they fit in the preview.
		// We pass prettier the full string, but only format part of it, so we can
		// calculate where the endChar is post-formatting.
		pretty = format(normalized, {
			parser: 'typescript',
			printWidth: 72,
			tabWidth: 2,
			semi: false,
			bracketSpacing: false,
			arrowParens: 'avoid',
			rangeStart: startChar,
			rangeEnd: endChar,
		});
	} catch (e) {
		// Likely a syntax error
		pretty = normalized;
	}
	const prettyEndChar = pretty.length - (normalized.length - endChar);
	const formattedSection = pretty.slice(startChar, prettyEndChar);
	const content =
		(startChar === 0 ? '' : '...\n') +
		formattedSection.replace(/^\s*\n|\n\s*$/g, '') +
		(prettyEndChar === pretty.length ? '' : '\n...');

	if (!isEscaped) {
		builder.addFields({ name: 'Preview:', value: makeCodeBlock(content) });
	}

	return builder;
}

async function shortenPlaygroundLink(url: string) {
	const response = await fetch(LINK_SHORTENER_ENDPOINT, {
		method: 'post',
		body: JSON.stringify({ url, createdOn: 'api', expires: false }),
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const { shortened } = (await response.json()) as any;
	if (typeof shortened !== 'string')
		throw new Error('Received invalid api response from link shortener');
	return shortened;
}

// Sometimes the cursor is at the start of the selection, and other times
// it's at the end of the selection; we don't care which, only that the
// lower one always comes first. Also, parameter validation happens here
function getSelectionQueryParams(query: string, numLines: number) {
	const params = new URLSearchParams(query);

	const [startLine, endLine] = ['pln', 'ssl']
		// @ts-expect-error parseInt(null) is okay here since we check for NaN
		.map(name => parseInt(params.get(name)))
		.map(n => (!Number.isNaN(n) && 1 <= n && n <= numLines ? n : undefined))
		.sort((a, b) => (a ?? Infinity) - (b ?? Infinity));

	return { startLine, endLine };
}
