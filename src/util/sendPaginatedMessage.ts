import {
	GuildMember,
	MessageReaction,
	TextBasedChannel,
	User,
} from 'discord.js';
import { MessageBuilder } from './messageBuilder';

const emojis = {
	back: '◀',
	first: '⏮',
	last: '⏭',
	next: '▶',
	stop: '⏹',
};

export async function sendPaginatedMessage(
	builder: MessageBuilder,
	pages: string[],
	member: GuildMember,
	channel: TextBasedChannel,
	timeout: number = 100000,
) {
	let curPage = 0;
	const message = await channel.send(
		builder
			.setDescription(pages[curPage])
			.setFooter(`Page ${curPage + 1} of ${pages.length}`)
			.build(),
	);
	if (pages.length === 1) return;

	await message.react(emojis.first);
	await message.react(emojis.back);
	await message.react(emojis.stop);
	await message.react(emojis.next);
	await message.react(emojis.last);

	const collector = message.createReactionCollector({
		filter: (_reaction, user) =>
			user.id === member.id && user.id !== message.author.id,
		time: timeout,
	});

	collector.on('collect', async (reaction: MessageReaction, user: User) => {
		await reaction.users.remove(user);

		switch (reaction.emoji.toString()) {
			case emojis.first:
				curPage = 0;
				break;
			case emojis.last:
				curPage = pages.length - 1;
				break;
			case emojis.stop:
				await message.reactions.removeAll();
				break;
			case emojis.back:
				curPage--;
				if (curPage < 0) curPage = pages.length - 1;
				break;
			case emojis.next:
				curPage++;
				if (curPage > pages.length - 1) curPage = 0;
				break;
		}

		await message.edit(
			builder
				.setDescription(pages[curPage])
				.setFooter(`Page ${curPage + 1} of ${pages.length}`)
				.build(),
		);
	});

	collector.on('end', () => {
		message.reactions.removeAll();
	});
}
