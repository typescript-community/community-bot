import {
	command,
	default as CookiecordClient,
	Module,
	optional,
	listener,
} from 'cookiecord';
import { GuildMember, Message, MessageEmbed, User } from 'discord.js';
import prettyMilliseconds from 'pretty-ms';
import { TS_BLUE } from '../env';

import { RepGive } from '../entities/RepGive';
import { RepUser } from '../entities/RepUser';
import { sendPaginatedMessage } from '../util/sendPaginatedMessage';
import { addMessageOwnership } from '../util/send';

export class RepModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	MAX_REP = 3;

	// The Chinese is outside the group on purpose, because CJK languages don't have word bounds. Therefore we only look for key characters
	THANKS_REGEX = /\b(?:thank|thanks|thx|cheers|thanx|thnks|ty|tysm|tks|tkx|danke|merci|gracias|grazie|xiexie)\b|谢/i;

	async getOrMakeUser(user: User) {
		let ru = await RepUser.findOne(
			{ id: user.id },
			{ relations: ['got', 'given'] },
		);

		if (!ru) {
			ru = await RepUser.create({ id: user.id }).save();
		}

		return ru;
	}

	@listener({ event: 'messageCreate' })
	async onThank(msg: Message) {
		const GIVE = '✅';
		const PARTIAL_GIVE = '🤔';
		const NO_GIVE = '❌';
		const LAUGH = '😆';

		// Check for thanks messages
		const isThanks = this.THANKS_REGEX.test(msg.content);

		if (msg.author.bot || !isThanks || !msg.guild) return;

		const allMentionUsers = msg.mentions.users;
		const mentionUsers = allMentionUsers.filter(
			user => user.id !== msg.member?.id,
		);
		if (mentionUsers.size < allMentionUsers.size) await msg.react(LAUGH);
		if (!mentionUsers.size) return;

		const senderRU = await this.getOrMakeUser(msg.author);
		// track how much rep the author has sent
		// 3 possible outcomes: NO_GIVE, PARTIAL_GIVE and GAVE
		let currentSent = await senderRU.sent();

		if (currentSent >= this.MAX_REP) return await msg.react(NO_GIVE);

		for (const user of mentionUsers.values()) {
			if (currentSent >= this.MAX_REP)
				return await msg.react(PARTIAL_GIVE);

			// give rep
			const targetRU = await this.getOrMakeUser(user);

			await RepGive.create({
				from: senderRU,
				to: targetRU,
			}).save();

			currentSent++;
		}

		await msg.react(GIVE);
	}

	@command({
		description:
			'Reputation: See how many reputation points you have left to send',
	})
	async remaining(msg: Message) {
		const USED = '✅';
		const UNUSED = '⬜';

		const ru = await this.getOrMakeUser(msg.author);
		const sent = await ru.sent();

		await msg.channel.send(
			`Rep used: ${
				USED.repeat(sent) + UNUSED.repeat(this.MAX_REP - sent)
			}`,
		);
	}

	@command({
		description: 'Reputation: Give a different user some reputation points',
	})
	async rep(msg: Message, targetMember: GuildMember) {
		if (targetMember.id === msg.member?.id)
			return msg.channel.send(`:x: you cannot send rep to yourself`);

		const senderRU = await this.getOrMakeUser(msg.author);
		const targetRU = await this.getOrMakeUser(targetMember.user);

		if ((await senderRU.sent()) >= this.MAX_REP)
			return await msg.channel.send(
				':warning: no rep remaining! come back later.',
			);

		await RepGive.create({
			from: senderRU,
			to: targetRU,
		}).save();

		await msg.channel.send(
			`:ok_hand: sent \`${targetMember.displayName}\` 1 rep (${
				(await senderRU.sent()) + 1
			}/${this.MAX_REP} sent)`,
		);
	}

	@command({
		aliases: ['history'],
		description: "Reputation: View a user's reputation history",
	})
	async getrep(msg: Message, @optional user?: User) {
		if (!user) user = msg.author;

		const targetRU = await this.getOrMakeUser(user);
		const records = (await targetRU.got)
			.concat(await targetRU.given)
			// Decreasing chronologically
			.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
			.map(rg => {
				if (rg.from.id == targetRU.id)
					return `:white_small_square: Gave 1 rep to <@${
						rg.to.id
					}> (${prettyMilliseconds(
						Date.now() - rg.createdAt.getTime(),
					)} ago)`;
				else
					return `:white_small_square: Got 1 rep from <@${
						rg.from.id
					}> (${prettyMilliseconds(
						Date.now() - rg.createdAt.getTime(),
					)} ago)`;
			});
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
		const message = await sendPaginatedMessage(embed, pages, msg, 300000);
		await addMessageOwnership(message, msg.author);
	}

	@command({
		aliases: ['leaderboard', 'lb'],
		description: 'Reputation: See who has the most reputation',
	})
	async leaderboard(msg: Message) {
		const topEmojis = [':first_place:', ':second_place:', ':third_place:'];
		const data = ((await RepGive.createQueryBuilder('give')
			.select(['give.to', 'COUNT(*)'])
			.groupBy('give.to')
			.orderBy('COUNT(*)', 'DESC')
			.limit(11)
			.getRawMany()) as { toId: string; count: string }[])
			.filter(x => x.toId !== this.client.user?.id)
			.slice(0, 10)
			.map(x => ({
				id: x.toId,
				count: parseInt(x.count, 10),
			}));
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setTitle('Top 10 Reputation')
			.setDescription(
				data
					.map(
						(x, index) =>
							`${
								topEmojis[index] || ':white_small_square:'
							} **<@${x.id}>** with **${x.count}** points.`,
					)
					.join('\n'),
			);
		await msg.channel.send({ embeds: [embed] });
	}
}
