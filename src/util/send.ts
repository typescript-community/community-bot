import { Message, MessageEmbed, User } from 'discord.js';
import { LimitedSizeMap } from './limitedSizeMap';

const messageToUserId = new LimitedSizeMap<string, string>(1000);

export const DELETE_EMOJI = '🗑️';

export async function sendWithMessageOwnership(
	message: Message,
	toSend: string | { embed: MessageEmbed },
) {
	const sent = await message.channel.send(toSend);
	await addMessageOwnership(sent, message.author);
}

export async function addMessageOwnership(message: Message, user: User) {
	await message.react(DELETE_EMOJI);

	messageToUserId.set(message.id, user.id);
}

export function ownsBotMessage(message: Message, userId: string) {
	return messageToUserId.get(message.id) === userId;
}

export function clearMessageOwnership(message: Message) {
	messageToUserId.delete(message.id);
}
