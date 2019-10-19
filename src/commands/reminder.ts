import { Command } from '../utils/commandHandler';
import { Message } from 'discord.js';

import { ReminderEntity } from '../entities/Reminder';
import { database } from '../index';

import ms from 'ms';

export const command = new Command({
    aliases: ['reminder', 'remindme', 'remind'],
    description: 'Set a reminder',
    command: async (message: Message) => {
        const split = message.content.split(' ');
        const rawTime = split[1];
        const time = ms(rawTime);

        const reason = split.slice(2).join(' ');

        if (time == undefined || !time) {
            return message.channel.send(`:x: Please provide a valid time`);
        }

        if (time < 30000) {
            // 30 seconds
            return message.channel.send(`:x: The time must be >30s`);
        }

        const repository = database.getRepository(ReminderEntity);

        const reminder = await repository.insert({
            createdAt: Date.now(),
            member: message.member!.id,
            messageLink: `https://ptb.discordapp.com/channels/${message.guild!.id}/${message.channel.id}/${message.id}`,
            length: time,
            reason,
        });

        return message.channel.send(`:ballot_box_with_check: Reminder set! I will remind you in ~**${ms(time)}**`);
    },
});
