import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
} from "cookiecord";
import { Message, MessageEmbed, Guild, TextChannel } from "discord.js";
import { categories, TS_BLUE, askCooldownRoleId } from "../env";

type AskCooldownEntry = { memberID: string; when: number };

export default class HelpChanModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	INFO_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setDescription("Blah blah blah\nBlah more blah");
	busyChannels: Set<string> = new Set(); // a lock to eliminate race conditions
	askCooldowns: AskCooldownEntry[] = [];
	cooldownTime = 30000; //900000; // 15 min -> ms

	@listener({ event: "message" })
	async onNewQuestion(msg: Message) {
		if (
			msg.author.bot ||
			!msg.guild ||
			!msg.member ||
			msg.channel.type !== "text" ||
			!msg.channel.parentID ||
			msg.channel.parentID !== categories.ask ||
			this.busyChannels.has(msg.channel.id)
		)
			return;
		this.busyChannels.add(msg.channel.id);

		await msg.channel.setTopic(
			`Busy! Go to a new help channel to ask a new question or help ${msg.author} with their question.`
		);

		await msg.channel.setParent(categories.ongoing);
		await msg.member.roles.add(askCooldownRoleId);
		this.askCooldowns.push({
			memberID: msg.member.id,
			when: Date.now() + this.cooldownTime,
		});

		await this.ensureAskChannels(msg.guild);
		this.busyChannels.delete(msg.channel.id);
	}
	@command({ aliases: ["resolve", "done", "close"] })
	async resolved(msg: Message) {
		if (
			!(msg.channel instanceof TextChannel) ||
			!msg.guild ||
			this.busyChannels.has(msg.channel.id)
		)
			return;
		if (
			!msg.channel.topic?.includes(msg.author.toString()) &&
			!msg.member?.hasPermission("MANAGE_MESSAGES")
		)
			return await msg.channel.send(
				":warning: you have to be the asker to close the channel."
			);
		if (msg.channel.parentID !== categories.ongoing)
			return await msg.channel.send(
				":warning: you can only run this in ongoing help channels."
			);
		this.busyChannels.add(msg.channel.id);

		await msg.channel.send(":ok_hand: question resolved! (:");
		await msg.channel.setParent(categories.answered);
		await msg.channel.lockPermissions();
		await this.ensureAskChannels(msg.guild);
		this.busyChannels.delete(msg.channel.id);
	}

	async ensureAskChannels(guild: Guild) {
		while (
			guild.channels.cache.filter(x => x.parentID == categories.ask)
				.size !== 2
		) {
			const answered = guild.channels.cache.find(
				x => x.parentID == categories.answered
			);
			if (answered && answered instanceof TextChannel) {
				// await answered.setTopic("Ask your questions here!");
				await answered.setParent(categories.ask);
				await answered.send(this.INFO_EMBED);
				await answered.lockPermissions();
			} else {
				const chan = await guild.channels.create("help", {
					type: "text",
					topic: "Ask your questions here!",
					reason: "maintain help channel goal",
					parent: categories.ask,
				});
				await chan.lockPermissions();
				await chan.send(this.INFO_EMBED);
			}
		}
	}
	@command({ inhibitors: [CommonInhibitors.botAdminsOnly] })
	async removelock(msg: Message) {
		// just incase it somehow gets stuck
		this.busyChannels.delete(msg.channel.id);
		await msg.channel.send(":ok_hand:");
	}
	@listener({ event: "ready" })
	removeCooldowns() {
		setInterval(async () => {
			this.askCooldowns = (
				await Promise.all(
					this.askCooldowns.map(async e => {
						if (e.when > Date.now()) return e;
						const member = await this.client.guilds.cache
							.first()
							?.members.fetch(e.memberID);
						if (!member) return e;
						await member.roles.remove([askCooldownRoleId]);
						return;
					})
				)
			).filter(x => x !== undefined) as AskCooldownEntry[]; // ts cant narrow down based on the .filter
		}, 1000 * 10);
	}
}
