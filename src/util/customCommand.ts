import { Message } from 'discord.js';
import { Bot } from '../bot';
import { prefixes } from '../env';

export async function splitCustomCommand(bot: Bot, msg: Message) {
	const [commandPart, ...argParts] = msg.content.split(' ');
	const matchingPrefix = prefixes.find(x => msg.content.startsWith(x));
	if (!matchingPrefix) return;
	let command = commandPart.slice(matchingPrefix.length);
	if (bot.getByTrigger(command)) return;
	if (!command) return;
	return {
		command,
		args: argParts.join(' '),
	};
}
