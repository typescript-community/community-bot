import { Message, GuildMember } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { resolveMemberWithNameSpaces } from '../utils/resolvers';

export const command = new Command({
    aliases: ['getRep'],
    description: 'Get Rep Points',
    command: async (message: Message): Promise<void> => {
        let member: GuildMember | undefined = message.mentions.members!.first() ?? await resolveMemberWithNameSpaces(message);
        member = !member ? message.member! : member;

        const repository = database.getRepository(RepEntity);
        const found = await repository.findOne({ id: member!.id });

        if (!found) message.channel.send(`:ballot_box_with_check: **${member!.user.username}** has 0 reputation`);
        else message.channel.send(`:ballot_box_with_check: **${member!.user.username}** has **${found.rep}** reputation`);
    }
});
