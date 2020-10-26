import { Message, MessageEmbed, User } from 'discord.js';

const MAX_TRACKED_MESSAGES = 1000;

const messageToUserId = new Map<string, string>();

export async function sendWithMessageOwnership(
	message: Message,
	toSend: string | { embed: MessageEmbed },
) {
	const sent = await message.channel.send(toSend);
	addMessageOwnership(sent, message.author);
}

export function addMessageOwnership(message: Message, user: User) {
	messageToUserId.set(message.id, user.id);
	// Without this memory grows unboundedly... very slowly, but better to avoid the issue.
	if (messageToUserId.size > MAX_TRACKED_MESSAGES) {
		// Keys returns an iterable in insertion order, so we remove the oldest message from the map.
		messageToUserId.delete(messageToUserId.keys().next().value);
	}
}

export function ownsBotMessage(message: Message, userId: string) {
	return messageToUserId.get(message.id) === userId;
}

export function clearMessageOwnership(message: Message) {
	messageToUserId.delete(message.id);
}
