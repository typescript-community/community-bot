import { Message } from 'discord.js';
import { Module } from 'cookiecord';

export async function splitCustomCommand(
	client: Module['client'],
	msg: Message,
) {
	const [commandPart, ...argParts] = msg.content.split(' ');
	const prefixes = await client.getPrefix(msg);
	const matchingPrefix = [prefixes]
		.flat()
		.find(x => msg.content.startsWith(x));
	if (!matchingPrefix) return;
	let command = commandPart.slice(matchingPrefix.length);
	if (client.commandManager.getByTrigger(command)) return;
	if (!command) return;
	return {
		command,
		args: argParts.join(' '),
	};
}
