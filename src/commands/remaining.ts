import { Message } from 'discord.js';

import { RepCooldownEntity } from '../entities/RepCooldown';
import { database } from '../index';
import { Command } from '../utils/commandHandler';

export const command = new Command({
    aliases: ['remaining'],
    command: async (message: Message): Promise<Message> => {
        const repository = database.getRepository(RepCooldownEntity);

        const found = await repository.findOne({ id: message.member!.id });
        
        let left = 3;

        if(found) {
            const updatedDate = new Date(found.updated);
            const nowDate = new Date();

            if (updatedDate.getUTCDay() === nowDate.getUTCDay()) left = found.left;
        }
        return `:ballot_box_with_check: You have **${left}** remaining rep to give today`
    },
    description: 'Gets the amount of reputation you have left to give today',
});
