import { Client, GuildMember, Message, MessageEmbed, TextChannel, PartialGuildMember, PartialMessage } from 'discord.js';

import { client } from '../index';
import { LOGGING } from '../utils/constants';

export class ModLogManager {
    public constructor(private readonly client: Client) {
        this.client.on('guildMemberAdd', (member: GuildMember | PartialGuildMember) => memberLog(member)); // eslint-disable-line
        this.client.on('guildMemberRemove', (member: GuildMember | PartialGuildMember) => memberLog(member, true)); // eslint-disable-line

        this.client.on('messageDelete', deleteLog); // eslint-disable-line
    }

    static send(embed: MessageEmbed): void {
        const channel = client.channels.cache.get(LOGGING.channel)! as TextChannel;

        channel.send(embed);
    }
}

const memberLog = async (partialMember: GuildMember | PartialGuildMember, leave = false) => {
    if (partialMember.partial) await partialMember.fetch();
    const member = partialMember as GuildMember;

    const avatar = member.user.avatarURL() == null ? undefined : member.user.avatarURL()!;

    if (leave) {
        return ModLogManager.send(
            new MessageEmbed()
                .setTitle('Member left')
                .setAuthor(member.user.tag, avatar)
                .setTimestamp()
                .setColor(LOGGING.colors.medium)
                .setFooter(member.id),
        );
    }

    ModLogManager.send(
        new MessageEmbed()
            .setTitle('Member joined')
            .setAuthor(member.user.tag, avatar)
            .setTimestamp()
            .setColor(LOGGING.colors.good)
            .setFooter(member.id),
    );
};

const deleteLog = (message: Message | PartialMessage): void => {
    if (message.partial) return;
    if (message.author!.bot) return;

    const avatar = message.member!.user.avatarURL() == null ? undefined : message.member!.user.avatarURL()!;

    ModLogManager.send(
        new MessageEmbed()
            .setTitle('Message deleted')
            .setAuthor(message.author!.tag, avatar)
            .setTimestamp()
            .setColor(LOGGING.colors.medium)
            .addField('Content', message.content),
    );
};

export const filterLog = (filterName: string, content: string, member: GuildMember): void => {
    const avatar = member!.user.avatarURL() == null ? undefined : member!.user.avatarURL()!;

    ModLogManager.send(
        new MessageEmbed()
            .setTitle('Filter flagged message')
            .setAuthor(member.user!.tag, avatar)
            .setTimestamp()
            .setColor(LOGGING.colors.medium)
            .addField('Content', content)
            .addField('Filter', filterName),
    );
};
