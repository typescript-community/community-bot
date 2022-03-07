import {
	Message,
	MessageEmbed,
	MessageOptions,
	MessagePayload,
	PartialMessage,
	User,
} from 'discord.js';
import { isHelpChannel } from '../modules/helpthread';
import { LimitedSizeMap } from './limitedSizeMap';

const messageToUserId = new LimitedSizeMap<
	string,
	{ owner: string; onDelete?: () => void }
>(1000);

export const DELETE_EMOJI = '🗑️';

export async function getResponseChannel(message: Message) {
	const channel = message.channel;
	if (!isHelpChannel(channel)) return channel;
	while (!message.thread) {
		message = await message.fetch();
	}
	return message.thread;
}

export async function sendWithMessageOwnership(
	message: Message,
	toSend: string | MessagePayload | MessageOptions,
	onDelete?: () => void,
) {
	const channel = await getResponseChannel(message);
	const sent = await channel.send(toSend);
	await addMessageOwnership(sent, message.author, onDelete);
}

export async function addMessageOwnership(
	message: Message,
	user: User,
	onDelete?: () => void,
) {
	await message.react(DELETE_EMOJI);

	messageToUserId.set(message.id, { owner: user.id, onDelete });
}

export function getMessageOwner(message: Message | PartialMessage) {
	return messageToUserId.get(message.id)?.owner;
}

export function ownsBotMessage(
	message: Message | PartialMessage,
	userId: string,
) {
	return messageToUserId.get(message.id)?.owner === userId;
}

export function clearMessageOwnership(message: Message | PartialMessage) {
	messageToUserId.get(message.id)?.onDelete?.();
	messageToUserId.delete(message.id);
}
