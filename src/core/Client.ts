import { Client } from 'discord.js';
import { readdirSync } from 'fs';
import { join } from 'path';

import { reactionAddEvent } from '../events/messageReactionAdd';
import { reactionRemoveEvent } from '../events/messageReactionRemove';
import { ReminderScheduler } from '../schedulers/ReminderScheduler';
import { Command, CommandHandler } from '../utils/commandHandler';
import { Filter, FilterHandler } from '../utils/filterHandler';
import { ModLogManager } from '../utils/modlogManager';
import { playgroundLinksMessage } from '../utils/playgroundLinks';
import { pollsMessage } from '../utils/polls';

export class PascalClient extends Client {
    commandHandler: CommandHandler = new CommandHandler(this, {
        prefix: 's!',
        logger: (...message): void => console.log('[BOT]', ...message),
        guildsAllowed: ['508357248330760243'],
    });
    filterHandler: FilterHandler = new FilterHandler(this, {
        logger: (...message): void => console.log('[BOT]', ...message),
    });

    public constructor(private readonly _token: string) {
        super({
            disabledEvents: ['TYPING_START'],
            disableEveryone: true,
            partials: ['MESSAGE', 'CHANNEL'],
        });

        this.loadHandlers();

        // Handle other events
        this.on('messageReactionAdd', reactionAddEvent);
        this.on('messageReactionRemove', reactionRemoveEvent);

        this.on('message', pollsMessage);
        this.on('message', playgroundLinksMessage);
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

        const registeredFilters = Promise.all(
            readdirSync(join(__dirname, '../filters'))
                .filter(fileName => fileName.endsWith('.js'))
                .map(async fileName => {
                    const path = join(__dirname, '../filters', fileName);
                    const file: { filter: Filter } = await import(path);
                    this.filterHandler.registerFilter(file.filter);
                }),
        );

        registeredFilters.catch(err => {
            console.error('[BOT] Was unable to load filters');
            console.error(err);
        });

        new ModLogManager(this);
    }
}
