import { Client, GuildMember, MessageEmbed, Message, TextChannel } from 'discord.js';
import { LOGGING } from '../utils/constants';
import { client } from '../index';

const memberLog = (member: GuildMember, leave: boolean = false) => {
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

const deleteLog = (message: Message) => {
    if (message.partial) return;

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

export const filterLog = (filterName: string, content: string, member: GuildMember) => {
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

export class ModLogManager {
    public constructor(private readonly client: Client) {
        this.client.on('guildMemberAdd', (member: GuildMember) => memberLog(member));
        this.client.on('guildMemberRemove', (member: GuildMember) => memberLog(member, true));

        this.client.on('messageDelete', deleteLog);
    }

    static send(embed: MessageEmbed) {
        const channel = client.channels.get(LOGGING.channel)! as TextChannel;

        channel.send(embed);
    }
}
