import { Message, MessageEmbed } from 'discord.js';

import { database } from '../index';
import { RepEntity } from '../entities/Rep';

import { Command } from '../utils/commandHandler';

export const command = new Command({
  aliases: ['leaderboard', 'rank'],
  description: 'Get the leaderboard',
  command: async (message: Message) => {
    const repository = database.getRepository(RepEntity);
  
    let res = await repository
      .createQueryBuilder()
      .orderBy('rep', 'DESC')
      .getMany();
  
    res = res.slice(0, 10);
  
    let out = ``;
  
    for (let i = 0; i < res.length; i++) {
      out += `:white_medium_small_square: \`#${i + 1}\` ${
        message.guild.members.get(res[i].id).user.tag
      } with **${res[i].rep}** reputation\n`;
    }
  
    return message.channel.send(
      new MessageEmbed().setDescription(out).setTitle(`Reputation leaderboard`),
    );
  }
})
