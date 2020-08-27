import { TextChannel } from 'discord.js';

export async function findCodeblockFromChannel(
	channel: TextChannel,
	ignoreLatest?: boolean,
) {
	const CODEBLOCK_REGEX = /```(?:ts|typescript)?\n([\s\S]+)```/gm;

	const msgs = (await channel.messages.fetch({ limit: 10 }))
		.array()
		.filter(msg => msg.author.bot !== true);

	if (ignoreLatest) msgs.pop();

	return msgs
		.map(m => CODEBLOCK_REGEX.exec(m.content))
		.map(x => (x ? x[1] : ''))
		.filter(x => x !== '')[0];
}
