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

const emojiRegex = /<:\w+?:(\d+?)>|(\p{Emoji_Presentation})/gu;

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
		let emojis = [
			...new Set(
				[...msg.content.matchAll(emojiRegex)].map(x => x[1] ?? x[2]),
			),
		];
		if (!emojis.length) emojis = ['✅', '❌', '🤷'];
		for (const emoji of emojis) await msg.react(emoji);
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
