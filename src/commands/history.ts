import { Message, MessageEmbed, TextChannel } from 'discord.js';

import { HistoryEntity } from '../entities/History';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { Paginator } from '../utils/Paginator';
import { resolveMemberWithNameSpaces } from '../utils/resolvers';

function chunk<T>(arr: Array<T>, chunkSize: number): Array<Array<T>> {
    return arr.reduce(
        (
            prevVal: any, // eslint-disable-line
            currVal: any, // eslint-disable-line
            currIndx: number,
            array: Array<T>,
        ) => (!(currIndx % chunkSize) ? prevVal.concat([array.slice(currIndx, currIndx + chunkSize)]) : prevVal),
        [],
    );
}

export const command = new Command({
    aliases: ['history', 'his'],
    description: 'Gets the reputation history',
    command: async (message: Message): Promise<Message | void> => {
        let member = message.mentions.members!.first() ? message.mentions.members!.first() : undefined;
        member = !member ? await resolveMemberWithNameSpaces(message) : member; // eslint-disable-line require-atomic-updates
        member = !member ? message.member! : member; // eslint-disable-line require-atomic-updates

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
            let str: string;
            if (history.from == member!.id) {
                str = `:white_small_square: Gave 1 rep to **<@${history.to}>**`;
            } else {
                str = `:white_small_square: Got 1 rep from **<@${history.from}>**`;
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
});
