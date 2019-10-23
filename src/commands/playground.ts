import { Message, MessageEmbed } from 'discord.js';

import { Command } from '../utils/commandHandler';
import { toPlayground } from '../utils/playground';

const REGEXES = [new RegExp('```ts'), new RegExp('```typescript'), new RegExp('```')];

export const command = new Command({
    description: 'Converts ts code to a playground link',
    aliases: ['playground', 'pg'],
    command: async (message: Message): Promise<Message> => {
        let code = message.content
            .split(' ')
            .slice(1)
            .join(' ');

        if (!code) return message.channel.send(`:x: Please provide some code to convert`);

        for (const regex of REGEXES) {
            code = code.replace(regex, '');
        }

        return message.channel.send(
            new MessageEmbed()
                .setTitle('Playground Code')
                .setURL(toPlayground(code))
                .setColor(`#3178C6`)
                .setAuthor(message.member!.user.tag, message.member!.user.avatarURL() == null ? undefined : message.member!.user.avatarURL()!),
        );
    },
});
