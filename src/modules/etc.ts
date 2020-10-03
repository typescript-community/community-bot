import {
	command,
	default as CookiecordClient,
	Module,
	listener,
} from 'cookiecord';
import { Message } from 'discord.js';
import { pingPong, dontAskToAsk, reactfcMsg } from './msg';

export class EtcModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({ description: 'See if the bot is alive' })
	async ping(msg: Message) {
		await msg.channel.send(pingPong);
	}

	@command({ description: 'Sends a link to <https://dontasktoask.com>' })
	async ask(msg: Message) {
		await msg.channel.send(dontAskToAsk);
	}

	@command({
		description:
			'Sends a link to <https://github.com/facebook/create-react-app/pull/8177#issue-353062710>',
	})
	async reactfc(msg: Message) {
		await msg.channel.send(reactfcMsg);
	}

	@listener({ event: 'message' })
	async onMessage(msg: Message) {
		if (msg.author.bot || !msg.content.toLowerCase().startsWith('poll:'))
			return;
		await msg.react('✅');
		await msg.react('❌');
		await msg.react('🤷');
	}
}
