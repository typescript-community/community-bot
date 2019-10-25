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
            .join(' ')
            .replace(/[A-Z]/g, match => ` ${match}`);

        const pascalifiedMessage =
            userMessage.charAt(0).toUpperCase() +
            userMessage
                .slice(1)
                .toLowerCase()
                .replace(/[\t\s\n\r](\w)/g, (match, p1: string) => p1.toUpperCase());

        return message.channel.send(pascalifiedMessage);
    },
});
