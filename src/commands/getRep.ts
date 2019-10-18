import { Message } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['getRep'],
    description: 'Get Rep Points',
    command: async (message: Message): Promise<void> => {
        let member = message.mentions.members!.first() ? message.mentions.members!.first() : undefined;
        if (!member) {
            const args = message.content.split(' ');
            args.shift();
            if (args.length >= 1) {
                const guild = await message.guild!.fetch();
                if (!isNaN(Number(args[0]))) {
                    member = guild.members.get(args[0]);
                    member = !member ? guild.members.find(m => m.displayName.toLowerCase() === args.join(' ').toLowerCase()) : member;
                    member = !member ? message.member! : member;
                } else {
                    member = guild.members.find(m => m.displayName.toLowerCase() === args.join(' ').toLowerCase());
                    member = !member ? message.member! : member;
                }
            } else {
                member = message.member!;
            }
        }
        const repository = database.getRepository(RepEntity);
        const found = await repository.findOne({ id: member!.id });

        if (!found) message.channel.send(`:white_check_mark: ${member!.user.username} has 0 reputation`);
        else message.channel.send(`:white_check_mark: ${member!.user.username} has ${found.rep} reputation`);
    },
});
