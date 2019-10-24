import { Message } from 'discord.js';
import PascalCase from 'pascal-case';

import { Command } from '../utils/commandHandler';

export const command = new Command({
    description: 'Converts user message to PascalCase',
    aliases: ['PascalCase', 'Pascalify', 'pascalify', 'Robinify', 'robinify'],
    command: async (message: Message): Promise<Message> =>
        message.channel.send(
            PascalCase(
                message.content
                    .split(' ')
                    .slice(1)
                    .join(' '),
            ),
        ),
});
