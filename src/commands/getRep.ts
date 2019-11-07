import { Message } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { resolveMemberWithNameSpaces } from '../utils/resolvers';

export const command = new Command({
    aliases: ['getRep'],
    command: async (message: Message): Promise<void> => {
        let member = message.mentions.members!.first() ? message.mentions.members!.first() : undefined;
        member = !member ? await resolveMemberWithNameSpaces(message) : member;
        member = !member ? message.member! : member;

        const repository = database.getRepository(RepEntity);
        const found = await repository.findOne({ id: member!.id });

        if (!found) message.channel.send(`:ballot_box_with_check: **${member!.user.username}** has **0** reputation`);
        else message.channel.send(`:ballot_box_with_check: **${member!.user.username}** has **${found.rep}** reputation`);
    },
    description: 'Get Rep Points',
});
