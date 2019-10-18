import { Client } from 'discord.js';
import { commandHandler, Command } from '../utils/commandHandler';
import { readdirSync } from 'fs';
import { join } from 'path';

import { reactionAddEvent } from '../events/messageReactionAdd';
import { reactionRemoveEvent } from '../events/messageReactionRemove';

export class PascalClient extends Client {
	ourCommandHandler: commandHandler;

	public constructor(private readonly _token: string) {
		super({
			disabledEvents: ['TYPING_START'],
			disableEveryone: true,
			partials: ['MESSAGE', 'CHANNEL'],
		});

		// Handle Commands
		this.ourCommandHandler = new commandHandler(this, {
			prefix: 'p!',
      logger: (...message) => console.log('[BOT]', ...message),
      guildsAllowed: ['244230771232079873']
		});

		// Register commands
		const registeredCommands = Promise.all(
			readdirSync(join(__dirname, '../commands')).map(async fileName => {
				const path = join(__dirname, '../commands', fileName);
				const file: { command: Command } = await import(path);
				this.ourCommandHandler.registerCommand(file.command);
			}),
		);

		registeredCommands.catch(err => {
			console.error('[BOT] Was unable to load commands');
			console.error(err);
    });
    
    // Handle other events
		this.on('messageReactionAdd', reactionAddEvent);
		this.on('messageReactionRemove', reactionRemoveEvent);
	}

	public async start() {
		await this.login(this._token);
		console.log(`[BOT] Connected`);
	}
}
