import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

import { reactionAddEvent } from '../events/messageReactionAdd';
import { reactionRemoveEvent } from '../events/messageReactionRemove';
import { ReminderScheduler } from '../schedulers/ReminderScheduler';
import { Command, CommandHandler } from '../utils/commandHandler';
import { ModLogManager } from '../utils/modlogManager';
import { playgroundLinksMessage } from '../utils/playgroundLinks';
import { pollsMessage } from '../utils/polls';
import { tagsMessage } from '../utils/tags';

export class PascalClient extends Client {
    commandHandler: CommandHandler = new CommandHandler(this, {
        guildsAllowed: ['508357248330760243'],
        logger: (...message): void => console.log('[BOT]', ...message),
        prefix: 't!',
    });

    public constructor(private readonly _token: string) {
        super({
            disableMentions: 'everyone',
            partials: ['MESSAGE', 'CHANNEL'],
        });

        this.loadHandlers();

        // Handle other events
        this.on('messageReactionAdd', reactionAddEvent);
        this.on('messageReactionRemove', reactionRemoveEvent);

        this.on('message', pollsMessage);
        this.on('message', playgroundLinksMessage);
        this.on('message', tagsMessage);
    }

    public async start(): Promise<void> {
        await this.login(this._token);
        console.log(`[BOT] Connected`);

        new ReminderScheduler();
    }

    private loadHandlers(): void {
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

        new ModLogManager(this);
    }
}
