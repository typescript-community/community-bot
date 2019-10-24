import { Message } from 'discord.js';

import { Command } from '../utils/commandHandler';

export const command = new Command({
    description: 'Converts user message to PascalCase',
    aliases: ['PascalCase', 'Pascalify', 'pascalify', 'Robinify', 'robinify'],
    command: async (message: Message): Promise<Message> => {
        // Gets rid of command prefix
        const userMessage = message.content
            .split(' ')
            .slice(1)
            .join(' ');

        const pascalifiedMessage =
            userMessage.charAt(0).toUpperCase() +
            userMessage
                .slice(1)
                .toLowerCase()
                .replace(/ (.)/g, (match: string, p1: string): string => p1.toUpperCase());

        return message.channel.send(pascalifiedMessage);
    },
});
