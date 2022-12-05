import { Bot } from '../bot';
import { autorole, rolesChannelId } from '../env';

export async function autoroleModule({ client }: Bot) {
	const channel = await client.channels.fetch(rolesChannelId);
	if (!channel?.isTextBased()) {
		console.error(
			`Roles channel (${rolesChannelId}) does not exist or is not text based.`,
		);
		return;
	}

	for (const ar of autorole) {
		const msg = await channel.messages.fetch(ar.msgID);
		if (!msg) {
			console.error(`Role message does not exist for ${ar.msgID}`);
		}
		await msg?.react(ar.emoji);
	}

	client.on('messageReactionAdd', async (reaction, user) => {
		if (user.id == client.user.id) return;
		if (reaction.partial) await reaction.fetch();
		for (const ar of autorole) {
			const msg = reaction.message;
			if (
				ar.emoji !== reaction.emoji.toString() ||
				ar.msgID !== msg.id ||
				!msg.guild
			)
				continue;
			if (ar.autoRemove) await reaction.users.remove(user.id);
			const member = await msg.guild.members.fetch(user.id);
			await member.roles.add(ar.roleID);
			console.log('Gave role', ar.roleID, 'to', member);
			if (!reaction.users.cache.has(client.user.id)) {
				await msg.react(reaction.emoji);
			}
		}
	});

	client.on('messageReactionRemove', async (reaction, user) => {
		if (user.id == client.user.id) return;
		if (reaction.partial) await reaction.fetch();
		for (const ar of autorole) {
			const msg = reaction.message;
			if (
				ar.emoji !== reaction.emoji.toString() ||
				ar.msgID !== msg.id ||
				ar.autoRemove ||
				!msg.guild
			)
				continue;
			const member = await msg.guild.members.fetch(user.id);
			await member.roles.remove(ar.roleID);
			console.log('Removed role', ar.roleID, 'from', member);
		}
	});
}
