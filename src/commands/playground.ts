import { Message, MessageEmbed } from 'discord.js';

import { Command } from '../utils/commandHandler';
import { toPlayground } from '../utils/playground';
import { shortenLink } from '../utils/short';

const codeBlockRegex = /```(t(ype)?s(script)?)/i;

export const command = new Command({
    aliases: ['playground', 'pg'],
    command: async (message: Message): Promise<Message> => {
        let code = message.content
            .replace(/[A-Z]/g, ' $&')
            .replace(codeBlockRegex, '');

        if (!code) return message.channel.send(`:x: Please provide some code to convert`);

        const url = await shortenLink(toPlayground(code));

        return message.channel.send(
            new MessageEmbed()
                .setTitle('Playground Code')
                .setURL(url)
                .setColor(`#3178C6`)
                .setAuthor(message.member!.user.tag, message.member!.user.avatarURL() || undefined),
        );
    },
    description: 'Converts ts code to a playground link',
});
