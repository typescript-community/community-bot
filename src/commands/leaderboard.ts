import { Message, MessageEmbed } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['leaderboard', 'lb', 'top'],
    description: 'Get the leaderboard',
    command: async (message: Message): Promise<void> => {
        const repository = database.getRepository(RepEntity);
        const result = await repository
            .createQueryBuilder()
            .orderBy('rep', 'DESC')
            .getMany();

        const messageText = topTen.filter(({id, rep)) => message.guild.members.get(id)).map(
            ({ id, rep }, index) => `:white_medium_small_square: \`#${index + 1}\` ${message.guild!.members.get(id)!.user.tag} with **${rep}** reputation\n`,
        );

        message.channel.send(new MessageEmbed().setDescription(messageText).setTitle(`Reputation leaderboard`));
    },
});
