import { default as CookiecordClient, Module, listener } from 'cookiecord';
import { Message } from 'discord.js';
import { rulesChannelId } from '../env';

// Most job posts are in this format:
// > [FOR HIRE][REMOTE][SOMETHING ELSE]
// > Hi, I'm ponyman6000. Hire me!
const jobPostRegex = /^(?:\[[A-Z ]+\]){2,}\n/i;

export class ModModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'message' })
	async onJobMessage(msg: Message) {
		if (msg.author.bot || !jobPostRegex.test(msg.content)) return;
		await msg.delete();
		await msg.channel.send(
			`${msg.author} We don't do job posts here; see <#${rulesChannelId}>`,
		);
	}
}
