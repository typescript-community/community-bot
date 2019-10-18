import { Message } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';

export const getRepCommand = async (message: Message): Promise<void> => {
    const member = message.mentions.members!.first() ? message.mentions.members!.first() : message.member;
    const repository = database.getRepository(RepEntity);
    const found = await repository.findOne({ id: member!.id });

    if (!found) message.channel.send(`:white_check_mark: ${member!.user.username} has 0 reputation`);
    else message.channel.send(`:white_check_mark: ${member!.user.username} has ${found.rep} reputation`);
};
