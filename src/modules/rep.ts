import {
	command,
	default as CookiecordClient,
	Module,
	optional,
	listener,
} from 'cookiecord';
import { GuildMember, Message, MessageEmbed, User } from 'discord.js';
import prettyMilliseconds from 'pretty-ms';
import {
	BaseEntity,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryColumn,
	PrimaryGeneratedColumn,
} from 'typeorm';
import { getDB } from '../db';
import { TS_BLUE } from '../env';
const DAY_MS = 86400000;

export default class RepModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}
	MAX_REP = 3;

	async getOrMakeUser(user: User) {
		const db = await getDB();
		let ru = await db.manager.findOne(RepUser, user.id, {
			relations: ['got', 'given'],
		});
		if (!ru) {
			ru = await RepUser.create({ id: user.id }).save();
		}
		return ru;
	}

	@listener({ event: 'message' })
	async onThank(msg: Message) {
		const GAVE = '✅';
		// parsing
		const THANKS_REGEX = /thanks?,?\s*<@!?(\d+)>/gi;
		const exec = THANKS_REGEX.exec(msg.content);
		if (msg.author.bot || !exec || !exec[1] || !msg.guild) return;
		const member = await msg.guild.members.fetch(exec[1]);
		if (!member || member === msg.member) return;
		// give rep
		const senderRU = await this.getOrMakeUser(msg.author);
		const targetRU = await this.getOrMakeUser(member.user);

		if ((await senderRU.sent()) >= this.MAX_REP) return;

		await RepGive.create({
			from: senderRU,
			to: targetRU,
		}).save();

		await msg.react(GAVE);
	}

	@command()
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

	@command()
	async rep(msg: Message, targetMember: GuildMember) {
		if (targetMember === msg.member) return;
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

	@command({ aliases: ['history'] })
	async getrep(msg: Message, @optional user?: User) {
		if (!user) user = msg.author;
		const targetRU = await this.getOrMakeUser(user);
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setAuthor(user.tag, user.displayAvatarURL())
			.setDescription(
				(
					await Promise.all(
						(await targetRU.got)
							.concat(await targetRU.given)
							.map(async rg => {
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
							}),
					)
				).join('\n'),
			);
		await msg.channel.send(embed);
	}

	@command({ aliases: ['lb'] })
	async leaderboard(msg: Message) {
		const data = ((await RepGive.createQueryBuilder('give')
			.select(['give.to', 'COUNT(*)'])
			.groupBy('give.to')
			.orderBy('COUNT(*)', 'DESC')
			.limit(10)
			.getRawMany()) as { toId: string; count: string }[]).map(x => ({
			id: x.toId,
			count: parseInt(x.count, 10),
		}));
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setTitle('Top 10 Reputation')
			.setDescription(
				data
					.map(
						x =>
							`:white_small_square: **<@${x.id}>** with **${x.count}** points.`,
					)
					.join('\n'),
			);
		await msg.channel.send(embed);
	}
}

@Entity()
export class RepUser extends BaseEntity {
	@PrimaryColumn()
	id!: string;

	@OneToMany(type => RepGive, rg => rg.from, { nullable: false })
	got!: Promise<RepGive[]>;

	@OneToMany(type => RepGive, rg => rg.to, { nullable: false })
	given!: Promise<RepGive[]>;

	async sent() {
		return (await this.got).filter(
			x => Date.now() - x.createdAt.getTime() < DAY_MS,
		).length;
	}
}

@Entity()
export class RepGive extends BaseEntity {
	@PrimaryGeneratedColumn()
	id!: number;

	@ManyToOne(type => RepUser, ru => ru.given, {
		nullable: false,
		eager: true,
	})
	from!: RepUser;

	@ManyToOne(type => RepUser, ru => ru.got, { nullable: false, eager: true })
	to!: RepUser;

	@CreateDateColumn()
	createdAt!: Date;
}
