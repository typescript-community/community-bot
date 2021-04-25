import { Message } from 'discord.js';

export async function getReferencedMessage(msg: Message) {
	if (!msg.reference?.messageID) return null;
	const message = await msg.channel.messages.fetch(msg.reference.messageID);
	return message;
}
