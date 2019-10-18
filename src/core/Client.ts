import { Client, Message } from 'discord.js';

import { repCommand } from '../commands/rep';
import { getRepCommand } from '../commands/getRep';
import { leaderboardCommand } from '../commands/leaderboard';
import { removeRepCommand } from '../commands/removeRep';

import { reactionAddEvent } from '../events/messageReactionAdd';
import { reactionRemoveEvent } from '../events/messageReactionRemove';

export class PascalClient extends Client {
	public constructor(private readonly _token: string) {
		super({
			disabledEvents: ['TYPING_START'],
			disableEveryone: true,
			partials: ['MESSAGE', 'CHANNEL'],
		});

		this.on('message', this.onMessage);
		this.on('messageReactionAdd', reactionAddEvent);
		this.on('messageReactionRemove', reactionRemoveEvent);
	}

	public async start() {
		await this.login(this._token);
		console.log(`[BOT] Connected`);
	}

	private async onMessage(message: Message) {
		if (message.author.bot) return;
		if (!message.guild) return;

		if (message.content.startsWith('+rep')) repCommand(message);
		if (message.content.startsWith('t!rep')) getRepCommand(message);
		if (
			message.content.startsWith('t!leaderboard') ||
			message.content.startsWith('t!lb')
		) {
			leaderboardCommand(message);
		}
		if (message.content.startsWith('t!removerep')) removeRepCommand(message);
	}
}
