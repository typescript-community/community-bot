import {
	command,
	default as CookiecordClient,
	listener,
	Module,
	optional,
} from 'cookiecord';
import { Message, MessageEmbed, TextChannel, User } from 'discord.js';
import {
	compressToEncodedURIComponent,
	decompressFromEncodedURIComponent,
} from 'lz-string';
import { format } from 'prettier';
import { URLSearchParams } from 'url';
import { TS_BLUE } from '../env';
import {
	makeCodeBlock,
	findCode,
	PLAYGROUND_REGEX,
	truncate,
} from '../util/codeBlocks';
import { LimitedSizeMap } from '../util/limitedSizeMap';
import { addMessageOwnership, sendWithMessageOwnership } from '../util/send';
import fetch from 'node-fetch';

const LINK_SHORTENER_ENDPOINT = 'https://tsplay.dev/api/short';
const MAX_EMBED_LENGTH = 512;
const DEFAULT_EMBED_LENGTH = 256;

export class PlaygroundModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	private editedLongLink = new LimitedSizeMap<string, Message>(1000);

	@command({
		aliases: ['pg', 'playg'],
		single: true,
		description: 'Shorten a TypeScript playground link',
	})
	async playground(msg: Message, @optional code?: string) {
		const PLAYGROUND_BASE = 'https://www.typescriptlang.org/play/#code/';

		if (!code) {
			code = await findCode(msg, true);
			if (!code)
				return sendWithMessageOwnership(
					msg,
					":warning: couldn't find a codeblock!",
				);
		}
		const embed = new MessageEmbed()
			.setURL(PLAYGROUND_BASE + compressToEncodedURIComponent(code))
			.setTitle('View in Playground')
			.setColor(TS_BLUE);
		await sendWithMessageOwnership(msg, { embed });
	}

	@listener({ event: 'message' })
	async onPlaygroundLinkMessage(msg: Message) {
		if (msg.author.bot) return;
		if (msg.content[0] === '!') return;
		const exec = PLAYGROUND_REGEX.exec(msg.content);
		if (!exec) return;
		const embed = createPlaygroundEmbed(msg.author, exec);
		if (exec[0] === msg.content) {
			// Message only contained the link
			await sendWithMessageOwnership(msg, { embed });
			await msg.delete();
		} else {
			// Message also contained other characters
			const botMsg = await msg.channel.send(
				`${msg.author} Here's a shortened URL of your playground link! You can remove the full link from your message.`,
				{ embed },
			);
			this.editedLongLink.set(msg.id, botMsg);
			await addMessageOwnership(botMsg, msg.author);
		}
	}

	@listener({ event: 'message' })
	async onPlaygroundLinkAttachment(msg: Message) {
		const attachment = msg.attachments.find(a => a.name === 'message.txt');
		if (msg.author.bot || !attachment) return;
		const content = await fetch(attachment.url).then(r => r.text());
		const exec = PLAYGROUND_REGEX.exec(content);
		// By default, if you write a message in the box and then paste a long
		// playground link, it will only put the paste in message.txt and will
		// put the rest of the message in msg.content
		if (!exec || exec[0] !== content) return;
		const shortenedUrl = await shortenPlaygroundLink(exec[0]);
		const embed = createPlaygroundEmbed(msg.author, exec, shortenedUrl);
		await sendWithMessageOwnership(msg, { embed });
		if (!msg.content) await msg.delete();
	}

	@listener({ event: 'messageUpdate' })
	async onLongFix(_oldMsg: Message, msg: Message) {
		if (msg.partial) await msg.fetch();
		const exec = PLAYGROUND_REGEX.exec(msg.content);
		if (msg.author.bot || !this.editedLongLink.has(msg.id) || exec) return;
		const botMsg = this.editedLongLink.get(msg.id);
		await botMsg?.edit('');
		this.editedLongLink.delete(msg.id);
	}
}

// Take care when messing with the truncation, it's extremely finnicky
function createPlaygroundEmbed(
	author: User,
	[_url, query, code]: RegExpExecArray,
	url: string = _url,
) {
	const embed = new MessageEmbed()
		.setColor(TS_BLUE)
		.setTitle('Shortened Playground Link')
		.setAuthor(author.tag, author.displayAvatarURL())
		.setURL(url);

	const unzipped = decompressFromEncodedURIComponent(code);
	if (!unzipped) return embed;

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
		? Math.min(lineIndices[endLine], startChar + MAX_EMBED_LENGTH)
		: startChar + DEFAULT_EMBED_LENGTH;
	// End of the line containing the cutoff
	const endChar = lineIndices.find(len => len >= cutoff) ?? normalized.length;

	let pretty;
	try {
		// Make lines as short as reasonably possible, so they fit in the embed.
		// We pass prettier the full string, but only format part of it, so we can
		// calculate where the endChar is post-formatting.
		pretty = format(normalized, {
			parser: 'typescript',
			printWidth: 55,
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

	if (!startLine && !endLine) {
		embed.setFooter(
			'You can choose specific lines to embed by selecting them before copying the link.',
		);
	}

	return embed.setDescription(makeCodeBlock(formattedSection));
}

async function shortenPlaygroundLink(url: string) {
	const response = await fetch(LINK_SHORTENER_ENDPOINT, {
		method: 'post',
		body: JSON.stringify({ url, createdOn: 'api', expires: false }),
		headers: {
			'Content-Type': 'application/json',
		},
	});
	const { shortened } = await response.json();
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
		.map(n => (n !== NaN && 1 <= n && n <= numLines ? n : undefined))
		.sort((a, b) => (a ?? Infinity) - (b ?? Infinity));

	return { startLine, endLine };
}
