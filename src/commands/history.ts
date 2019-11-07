import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { HistoryEntity } from '../entities/History';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { Paginator } from '../utils/Paginator';
import { resolveMemberWithNameSpaces } from '../utils/resolvers';

/**
 * @param Items An array to be split off into chunks.
 * @param Chunk The maximum size of a chunk.
 * @returns A new array of chunks. Each chunk is a subarray of `items` and has the length of `chunk` or less.
 */
export const chunk = <T>(Items: T[], Chunk: number): ReadonlyArray<ReadonlyArray<T>> =>
    new Array(Math.ceil(Items.length / Chunk)).fill(0).map(() => Items.splice(0, Chunk));

export const command = new Command({
    aliases: ['history', 'his'],
    command: async (message: Message): Promise<Message | void> => {
        let member = message.mentions.members!.first()
                  || await resolveMemberWithNameSpaces(message)
                  || message.members
                  || undefined;

        const repository = database.getRepository(HistoryEntity);

        const found = await repository
            .createQueryBuilder('history')
            .where(`history.from = :id`, { id: member.id })
            .orWhere(`history.to = :id`, { id: member.id })
            .orderBy('date', 'DESC')
            .getMany();

        const content = found.length == 0 ? `${member.user.username} has no history` : '';

        const arr: string[] = [];

        found.forEach((history: HistoryEntity) => {
            let str = ":white_small_square: ";
            if (history.from == member!.id) {
                str += `Gave 1 rep to **<@${history.to}>**`;
            } else {
                str += `Got 1 rep from **<@${history.from}>**`;
            }

            const date = new Date(history.date);

            str += ` [[Scroll]](${history.messageLink}) \`(${date.getUTCDate()}/${date.getMonth()}/${date
                .getFullYear()
                .toString()
                .replace('20', '')} - ${date.getHours()}:${date.getMinutes()})\``;

            arr.push(str);
        });

        const avatar = member.user.avatarURL() == null ? undefined : member.user.avatarURL()!;

        const embed = new MessageEmbed()
            .setAuthor(member.user.tag, avatar)
            .setColor(`#3178C6`)
            .setDescription(content);

        const chunked = arr.length == 0 ? [`<@${member.id}> has no history`] : chunk<string>(arr, 10).map(arr => arr.join('\n'));

        new Paginator(embed, chunked, message.member!, message.channel as TextChannel);
    },
    description: 'Gets the reputation history',
});
