import { Message } from 'discord.js';

import { words } from '../utils/data/swearing.json';
import { Filter } from '../utils/filterHandler';
import { filterLog } from '../utils/modlogManager';

export const filter = new Filter({
    name: 'swearing',
    handler: async (message: Message): Promise<undefined | Message> => {
        const content = message.content.toLowerCase().split(' ');

        const includes = words.some(word => content.includes(word));
        if (!includes) return;

        if (message.deletable) await message.delete();
        const m = await message.channel.send(`:x: <@${message.member!.id}>, Please mind your language.`);

        setTimeout(() => {
            m.delete();
        }, 5000);

        filterLog('swearing', message.content, message.member!);
    },
});
