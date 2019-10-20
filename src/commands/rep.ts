import { GuildMember, Message } from 'discord.js';

import { RepEntity } from '../entities/Rep';
import { RepCooldownEntity } from '../entities/RepCooldown';
import { database } from '../index';
import { Command } from '../utils/commandHandler';
import { resolveMemberWithNameSpaces } from '../utils/resolvers';
import { addRepHistory } from '../utils/history';

const calcCooldown = async (member: GuildMember): Promise<number> => {
    const repository = database.getRepository(RepCooldownEntity);

    const found = await repository.findOne({ id: member.id });

    if (!found) {
        await repository.insert({
            id: member.id,
            left: 2,
            updated: Date.now(),
        });

        return 2;
    } else {
        const updatedDate = new Date(found.updated);
        const nowDate = new Date();

        if (updatedDate.getUTCDay() != nowDate.getUTCDay()) {
            found.left = 3;
        }

        if (found.left <= 0) {
            return -1;
        }

        found.left -= 1;
        found.updated = Date.now();

        await repository.save(found);

        return found.left;
    }
};

export const command = new Command({
    aliases: ['rep'],
    description: 'Give rep points to someone',
    command: async (message: Message): Promise<void> => {
        let member: GuildMember | undefined = message.mentions.members!.first()!;
        member = !member ? await resolveMemberWithNameSpaces(message) : member;

        if (!member) {
            message.channel.send(`:x: You must specify a member to give rep to!`);
            return;
        }

        if (member.id === message.member!.id) {
            message.channel.send(`:x: Nice try! You cannot send rep to yourself`);
            return;
        }

        if (member.user.bot) {
            message.channel.send(':x: You cannot give rep to bots!');
            return;
        }

        const cooldown = await calcCooldown(message.member!);

        if (cooldown === -1) {
            message.channel.send(`You have already used your **3** daily reps!`);
            return;
        }

        const repository = database.getRepository(RepEntity);
        const found = await repository.findOne({ id: member.id });

        if (!found)
            await repository.insert({
                id: member.id,
                rep: 1,
            });
        else {
            found.rep += 1;
            await repository.save(found);
        }

        message.channel.send(`:ballot_box_with_check: Successfully sent rep to **${member.user.username}** (**${cooldown}** remaining today)`);

        addRepHistory(message.member!, member, message);
    },
});
