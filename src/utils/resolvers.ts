import { GuildMember, Message } from 'discord.js';

export const resolveMemberWithNameSpaces = async (message: Message): Promise<GuildMember | undefined> => {
    let member: GuildMember | undefined;
    const args = message.content.split(' ');
    args.shift();
    if (args.length >= 1) {
        const guild = await message.guild!.fetch();
        if (!isNaN(Number(args[0]))) {
            member = guild.members.get(args[0]);
            member = !member ? guild.members.find(m => m.displayName.toLowerCase() === args.join(' ').toLowerCase()) : member;
        } else {
            member = guild.members.find(m => m.displayName.toLowerCase() === args.join(' ').toLowerCase());
        }
    } else {
        member = undefined;
    }
    return member;
};

export const resolveMemberWithoutNameSpaces = async (message: Message): Promise<GuildMember | undefined> => {
    let member: GuildMember | undefined;
    const args = message.content.split(' ');
    args.shift();
    if (args.length >= 1) {
        const guild = await message.guild!.fetch();
        if (!isNaN(Number(args[0]))) {
            member = guild.members.get(args[0]);
            member = !member ? guild.members.find(m => m.displayName.toLowerCase() === args[0].toLowerCase()) : member;
        } else {
            member = guild.members.find(m => m.displayName.toLowerCase() === args[0].toLowerCase());
        }
    }
    return member;
};
