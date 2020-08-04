import { default as CookiecordClient, listener, Module } from 'cookiecord';
import { Message } from 'discord.js';

export default class PollModule extends Module {
    constructor(client: CookiecordClient) {
        super(client);
    }

    @listener({ event: 'message' })
    async onMessage(msg: Message) {
        if (msg.author.bot || !msg.content.toLowerCase().startsWith('poll:'))
            return;
        await msg.react('✅');
        await msg.react('❌');
        await msg.react('🤷');
    }
}
