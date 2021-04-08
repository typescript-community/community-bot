import {
	command,
	default as CookiecordClient,
	Module,
	listener,
} from 'cookiecord';
import { Message, MessageReaction, GuildMember } from 'discord.js';
import {
	clearMessageOwnership,
	DELETE_EMOJI,
	ownsBotMessage,
} from '../util/send';

export class EtcModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({ description: 'See if the bot is alive' })
	async ping(msg: Message) {
		await msg.channel.send('pong. :ping_pong:');
	}

	@listener({ event: 'message' })
	async onMessage(msg: Message) {
		if (msg.author.bot || !msg.content.toLowerCase().startsWith('poll:'))
			return;
		await msg.react('✅');
		await msg.react('❌');
		await msg.react('🤷');
	}

	@listener({ event: 'messageReactionAdd' })
	async onReact(reaction: MessageReaction, member: GuildMember) {
		if (reaction.partial) return;

		if (reaction.message.author.id !== this.client.user?.id) return;
		if (reaction.emoji.name !== DELETE_EMOJI) return;
		if (member.id === this.client.user?.id) return;

		if (ownsBotMessage(reaction.message, member.id)) {
			clearMessageOwnership(reaction.message);
			await reaction.message.delete();
		} else {
			await reaction.users.remove(member.id);
		}
	}
}
