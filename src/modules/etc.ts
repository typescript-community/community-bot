import {
	ThreadAutoArchiveDuration,
	Message,
	ThreadChannel,
	SectionBuilder,
	ButtonBuilder,
	ButtonStyle,
	ButtonInteraction,
	ComponentType,
	MessageFlags,
	TextChannel,
} from 'discord.js';
import { Bot } from '../bot';
import { suggestionsChannelId } from '../env';

const defaultPollEmojis = ['✅', '❌', '🤷'];

export function etcModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['ping'],
		description: 'See if the bot is alive',
		async listener(interaction) {
			await interaction.reply('pong. :ping_pong:');
		},
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
		const channel = thread.parent as TextChannel;
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
			content: `Polling finished; result: ${pollingResultStr}`,
		});
	});

	bot.registerAdminCommand({
		aliases: ['kill'],
		description: 'Kill the bot',
		async listener(interaction) {
			const confirm = '✅';
			const confirmationMessage = await interaction.reply({
				components: [
					new SectionBuilder()
						.addTextDisplayComponents(text =>
							text.setContent('Confirm?'),
						)
						.setButtonAccessory(
							new ButtonBuilder()
								.setCustomId('confirm')
								.setEmoji(confirm)
								.setStyle(ButtonStyle.Danger),
						),
				],
				flags: MessageFlags.Ephemeral,
			});
			const buttonFilter = (int: ButtonInteraction) =>
				int.customId === 'confirm' &&
				int.user.id === interaction.user.id;
			const proceed = await confirmationMessage
				.awaitMessageComponent({
					filter: buttonFilter,
					time: 10 * 1000,
					componentType: ComponentType.Button,
				})
				.then(() => true)
				.catch(() => false);
			if (!proceed) {
				await interaction.deleteReply();
				return;
			}
			await interaction.editReply('☠️');
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
 \           |' /   |   |   ||      Killed by @${interaction.user.tag}/${interaction.user.id}
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
