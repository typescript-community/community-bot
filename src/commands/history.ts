import { Command } from '../utils/commandHandler';
import { Message, MessageEmbed } from 'discord.js';

import { database } from '../index';
import { HistoryEntity } from '../entities/History';

import { resolveMemberWithNameSpaces } from '../utils/resolvers';
import { memberPartial } from '../utils/partials';

export const command = new Command({
    aliases: ['history', 'his'],
    description: 'Gets the reputation history',
    command: async (message: Message) => {
        let member = message.mentions.members!.first() ? message.mentions.members!.first() : undefined;
        member = !member ? await resolveMemberWithNameSpaces(message) : member;
        member = !member ? message.member! : member;

        const repository = database.getRepository(HistoryEntity);

        const found = await repository
            .createQueryBuilder('history')
            .where(`history.from = :id`, { id: member.id })
            .orWhere(`history.to = :id`, { id: member.id })
            .orderBy('date', 'DESC')
            .getMany();

        let content = found.length == 0 ? `${member.user.username} has no history` : '';

        found.forEach((history: HistoryEntity) => {
            if (history.from == member!.id) {
                content += `:white_small_square: **-1** rep to **${memberPartial(history.to)}**`;
            } else {
                content += `:white_small_square: **+1** rep from **${memberPartial(history.from)}**`;
            }

            content += ` [[Scroll]](${history.messageLink}) \n`;
        });

        const avatar = member.user.avatarURL() == null ? undefined : member.user.avatarURL()!;

        return message.channel.send(
            new MessageEmbed()
                .setAuthor(member.user.tag, avatar)
                .setColor(`#3178C6`)
                .setDescription(content),
        );
    },
});