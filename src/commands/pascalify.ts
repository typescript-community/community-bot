import { Message } from 'discord.js';

import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['PascalCase', 'Pascalify', 'pascalify', 'Robinify', 'robinify'],
    command: async (message: Message): Promise<Message> => {
        // Gets rid of command prefix
        const userMessage = message.content.replace(/^\s*\S+\s+/, '');

        const pascalifiedMessage =
            userMessage.charAt(0).toUpperCase() +
            userMessage
                .slice(1)
                .replace(/[A-Z_-]/g, ' $&')
                .toLowerCase()
                .replace(/\s(\w)/g, (_, p1: string) => p1.toUpperCase());

        return message.channel.send(pascalifiedMessage);
    },
    description: 'Converts user message to PascalCase',
});
