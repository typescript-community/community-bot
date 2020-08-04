import { Message, MessageEmbed } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['leaderboard', 'lb', 'top'],
    command: async (message: Message): Promise<void> => {
        const repository = database.getRepository(RepEntity);
        const result = await repository
            .createQueryBuilder()
            .orderBy('rep', 'DESC')
            .limit(11)
            .getMany();

        const messageText = result
            .filter(({ id }: RepEntity) => message.guild!.members.cache.get(id))
            .map(({ id, rep }: RepEntity, index) => `:white_small_square: \`#${index + 1}\` <@${id}> with **${rep}** reputation`);

        message.channel.send(
            new MessageEmbed()
                .setDescription(messageText)
                .setTitle(`Reputation Leaderboard`)
                .setColor(`#3178C6`),
        );
    },
    description: 'Get the leaderboard',
});
