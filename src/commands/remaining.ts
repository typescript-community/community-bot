import { Message } from 'discord.js';

import { RepCooldownEntity } from '../entities/RepCooldown';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['remaining'],
    description: 'Gets the amount of reputation you have left to give today',
    command: async (message: Message): Promise<Message> => {
        const repository = database.getRepository(RepCooldownEntity);

        const found = await repository.findOne({ id: message.member!.id });

        if (!found) {
            return message.channel.send(`:ballot_box_with_check: You have **3** remaining rep to give today`);
        } else {
            const updatedDate = new Date(found.updated);
            const nowDate = new Date();

            if (updatedDate.getUTCDay() != nowDate.getUTCDay()) {
                return message.channel.send(`:ballot_box_with_check: You have **3** remaining rep to give today`);
            }

            return message.channel.send(`:ballot_box_with_check: You have **${found.left}** remaining rep to give today`);
        }
    },
});
