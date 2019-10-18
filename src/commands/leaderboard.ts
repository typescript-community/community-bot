import { Message, MessageEmbed } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';

export const leaderboardCommand = async (message: Message): Promise<void> => {
    const repository = database.getRepository(RepEntity);
    const result = await repository
        .createQueryBuilder()
        .orderBy('rep', 'DESC')
        .getMany();

    const topTen = result.slice(0, 10);
    const messageText = topTen.map(
        ({ id, rep }, index) => `:white_medium_small_square: \`#${index + 1}\` ${message.guild!.members.get(id)!.user.tag} with **${rep}** reputation\n`,
    );

    message.channel.send(new MessageEmbed().setDescription(messageText).setTitle(`Reputation leaderboard`));
};
