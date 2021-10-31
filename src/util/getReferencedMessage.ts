import { Message } from 'discord.js';

export async function getReferencedMessage(msg: Message) {
	if (!msg.reference?.messageId) return null;
	const message = await msg.channel.messages.fetch(msg.reference.messageId);
	return message;
}
