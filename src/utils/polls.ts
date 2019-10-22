import { Message } from 'discord.js';

export const pollsMessage = async (message: Message) => {
    if (message.content.startsWith('poll:')) {
        message.react('👍');
        message.react('👎');
        message.react('🤷');
    }
};
