import {
	command,
	default as CookiecordClient,
	Module,
	optional,
} from "cookiecord";
import { GuildMember, Message, MessageEmbed, User } from "discord.js";
import prettyMilliseconds from "pretty-ms";
import {
	BaseEntity,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryColumn,
	PrimaryGeneratedColumn,
} from "typeorm";
import { getDB } from "../db";
import { TS_BLUE } from "../env";
const DAY_MS = 86400000;

export default class RepModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}
	async getOrMakeUser(user: User) {
		const db = await getDB();
		let ru = await db.manager.findOne(RepUser, user.id, {
			relations: ["got", "given"],
		});
		if (!ru) {
			ru = await RepUser.create({ id: user.id }).save();
		}
		return ru;
	}

	@command()
	async rep(msg: Message, targetMember: GuildMember) {
		const senderRU = await this.getOrMakeUser(msg.author);
		const targetRU = await this.getOrMakeUser(targetMember.user);
		if ((await senderRU.sent()) >= 3)
			return await msg.channel.send(
				":warning: no rep remaining! come back later."
			);

		await RepGive.create({
			from: senderRU,
			to: targetRU,
		}).save();

		await msg.channel.send(
			`:ok_hand: sent ${targetMember.displayName} 1 rep`
		);
	}

	@command()
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
										Date.now() - rg.createdAt.getTime()
									)} ago)`;
								else
									return `:white_small_square: Got 1 rep from <@${
										rg.from.id
									}> (${prettyMilliseconds(
										Date.now() - rg.createdAt.getTime()
									)} ago)`;
							})
					)
				).join("\n")
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
			x => Date.now() - x.createdAt.getTime() < DAY_MS
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
