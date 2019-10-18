import { Client } from 'discord.js';
import { commandHandler, Command } from '../utils/commandHandler';
import { readdirSync } from 'fs';
import { join } from 'path';

export class PascalClient extends Client {
	ourCommandHandler: commandHandler;

	public constructor(private readonly _token: string) {
		super({ disabledEvents: ['TYPING_START'], disableEveryone: true });

		// Handle Commands
		this.ourCommandHandler = new commandHandler(this, {
			prefix: 'p!',
			logger: (...message) => console.log('[BOT]', ...message),
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
	}

	public async start() {
		await this.login(this._token);
		console.log(`[BOT] Connected`);
	}
}
