import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
} from 'cookiecord';
import {
	Message,
	MessageReaction,
	GuildMember,
	User,
	ReactionEmoji,
} from 'discord.js';
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

	@command({
		inhibitors: [CommonInhibitors.botAdminsOnly],
	})
	async kill(msg: Message) {
		const confirm = '✅';
		const confirmationMessage = await msg.channel.send('Confirm?');
		confirmationMessage.react(confirm);
		const reactionFilter = (reaction: MessageReaction, user: User) =>
			reaction.emoji.name === confirm && user.id === msg.author.id;
		const proceed = await confirmationMessage
			.awaitReactions(reactionFilter, {
				max: 1,
				time: 10 * 1000,
				errors: ['time'],
			})
			.then(() => true)
			.catch(() => false);
		await confirmationMessage.delete();
		if (!proceed) return;
		await msg.react('☠️'),
			console.log(`
                            ,--.
                           {    }
                           K,   }
                          /  ~Y\`
                     ,   /   /
                    {_'-K.__/
                      \`/-.__L._
                      /  ' /\`\\_}
                     /  ' /
             ____   /  ' /
      ,-'~~~~    ~~/  ' /_
    ,'             \`\`~~~  ',
   (                        Y
  {                         I
 {      -                    \`,
 |       ',                   )
 |        |   ,..__      __. Y
 |    .,_./  Y ' / ^Y   J   )|
 \           |' /   |   |   ||      Killed by @${msg.author.username}#${msg.author.discriminator}/${msg.author.id}
  \          L_/    . _ (_,.'(
   \,   ,      ^^""' / |      )
     \_  \          /,L]     /
       '-_~-,       \` \`   ./\`
          \`'{_            )
              ^^\..___,.--\`
		`);
		process.exit(1);
	}
}
