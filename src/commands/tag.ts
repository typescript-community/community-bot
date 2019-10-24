import { Message } from 'discord.js';

import { TagEntity } from '../entities/Tag';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

const create = async (message: Message): Promise<Message> => {
    const split = message.content.split(' ').slice(2);
    const name = split[0];
    const content = split.slice(1).join(' ');

    if (!name) return message.channel.send(`:x: Please provide a valid name`);
    if (!content) return message.channel.send(`:x: Please provide content`);

    const repository = database.getRepository(TagEntity);
    if ((await repository.findOne({ name })) != undefined) {
        return message.channel.send(`:x: A tag with the name **${name}** already exists`);
    }

    await repository.insert({
        name,
        content,
        author: message.member!.id,
    });

    return message.channel.send(`:ballot_box_with_check: Successfully created a tag with the name **${name}**`);
};

const edit = async (message: Message): Promise<Message> => {
    const split = message.content.split(' ').slice(2);
    const name = split[0];
    const content = split.slice(1).join(' ');

    if (!name) return message.channel.send(`:x: Please provide a name`);
    if (!content) return message.channel.send(`:x: Please provide content`);

    const repository = database.getRepository(TagEntity);
    const found = await repository.findOne({ name });
    if (found == undefined) {
        return message.channel.send(`:x: No tag with the name **${name}** exists`);
    }

    found.content = content;

    await repository.save(found);

    return message.channel.send(`:ballot_box_with_check: Successfully edited the tag **${name}**`);
};

const del = async (message: Message): Promise<Message> => {
    const split = message.content.split(' ').slice(2);
    const name = split[0];

    if (!name) return message.channel.send(`:x: Please provide a name`);

    const repository = database.getRepository(TagEntity);
    const found = await repository.findOne({ name });
    if (found == undefined) {
        return message.channel.send(`:x: No tag with the name **${name}** exists`);
    }

    await repository.delete(found);

    return message.channel.send(`:ballot_box_with_check: Successfully deleted the tag **${name}**`);
};

export const command = new Command({
    description: 'Manage tags (mods+ only)',
    aliases: ['tag', 'tags'],
    privelagesRequired: ['MANAGE_MESSAGES'],
    command: async (message: Message): Promise<void | Message> => {
        const action = message.content.split(' ')[1];

        if (!action || (action != 'create' && action != 'edit' && action != 'delete'))
            return message.channel.send(`:x: Please provide a valid action (create, edit, delete)`);

        if (action == 'create') await create(message);
        if (action == 'edit') await edit(message);
        if (action == 'delete') await del(message);
    },
});
