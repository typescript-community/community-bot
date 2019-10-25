import { Message, MessageEmbed } from 'discord.js';

import { shortenLink } from '../utils/short';

const REGEX = /(https?:\/\/(www\.)?typescriptlang\.org\/play\/(index\.html)?\??(\?(([^&#\s]+)\&?)*)?#code\/[\w-+_]+)={0,4}/gi; // eslint-disable-line no-useless-escape

export const playgroundLinksMessage = async (message: Message): Promise<void> => {
    const content = message.content.trim();
    const matches: string[] = [];

    let m: RegExpExecArray | null;

    while ((m = REGEX.exec(content)) !== null) {
        if (m.index === REGEX.lastIndex) REGEX.lastIndex++;
        matches.push(...m);
    }

    if (matches.length == 0) return;

    const avatar = message.member!.user.avatarURL() == null ? undefined : message.member!.user.avatarURL()!;
    const url = await shortenLink(matches[0]);

    if (content.length == matches[0].length) {
        await message.channel.send(
            new MessageEmbed()
                .setAuthor(message.author!.tag, avatar)
                .setTitle(`Playground link shortened`)
                .setURL(url)
                .setColor('#3178C6')
                .setFooter('Message deleted automatically'),
        );

        await message.delete();
    } else {
        await message.channel.send(
            `<@${message.author!.id}> Please remove the playground link from your message`,
            new MessageEmbed()
                .setAuthor(message.author!.tag, avatar)
                .setTitle(`Playground link shortened`)
                .setURL(url)
                .setColor('#3178C6'),
        );
    }
};
