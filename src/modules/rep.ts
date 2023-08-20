import { Message } from 'discord.js';
import { repEmoji } from '../env';

import { Rep } from '../entities/Rep';
import { sendPaginatedMessage } from '../util/sendPaginatedMessage';
import { getMessageOwner, sendWithMessageOwnership } from '../util/send';
import { Bot } from '../bot';
import { MessageBuilder } from '../util/messageBuilder';

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
		console.log('Creating a Rep with recipient', recipient);

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

		console.log('Received rep reaction on', msg.id);

		if (user.id === author.id) {
			return removeReaction();
		}

		console.log('Querying database for existing Rep');

		let existingRep = await Rep.findOne({ where: { messageId: msg.id } });

		if (existingRep) {
			console.log('Found existing Rep', existingRep);
			if (user.id === existingRep.recipient) {
				console.log('User is recipient; removing reaction');
				return removeReaction();
			}
			console.log('Existing amount is', existingRep.amount);
			existingRep.amount++;
			existingRep.save();
			console.log('Incremented amount to', existingRep.amount);
			return;
		}

		let recipient = author.id;

		if (recipient == client.user.id) {
			console.log('Recipient is bot; checking for message ownership');
			let altRecipient = getMessageOwner(msg);
			if (!altRecipient) {
				console.log('No message owner recorded; removing reaction');
				return removeReaction();
			}
			console.log('Message owner is', altRecipient);
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
			'Decremented rep amount to',
			rep.amount,
			'for message',
			rep.messageId,
		);
	});

	client.on('messageDelete', async msg => {
		await Rep.delete(msg.id);
	});

	bot.registerCommand({
		aliases: ['rep'],
		description: 'Reputation: Give a different user some reputation points',
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
		description: "Reputation: View a user's reputation history",
		async listener(msg) {
			if (!msg.member) return;
			let user = await bot.getTargetUser(msg);

			if (!user) {
				await sendWithMessageOwnership(
					msg,
					'User has no reputation history.',
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
			const builder = new MessageBuilder().setAuthor(user.tag);
			await sendPaginatedMessage(
				builder,
				pages,
				msg.member,
				msg.channel,
				300000,
			);
		},
	});

	bot.registerCommand({
		aliases: ['leaderboard', 'lb'],
		description: 'Reputation: See who has the most reputation',
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
					`:x: Invalid period (expected one of ${Object.keys(periods)
						.map(x => `\`${x}\``)
						.join(', ')})`,
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
			const builder = new MessageBuilder()
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
			await msg.channel.send(builder.build());
		},
	});
}
