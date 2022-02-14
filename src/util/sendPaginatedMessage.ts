import { MessageEmbed, MessageReaction, Message, User } from 'discord.js';

const controls = {
	back: '◀',
	first: '⏮',
	last: '⏭',
	next: '▶',
	stop: '⏹',
};

export async function sendPaginatedMessage(
	embed: MessageEmbed,
	pages: string[],
	msg: Message,
	timeout: number = 100000,
): Promise<Message> {
	let curPage = 0;
	const message = await msg.channel.send({
		embeds: [
			embed
				.setDescription(pages[curPage])
				.setFooter(`Page ${curPage + 1} of ${pages.length}`),
		],
	});
	if (pages.length === 1) return message;

	await message.react(controls.first);
	await message.react(controls.back);
	await message.react(controls.stop);
	await message.react(controls.next);
	await message.react(controls.last);

	const collector = message.createReactionCollector({
		filter: (reaction, user) =>
			user.id === msg.author.id && user.id !== message.author.id,
		time: timeout,
	});

	collector.on('collect', async (reaction: MessageReaction, user: User) => {
		await reaction.users.remove(user);

		switch (reaction.emoji.toString()) {
			case controls.first:
				curPage = 0;
				break;
			case controls.last:
				curPage = pages.length - 1;
				break;
			case controls.stop:
				await message.reactions.removeAll();
				break;
			case controls.back:
				curPage--;
				if (curPage < 0) curPage = pages.length - 1;
				break;
			case controls.next:
				curPage++;
				if (curPage > pages.length - 1) curPage = 0;
				break;
		}

		await message.edit({
			embeds: [
				embed
					.setDescription(pages[curPage])
					.setFooter(`Page ${curPage + 1} of ${pages.length}`),
			],
		});
	});

	collector.on('end', () => {
		Object.values(controls).forEach(emoji => {
			message.reactions.resolve(emoji)?.remove();
		});
	});

	return message;
}
