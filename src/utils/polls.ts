import { Message } from 'discord.js';

export const pollsMessage = (message: Message): void => {
    if (message.content.startsWith('poll:')) {
        message.react('👍');
        message.react('👎');
        message.react('🤷');
    }
};
