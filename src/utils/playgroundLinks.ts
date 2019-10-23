import { Message, MessageEmbed } from 'discord.js';

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

    if (content.length == matches[0].length) {
        await message.channel.send(
            new MessageEmbed()
                .setAuthor(message.author!.tag, avatar)
                .setTitle(`Playground link shortened`)
                .setURL(matches[0])
                .setColor('#3178C6')
                .setFooter('Message deleted automatically'),
        );

        await message.delete();
    } else {
        await message.channel.send(
            new MessageEmbed()
                .setAuthor(message.author!.tag, avatar)
                .setTitle(`Playground link shortened`)
                .setURL(matches[0])
                .setColor('#3178C6')
                .setFooter('Message not deleted - please edit your message'),
        );
    }
};
