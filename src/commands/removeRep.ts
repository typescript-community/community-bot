import { GuildMember, Message } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { resolveMember } from '../utils/resolvers';

export const command = new Command({
    aliases: ['removerep'],
    description: 'Remove rep from someone',
    privelagesRequired: ['MANAGE_MESSAGES'],
    command: async (message: Message): Promise<void> => {
        if (!message.member!.hasPermission('MANAGE_MESSAGES')) {
            message.channel.send(`:x: Only moderators and above can use this command`);
            return;
        }

        const member: GuildMember | undefined = message.mentions.members!.first()! ?? await resolveMember(message);

        const amount = parseInt(message.content.split(' ')[2]);

        if (!member) {
            message.channel.send(`:x: You need to specify a member to remove rep from`);
            return;
        }

        if (!amount || isNaN(amount)) {
            message.channel.send(`:x: You need to specify an amount of rep to remove`);
            return;
        }

        const repository = database.getRepository(RepEntity);
        const found = await repository.findOne({ id: member.id });

        if (!found || found.rep <= 0) {
            message.channel.send(`:x: This user has **0** reputation!`);
            return;
        }

        found.rep -= amount;

        await repository.save(found);

        message.channel.send(`:white_check_mark: Removed **${amount}** from **${member.user.username}**'s balance. They now have **${found.rep}** reputation.`);
    },
});
