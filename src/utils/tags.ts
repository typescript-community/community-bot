import { Message } from 'discord.js';

import { TagEntity } from '../entities/Tag';
import { database } from '../index';
import { TAGS } from './constants';

export const tagsMessage = async (message: Message): Promise<void> => {
    if (!message.content.startsWith(TAGS.prefix)) return;

    const tag = message.content.split(' ')[0].replace(TAGS.prefix, '');
    const repository = database.getRepository(TagEntity);
    const found = await repository.findOne({ name: tag });

    if (!found) return;

    await message.channel.send(found.content);
};
