import { Message } from 'discord.js';

import { Command } from '../utils/commandHandler';

import PascalCase from 'pascal-case';

export const command = new Command({
    description: 'Converts user message to PascalCase',
    aliases: ['PascalCase', 'Pascalify', 'pascalify', 'Robinify'],
    command: async (message: Message): Promise<Message> => message.channel.send(PascalCase(message.content)),
});
