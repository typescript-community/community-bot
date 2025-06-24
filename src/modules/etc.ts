import {
	ThreadAutoArchiveDuration,
	Message,
	MessageReaction,
	User,
	ThreadChannel,
} from 'discord.js';
import { Bot } from '../bot';
import { suggestionsChannelId } from '../env';
import {
	clearMessageOwnership,
	DELETE_EMOJI,
	ownsBotMessage,
} from '../util/send';
import { LOCALIZATION } from '../index';

const emojiRegex = /<:\w+?:(\d+?)>|(\p{Emoji_Presentation})/gu;

const defaultPollEmojis = ['✅', '❌', '🤷'];

export function etcModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['ping'],
		description: LOCALIZATION.getLocalizedText('command_ping.description'),
		async listener(msg) {
			await msg.channel.send(
				LOCALIZATION.getLocalizedText('command_ping.listener_message'),
			);
		},
	});

	bot.client.on('messageCreate', async msg => {
		if (msg.author.bot || !msg.content.toLowerCase().startsWith('poll:'))
			return;
		let emojis = [
			...new Set(
				[...msg.content.matchAll(emojiRegex)].map(x => x[1] ?? x[2]),
			),
		];
		if (!emojis.length) emojis = defaultPollEmojis;
		for (const emoji of emojis) await msg.react(emoji);
	});

	bot.client.on('messageCreate', async msg => {
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
	});

	bot.client.on('threadUpdate', async thread => {
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
			.map(([emoji, count]) => `${count}  ${emoji}`)
			.join('   ');
		await suggestion.reply({
			content: LOCALIZATION.getLocalizedText('polling_finished', {
				pollingResultStr,
			}),
		});
	});

	bot.client.on('messageReactionAdd', async (reaction, member) => {
		if (reaction.partial) return;

		if ((await reaction.message.fetch()).author.id !== bot.client.user.id)
			return;
		if (reaction.emoji.name !== DELETE_EMOJI) return;
		if (member.id === bot.client.user.id) return;

		if (ownsBotMessage(reaction.message, member.id)) {
			clearMessageOwnership(reaction.message);
			await reaction.message.delete();
		} else {
			await reaction.users.remove(member.id);
		}
	});

	bot.registerAdminCommand({
		aliases: ['kill'],
		async listener(msg) {
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
 \           |' /   |   |   ||      Killed by @${msg.author.tag}/${msg.author.id}
  \          L_/    . _ (_,.'(
   \,   ,      ^^""' / |      )
     \_  \          /,L]     /
       '-_~-,       \` \`   ./\`
          \`'{_            )
              ^^\..___,.--\`
		`);
			process.exit(1);
		},
	});
}
