import { GuildMember, Message } from 'discord.js';

import { HistoryEntity } from '../entities/History';
import { database } from '../index';

export const addRepHistory = async (from: GuildMember, to: GuildMember, message: Message): Promise<void> => {
    const repository = database.getRepository(HistoryEntity);

    await repository.insert({
        date: Date.now(),
        from: from.id,
        messageLink: `https://ptb.discordapp.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`,
        to: to.id,
    });
};
