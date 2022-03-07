import {
	command,
	default as CookiecordClient,
	Module,
	optional,
	listener,
} from 'cookiecord';
import {
	GuildMember,
	Message,
	MessageEmbed,
	MessageReaction,
	User,
} from 'discord.js';
import { repEmoji, TS_BLUE } from '../env';

import { Rep } from '../entities/Rep';
import { sendPaginatedMessage } from '../util/sendPaginatedMessage';
import { getMessageOwner, sendWithMessageOwnership } from '../util/send';

// The Chinese is outside the group on purpose, because CJK languages don't have word bounds. Therefore we only look for key characters
const thanksRegex = /\b(?:thank|thanks|thx|cheers|thanx|thnks|ty|tysm|tks|tkx|danke|merci|gracias|grazie|xiexie)\b|谢/i;

const removedReactions = new Set();

export class RepModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'messageCreate' })
	async onThank(msg: Message, force = false) {
		// Check for thanks messages
		const isThanks = thanksRegex.test(msg.content);
		if (msg.author.bot || (!isThanks && !force) || !msg.guild) return;

		const mentionUsers = msg.mentions.users.filter(
			user =>
				user.id !== msg.member?.id && user.id !== this.client.user?.id,
		);
		if (mentionUsers.size !== 1) return;

		const recipient = mentionUsers.first()!;

		console.log('Creating a Rep with recipient', recipient);

		await Rep.create({
			messageId: msg.id,
			channel: msg.channelId,
			amount: 1,
			recipient: recipient.id,
			initialGiver: msg.author.id,
			date: new Date().toISOString(),
		}).save();

		await msg.react(repEmoji);
	}

	@listener({ event: 'messageReactionAdd' })
	async onRepReact(reaction: MessageReaction, user: User) {
		if (
			!reaction.message.guild ||
			user.id === this.client.user?.id ||
			(reaction.emoji.id ?? reaction.emoji.name) !== repEmoji
		)
			return;

		const msg = reaction.message;
		const author = (await msg.fetch()).author;

		console.log('Received rep reaction on', msg.id);

		if (user.id === author.id) {
			console.log('Reacter is message author; removing reaction');
			return removeReaction();
		}

		console.log('Querying database for existing Rep');

		let existingRep = await Rep.findOne({ messageId: msg.id });

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

		console.log('None found');

		let recipient = author.id;

		if (recipient == this.client.user!.id) {
			console.log('Recipient is bot; checking for message ownership');
			let altRecipient = getMessageOwner(msg);
			if (!altRecipient) {
				console.log('No message owner recorded; removing reaction');
				return removeReaction();
			}
			console.log('Message owner is', altRecipient);
			recipient = altRecipient;
		}

		console.log('Creating a Rep with recipient', recipient);

		await Rep.create({
			messageId: msg.id,
			channel: msg.channelId,
			amount: 1,
			recipient,
			initialGiver: author.id,
			date: new Date().toISOString(),
		}).save();

		async function removeReaction() {
			removedReactions.add([msg.id, user.id].toString());
			await reaction.users.remove(user.id);
		}
	}

	@listener({ event: 'messageReactionRemove' })
	async onRepReactRemove(reaction: MessageReaction, user: User) {
		if (
			!reaction.message.guild ||
			(reaction.emoji.id ?? reaction.emoji.name) !== repEmoji ||
			removedReactions.delete([reaction.message.id, user.id].toString())
		)
			return;

		let rep = await Rep.findOne({
			messageId: reaction.message.id,
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
	}

	@listener({ event: 'messageDelete' })
	async onRepMsgDelete(msg: Message) {
		await Rep.delete(msg.id);
	}

	@command({
		description: 'Reputation: Give a different user some reputation points',
	})
	async rep(msg: Message, targetMember: GuildMember) {
		this.onThank(msg, true);
	}

	@command({
		description: "Reputation: View a user's reputation history",
	})
	async history(msg: Message, @optional user?: User) {
		if (!msg.member) return;
		if (!user) user = msg.author;

		const records = (await Rep.find({ where: { recipient: user.id } }))
			.reverse()
			.filter(x => x.amount > 0)
			.map(rg => {
				const emoji = msg.guild!.emojis.resolve(repEmoji) ?? repEmoji;
				const messageLink = `https://discord.com/channels/${
					msg.guild!.id
				}/${rg.channel}/${rg.messageId}`;
				return `**${
					rg.amount
				} ${emoji}** on [message](${messageLink}) (<@${
					rg.initialGiver
				}>${rg.amount > 1 ? ' et al.' : ''}) at <t:${
					(+new Date(rg.date) / 1000) | 0
				}>`;
			});
		if (!records.length) records.push('[no reputation history]');
		const recordsPerPage = 30;
		const pages = records
			.reduce((acc, cur, index) => {
				const curChunk = Math.floor(index / recordsPerPage);
				acc[curChunk] ??= [];
				acc[curChunk].push(cur);
				return acc;
			}, [] as string[][])
			.map(page => page.join('\n'));
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setAuthor(user.tag, user.displayAvatarURL());
		await sendPaginatedMessage(
			embed,
			pages,
			msg.member,
			msg.channel,
			300000,
		);
	}

	@command({
		aliases: ['leaderboard', 'lb'],
		description: 'Reputation: See who has the most reputation',
	})
	async leaderboard(msg: Message, @optional period: string = 'month') {
		let periods = {
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
		if (!(period in periods))
			return await sendWithMessageOwnership(
				msg,
				`:x: Invalid period (expected one of ${Object.keys(periods)
					.map(x => `\`${x}\``)
					.join(', ')})`,
			);
		const [text, dateMin] = periods[period as keyof typeof periods];
		const topEmojis = [':first_place:', ':second_place:', ':third_place:'];
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
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setTitle(`Top 10 Reputation ${text}`)
			.setDescription(
				data
					.map(
						(x, index) =>
							`${
								topEmojis[index] || ':white_small_square:'
							} **<@${x.recipient}>** with **${x.sum}** points.`,
					)
					.join('\n'),
			);
		await msg.channel.send({ embeds: [embed] });
	}
}
