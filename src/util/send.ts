import { Message, MessageEmbed, GuildMember } from 'discord.js';

const MAX_TRACKED_MESSAGES = 1000;

const messageIdToMemberId = new Map<string, string>();

export async function sendWithMessageOwnership(
	message: Message,
	toSend: string | MessageEmbed,
) {
	const sent = await message.channel.send(toSend);
	messageIdToMemberId.set(sent.id, message.author.id);

	// Without this memory grows unboundedly... very slowly, but better to avoid the issue.
	if (messageIdToMemberId.size > MAX_TRACKED_MESSAGES) {
		// Keys returns an iterable in insertion order, so we remove the oldest message from the map.
		messageIdToMemberId.delete(messageIdToMemberId.keys().next().value);
	}
}

export function ownsBotMessage(message: Message, member: GuildMember) {
	return messageIdToMemberId.get(message.id) === member.id;
}

export function clearMessageOwnership(message: Message) {
	messageIdToMemberId.delete(message.id);
}
