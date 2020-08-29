import { TextChannel } from 'discord.js';
import { decompressFromEncodedURIComponent } from 'lz-string';

const CODEBLOCK_REGEX = /```(?:ts|typescript)?\n([\s\S]+)```/;

export const PLAYGROUND_REGEX = /https?:\/\/(?:www\.)?typescriptlang\.org\/(?:play|dev\/bug-workbench)(?:\/index\.html)?\/?\??(?:\w+=[^\s#&]+)?(?:\&\w+=[^\s#&]+)*#code\/([\w-+_]+={0,4})/;

export async function findCodeblockFromChannel(
	channel: TextChannel,
	ignoreLatest?: boolean,
) {
	const msgs = (await channel.messages.fetch({ limit: 10 }))
		.array()
		.filter(msg => msg.author.bot !== true);

	if (ignoreLatest) msgs.shift();

	return msgs
		.map(m => CODEBLOCK_REGEX.exec(m.content))
		.map(x => (x ? x[1] : ''))
		.filter(x => x !== '')[0];
}

// Two possibilities:
// 1: Normal code block annotated with ts from a non-bot
// 2: Link to TS playground. This can be either from a bot or a normal user
//    since we shorten playground links on their own and delete the message.
export async function findCodeFromChannel(channel: TextChannel) {
	const msgs = (await channel.messages.fetch({ limit: 10 })).array();

	for (const { author, content, embeds } of msgs) {
		if (!author.bot) {
			const match = content.match(CODEBLOCK_REGEX);
			if (match && match[1].length) {
				return match[1];
			}
		}

		const match = content.match(PLAYGROUND_REGEX);
		if (match) {
			return decompressFromEncodedURIComponent(match[1]);
		}

		for (const embed of embeds) {
			const match = embed.url?.match(PLAYGROUND_REGEX);
			if (match) {
				return decompressFromEncodedURIComponent(match[1]);
			}
		}
	}
}
