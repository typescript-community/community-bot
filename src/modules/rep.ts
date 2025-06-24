import { Message, EmbedBuilder } from 'discord.js';
import { repEmoji, TS_BLUE } from '../env';

import { Rep } from '../entities/Rep';
import { sendPaginatedMessage } from '../util/sendPaginatedMessage';
import { getMessageOwner, sendWithMessageOwnership } from '../util/send';
import { Bot } from '../bot';
import { LOCALIZATION } from '../index';

// The Chinese is outside the group on purpose, because CJK languages don't have word bounds. Therefore we only look for key characters

const thanksRegex =
	/* cspell:disable-next-line */
	/\b(?:thank|thanks|thx|cheers|thanx|thnks|ty|tysm|tks|tkx|danke|merci|gracias|grazie|xiexie)\b|谢/i;

const removedReactions = new Set();

export function repModule(bot: Bot) {
	const { client } = bot;

	function giveRep(
		msg: Pick<Message, 'id' | 'channelId'>,
		{ recipient, initialGiver }: Pick<Rep, 'recipient' | 'initialGiver'>,
	) {
		console.log(
			LOCALIZATION.getLocalizedText('creating_rep', { recipient }),
		);

		return Rep.create({
			messageId: msg.id,
			channel: msg.channelId,
			amount: 1,
			recipient,
			initialGiver,
			date: new Date().toISOString(),
		}).save();
	}

	async function onThank(msg: Message, force = false) {
		// Check for thanks messages
		const isThanks = thanksRegex.test(msg.content);
		if (msg.author.bot || (!isThanks && !force) || !msg.guild) return;

		const mentionUsers = msg.mentions.users.filter(
			user => user.id !== msg.member?.id && user.id !== client.user.id,
		);
		if (mentionUsers.size !== 1) return;

		const recipient = mentionUsers.first()!;

		await giveRep(msg, {
			recipient: recipient.id,
			initialGiver: msg.author.id,
		});

		await msg.react(repEmoji);
	}

	client.on('messageCreate', msg => onThank(msg));

	client.on('messageReactionAdd', async (reaction, user) => {
		if (
			!reaction.message.guild ||
			user.id === client.user.id ||
			(reaction.emoji.id ?? reaction.emoji.name) !== repEmoji
		) {
			return;
		}

		const msg = reaction.message;
		const author = (await msg.fetch()).author;

		console.log(
			LOCALIZATION.getLocalizedText('received_rep', { message: msg.id }),
		);

		if (user.id === author.id) {
			return removeReaction();
		}

		console.log(LOCALIZATION.getLocalizedText('querying_for_rep'));

		let existingRep = await Rep.findOne({ where: { messageId: msg.id } });

		if (existingRep) {
			console.log(
				LOCALIZATION.getLocalizedText('rep_exist_found', {
					rep: existingRep,
				}),
			);
			if (user.id === existingRep.recipient) {
				console.log(LOCALIZATION.getLocalizedText('user_is_recipient'));
				return removeReaction();
			}
			console.log(
				LOCALIZATION.getLocalizedText('existing_amount_is', {
					count: existingRep.amount,
				}),
			);
			existingRep.amount++;
			existingRep.save();
			console.log(
				LOCALIZATION.getLocalizedText('incremented_amount', {
					amount: existingRep.amount,
				}),
			);
			return;
		}

		let recipient = author.id;

		if (recipient == client.user.id) {
			console.log(LOCALIZATION.getLocalizedText('recipient_is_bot'));
			let altRecipient = getMessageOwner(msg);
			if (!altRecipient) {
				console.log(LOCALIZATION.getLocalizedText('no_message_owner'));
				return removeReaction();
			}
			console.log(
				LOCALIZATION.getLocalizedText('message_owner_is', {
					owner: altRecipient,
				}),
			);
			recipient = altRecipient;
		}

		await giveRep(msg, {
			recipient,
			initialGiver: user.id,
		});

		async function removeReaction() {
			removedReactions.add([msg.id, user.id].toString());
			await reaction.users.remove(user.id);
		}
	});

	client.on('messageReactionRemove', async (reaction, user) => {
		if (
			!reaction.message.guild ||
			(reaction.emoji.id ?? reaction.emoji.name) !== repEmoji ||
			removedReactions.delete([reaction.message.id, user.id].toString())
		)
			return;

		let rep = await Rep.findOne({
			where: {
				messageId: reaction.message.id,
			},
		});

		if (!rep) return;

		rep.amount -= 1;
		await rep.save();

		console.log(
			LOCALIZATION.getLocalizedText('decremented_rep', {
				amount: rep.amount,
				id: rep.messageId,
			}),
		);
	});

	client.on('messageDelete', async msg => {
		await Rep.delete(msg.id);
	});

	bot.registerCommand({
		aliases: ['rep'],
		description: LOCALIZATION.getLocalizedText(
			'reputation_command.description',
		),
		async listener(msg) {
			const targetMember = msg.content.split(/\s/)[1];

			if (targetMember.match(/\d+/)) {
				const user = await client.users
					.fetch(targetMember)
					.catch(() => null);

				if (user) {
					if (user.id === msg.author.id) {
						await msg.react('🤡');
						return;
					}
					await giveRep(msg, {
						recipient: targetMember,
						initialGiver: msg.author.id,
					});
					await msg.react(repEmoji);
					return;
				}
			}

			await onThank(msg, true);
		},
	});

	bot.registerCommand({
		aliases: ['history'],
		description: LOCALIZATION.getLocalizedText(
			'history_command.description',
		),
		async listener(msg) {
			if (!msg.member) return;
			let user = await bot.getTargetUser(msg);

			if (!user) {
				await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'history_command.listener.cannot_find',
					),
				);
				return;
			}

			const records = (await Rep.find({ where: { recipient: user.id } }))
				.reverse()
				.filter(x => x.amount > 0)
				.map(rg => {
					const emoji =
						msg.guild!.emojis.resolve(repEmoji) ?? repEmoji;
					const messageLink = `https://discord.com/channels/${
						msg.guild!.id
					}/${rg.channel}/${rg.messageId}`;
					return `**${
						rg.amount
					} ${emoji}** on [message](${messageLink}) (<@${
						rg.initialGiver
					}>${rg.amount > 1 ? ' et al.' : ''}) at <t:${Math.floor(
						+new Date(rg.date) / 1000,
					)}>`;
				});
			if (!records.length) records.push('[no reputation history]');
			const recordsPerPage = 10;
			const pages = records
				.reduce<string[][]>((acc, cur, index) => {
					const curChunk = Math.floor(index / recordsPerPage);
					acc[curChunk] ??= [];
					acc[curChunk].push(cur);
					return acc;
				}, [])
				.map(page => page.join('\n'));
			const embed = new EmbedBuilder().setColor(TS_BLUE).setAuthor({
				name: user.tag,
				iconURL: user.displayAvatarURL(),
			});
			await sendPaginatedMessage(
				embed,
				pages,
				msg.member,
				msg.channel,
				300000,
			);
		},
	});

	bot.registerCommand({
		aliases: ['leaderboard', 'lb'],
		description: LOCALIZATION.getLocalizedText(
			'leaderboard_command.description',
		),
		async listener(msg) {
			const periods = {
				'rolling-hour': ['(past hour)', Date.now() - 60 * 60 * 1000],
				'rolling-day': ['(past day)', Date.now() - 24 * 60 * 60 * 1000],
				'rolling-month': [
					'(past 30 days)',
					Date.now() - 30 * 24 * 60 * 60 * 1000,
				],
				'rolling-year': [
					'(past year)',
					Date.now() - 365 * 24 * 60 * 60 * 1000,
				],
				day: [
					'(today)',
					+new Date(
						new Date().getFullYear(),
						new Date().getMonth(),
						new Date().getDate(),
					),
				],
				month: [
					'(this month)',
					+new Date(new Date().getFullYear(), new Date().getMonth()),
				],
				year: ['(this year)', +new Date(new Date().getFullYear())],
				all: ['(all time)', 0],
			} as const;

			const period = msg.content.split(/\s/)[1] || 'rolling-month';

			if (!(period in periods))
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'leaderboard_command.listener.invalid_period',
						{
							of: `${Object.keys(periods)
								.map(x => `\`${x}\``)
								.join(', ')}`,
						},
					),
				);
			const [text, dateMin] = periods[period as keyof typeof periods];
			const topEmojis = [
				':first_place:',
				':second_place:',
				':third_place:',
			];
			const query = Rep.createQueryBuilder()
				.where(`date > '${new Date(dateMin).toISOString()}'`)
				.select(['recipient', 'SUM(amount)', 'MAX(date)'])
				.groupBy('recipient')
				.orderBy('SUM(amount)', 'DESC')
				.limit(10);
			const data = (await query.getRawMany()) as {
				recipient: string;
				sum: number;
			}[];
			const embed = new EmbedBuilder()
				.setColor(TS_BLUE)
				.setTitle(`Top 10 Reputation ${text}`)
				.setDescription(
					data
						.map(
							(x, index) =>
								`${
									topEmojis[index] || ':white_small_square:'
								} **<@${x.recipient}>** with **${
									x.sum
								}** points.`,
						)
						.join('\n'),
				);
			await msg.channel.send({ embeds: [embed] });
		},
	});
}
