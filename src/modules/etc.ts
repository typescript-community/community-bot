import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
} from 'cookiecord';
import { ThreadAutoArchiveDuration } from 'discord-api-types';
import {
	Message,
	MessageReaction,
	GuildMember,
	User,
	ReactionEmoji,
	TextChannel,
	ThreadChannel,
} from 'discord.js';
import { MessageChannel, threadId } from 'worker_threads';
import { suggestionsChannelId } from '../env';
import {
	clearMessageOwnership,
	DELETE_EMOJI,
	ownsBotMessage,
} from '../util/send';

const emojiRegex = /<:\w+?:(\d+?)>|(\p{Emoji_Presentation})/gu;

const defaultPollEmojis = ['✅', '❌', '🤷'];

export class EtcModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({ description: 'See if the bot is alive' })
	async ping(msg: Message) {
		await msg.channel.send('pong. :ping_pong:');
	}

	@listener({ event: 'messageCreate' })
	async onPoll(msg: Message) {
		if (msg.author.bot || !msg.content.toLowerCase().startsWith('poll:'))
			return;
		let emojis = [
			...new Set(
				[...msg.content.matchAll(emojiRegex)].map(x => x[1] ?? x[2]),
			),
		];
		if (!emojis.length) emojis = defaultPollEmojis;
		for (const emoji of emojis) await msg.react(emoji);
	}

	@listener({ event: 'messageCreate' })
	async onSuggestion(msg: Message) {
		if (msg.author.bot || msg.channelId !== suggestionsChannelId) return;
		// First 50 characters of the first line of the content (without cutting off a word)
		const title =
			msg.content
				.split('\n')[0]
				.split(/(^.{0,50}\b)/)
				.find(x => x) ?? 'Suggestion';
		await msg.startThread({
			name: title,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
		});
		for (let emoji of defaultPollEmojis) await msg.react(emoji);
	}

	@listener({ event: 'threadUpdate' })
	async onSuggestionClose(thread: ThreadChannel) {
		if (
			thread.parentId !== suggestionsChannelId ||
			!((await thread.fetch()) as ThreadChannel).archived
		)
			return;
		const channel = thread.parent!;
		let lastMessage = null;
		let suggestion: Message;
		while (!suggestion!) {
			const msgs = await channel.messages.fetch({
				before: lastMessage ?? undefined,
				limit: 5,
			});
			suggestion = msgs.find(msg => msg.thread?.id === thread.id)!;
			lastMessage = msgs.last()!.id as string;
		}
		const pollingResults = defaultPollEmojis.map(emoji => {
			const reactions = suggestion.reactions.resolve(emoji);
			// Subtract the bot's vote
			const count = (reactions?.count ?? 0) - 1;
			return [emoji, count] as const;
		});
		const pollingResultStr = pollingResults
			.sort((a, b) => b[1] - a[1])
			.map(([emoji, count], i) => `${count}  ${emoji}`)
			.join('   ');
		await suggestion.reply({
			content: `Polling finished; result:  ${pollingResultStr}`,
		});
	}

	@listener({ event: 'messageReactionAdd' })
	async onReact(reaction: MessageReaction, member: GuildMember) {
		if (reaction.partial) return;

		if ((await reaction.message.fetch()).author.id !== this.client.user?.id)
			return;
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
			.awaitReactions({
				filter: reactionFilter,
				max: 1,
				time: 10 * 1000,
				errors: ['time'],
			})
			.then(() => true)
			.catch(() => false);
		await confirmationMessage.delete();
		if (!proceed) return;
		await msg.react('☠️');
		process.stdout.write(`
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
