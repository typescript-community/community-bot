import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

import { reactionAddEvent } from '../events/messageReactionAdd';
import { reactionRemoveEvent } from '../events/messageReactionRemove';
import { Command, CommandHandler } from '../utils/commandHandler';

export class PascalClient extends Client {
    commandHandler: CommandHandler;

    public constructor(private readonly _token: string) {
        super({
            disabledEvents: ['TYPING_START'],
            disableEveryone: true,
            partials: ['MESSAGE', 'CHANNEL'],
        });

        this.commandHandler = new CommandHandler(this, {
            prefix: 't!',
            logger: (...message): void => console.log('[BOT]', ...message),
            guildsAllowed: ['244230771232079873', '508357248330760243'],
        });

        const registeredCommands = Promise.all(
            readdirSync(join(__dirname, '../commands'))
                .filter(fileName => fileName.endsWith('.js'))
                .map(async fileName => {
                    const path = join(__dirname, '../commands', fileName);
                    const file: { command: Command } = await import(path);
                    this.commandHandler.registerCommand(file.command);
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

    public async start(): Promise<void> {
        await this.login(this._token);
        console.log(`[BOT] Connected`);
    }
}
