import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
} from "cookiecord";
import {
	Message,
	MessageEmbed,
	Guild,
	TextChannel,
	Collection,
} from "discord.js";
import { categories, TS_BLUE, askCooldownRoleId, channelNames } from "../env";
import { oneLine } from "common-tags";

export default class HelpChanModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	CHANNEL_PREFIX = "help-";

	INFO_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setDescription("Blah blah blah\nBlah more blah");
	AVAILABLE_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setDescription(
			"This help channel is now **available**, which means that " +
				"you can claim it by typing your question into it." +
				"Once claimed, the channel will move into the **Help: Ongoing** category, and " +
				"will be yours until it has been inactive for 30 minutes or is closed " +
				"manually with `!close`. When that happens, it will be set to **dormant** and moved into the **Help: Dormant** category.\n\n" +
				"Try to write the best question you can by providing a detailed description and telling us what you've tried already."
		);

	busyChannels: Set<string> = new Set(); // a lock to eliminate race conditions

	private getChannelName(guild: Guild) {
		const takenChannelNames = guild.channels.cache
			.filter(channel => channel.name.startsWith("help-"))
			.map(channel => channel.name.replace(this.CHANNEL_PREFIX, ""));
		let decidedChannel = channelNames[0];

		do {
			decidedChannel =
				channelNames[Math.floor(Math.random() * channelNames.length)];
		} while (takenChannelNames.includes(decidedChannel));

		return `${this.CHANNEL_PREFIX}${decidedChannel}`;
	}

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

		await msg.pin();
		await msg.channel.setParent(categories.ongoing);
		await msg.channel.lockPermissions();
		await msg.member.roles.add(askCooldownRoleId);

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
		const pinned = (await msg.channel.messages.fetchPinned()).first();
		if (
			pinned?.author.id !== msg.author.id &&
			!msg.member?.hasPermission("MANAGE_MESSAGES")
		)
			return await msg.channel.send(
				":warning: you have to be the asker to close the channel."
			);
		if (msg.channel.parentID !== categories.ongoing)
			return await msg.channel.send(
				":warning: you can only run this in ongoing help channels."
			);

		const m = await msg.channel.send(`:lock: closing channel...`);

		this.busyChannels.add(msg.channel.id);
		await (await msg.channel.messages.fetchPinned()).first()?.unpin();
		await msg.member?.roles.remove(askCooldownRoleId);
		await msg.channel.setParent(categories.dormant);
		await msg.channel.lockPermissions();
		await msg.channel.send(":closed_lock_with_key: channel closed");

		await this.ensureAskChannels(msg.guild);
		this.busyChannels.delete(msg.channel.id);
	}

	async ensureAskChannels(guild: Guild) {
		while (
			guild.channels.cache.filter(x => x.parentID == categories.ask)
				.size !== 2
		) {
			const dormant = guild.channels.cache.find(
				x => x.parentID == categories.dormant
			);
			if (dormant && dormant instanceof TextChannel) {
				await dormant.setParent(categories.ask);
				await dormant.send(this.AVAILABLE_EMBED);
				await dormant.lockPermissions();
			} else {
				const chan = await guild.channels.create(
					this.getChannelName(guild),
					{
						type: "text",
						topic: "Ask your questions here!",
						reason: "maintain help channel goal",
						parent: categories.ask,
					}
				);
				await chan.lockPermissions();
				await chan.send(this.AVAILABLE_EMBED);
			}
		}
	}

	@command({ inhibitors: [CommonInhibitors.botAdminsOnly] })
	async removelock(msg: Message) {
		// just incase it somehow gets stuck
		this.busyChannels.delete(msg.channel.id);
		await msg.channel.send(":ok_hand:");
	}
}
