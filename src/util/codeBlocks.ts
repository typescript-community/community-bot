import { Message, MessageType } from 'discord.js';
import { decompressFromEncodedURIComponent } from 'lz-string';
import { getReferencedMessage } from './getReferencedMessage';

const CODEBLOCK_REGEX = /```(?:ts|typescript|js|javascript)?\n([\s\S]+)```/;

const PLAYGROUND_REGEX =
	/<?(https?:\/\/(?:www\.)?(?:typescriptlang|staging-typescript)\.org\/(?:[a-z]{2,3}\/)?(?:play|dev\/bug-workbench)(?:\/index\.html)?\/?(\??(?:\w+=[^\s#&]*)?(?:\&\w+=[^\s#&]*)*)#code\/([\w\-%+_]+={0,4}))>?/;

export type PlaygroundLinkMatch = {
	url: string;
	query: string;
	code: string;
	isWholeMatch: boolean;
	/* Is the url wrapped in < > ? */
	isEscaped: boolean;
};
export function matchPlaygroundLink(
	msg: string,
): PlaygroundLinkMatch | undefined {
	const match = msg.match(PLAYGROUND_REGEX);
	if (!match) return;
	const [possiblyEscapedUrl, url, query, code] = match;
	const isWholeMatch = msg === possiblyEscapedUrl;
	const isEscaped = possiblyEscapedUrl.length === url.length + 2;
	return { url, query, code, isWholeMatch, isEscaped };
}

export async function findCode(message: Message, ignoreLinks = false) {
	const codeInMessage = await findCodeInMessage(message, ignoreLinks);
	if (codeInMessage) return codeInMessage;
	const referencedMessage = await getReferencedMessage(message);
	if (referencedMessage) {
		const codeInReferencedMessage = await findCodeInMessage(
			referencedMessage,
			ignoreLinks,
		);
		if (codeInReferencedMessage) return codeInReferencedMessage;
	}
	const msgs = await message.channel.messages.fetch({ limit: 10 });

	for (const msg of msgs.values()) {
		const code = await findCodeInMessage(msg, ignoreLinks);
		if (code) return code;
	}
}

// Two possibilities:
// 1: Normal code block annotated with ts from a non-bot
// 2: Link to TS playground. This can be either from a bot or a normal user
//    since we shorten playground links on their own and delete the message.
async function findCodeInMessage(msg: Message, ignoreLinks = false) {
	if (msg.type === MessageType.ThreadStarterMessage) {
		msg = await msg.fetchReference();
	}
	const { author, content, embeds } = msg;
	if (!author.bot) {
		const match = content.match(CODEBLOCK_REGEX);
		if (match && match[1].length) {
			return match[1];
		}
	}

	if (ignoreLinks) return;

	const codeSources = [content, ...embeds.map(({ url }) => url)];

	for (const code of codeSources) {
		const match = code && matchPlaygroundLink(code);
		if (match) {
			return decompressFromEncodedURIComponent(match.code);
		}
	}
}

const CODEBLOCK = '```';
// 2048 is the most characters Discord allows in a message/embed
const MAX_CODE_LENGTH = 2048 - `${CODEBLOCK}ts\n${CODEBLOCK}`.length;

export function makeCodeBlock(code: string) {
	return `${CODEBLOCK}ts\n${truncate(
		escapeCode(code),
		MAX_CODE_LENGTH,
	)}${CODEBLOCK}`;
}

// Note: If str.length === cutoff, the string fits! No need to truncate.
// (This is an easy off-by-one error to make)
export function truncate(str: string, max: number) {
	return str.length <= max ? str : str.slice(0, max - 1) + '…';
}

// Custom escape function instead of using discord.js Util.escapeCodeBlock because this
// produces better results with template literal types. Discord's markdown handling is pretty
// bad. It doesn't properly handle escaping back ticks, so we instead insert zero width spaces
// so that users cannot escape our code block.
function escapeCode(code: string) {
	return code.replace(/`(?=`)/g, '`\u200B');
}
