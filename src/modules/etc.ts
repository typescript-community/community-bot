import { command, default as CookiecordClient, Module } from 'cookiecord';
import { Message } from 'discord.js';

export class EtcModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({ description: 'See if the bot is alive' })
	async ping(msg: Message) {
		await msg.channel.send('pong. :ping_pong:');
	}

	@command({ description: 'Sends a link to https://dontasktoask.com' })
	async ask(msg: Message) {
		await msg.channel.send('https://dontasktoask.com/');
	}
}
