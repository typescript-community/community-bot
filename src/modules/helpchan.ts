import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
	optional,
} from 'cookiecord';
import {
	Message,
	MessageEmbed,
	Guild,
	TextChannel,
	GuildMember,
	User,
} from 'discord.js';
import { HelpUser } from '../entities/HelpUser';
import {
	categories,
	TS_BLUE,
	GREEN,
	HOURGLASS_ORANGE,
	askCooldownRoleId,
	channelNames,
	dormantChannelTimeout,
	dormantChannelLoop,
	askHelpChannelId,
	ongoingEmptyTimeout,
	trustedRoleId,
} from '../env';
import { isTrustedMember } from '../util/inhibitors';

const AVAILABLE_MESSAGE = `
**Send your question here to claim the channel**
This channel will be dedicated to answering your question only. Others will try to answer and help you solve the issue.

**Keep in mind:**
• It's always ok to just ask your question. You don't need permission.
• Explain what you expect to happen and what actually happens.
• Include a code sample and error message, if you got any.

For more tips, check out StackOverflow's guide on **[asking good questions](https://stackoverflow.com/help/how-to-ask)**.
`;

// The "empty" line has a braille pattern blank unicode character, in order to
// achieve a leading newline, since normally whitespace is stripped. This is a
// hack, but it works even on a system without the fonts to display Discord
// emoji, so it should work everywhere. https://www.compart.com/en/unicode/U+2800
const occupiedMessage = (asker: User) => `
⠀
**This channel is claimed by ${asker}.**
It is dedicated to answering their questions only. More info: <#${askHelpChannelId}>

**${asker} You'll get better and faster answers if you:**
• Describe the context. What are you trying to accomplish?
• Include any error messages, and the code that produce them (5-15 lines).
• Use code blocks, not screenshots. Start with ${'```ts'} for syntax highlighting.
• Also reproduce the issue in the **[TypeScript Playground](https://www.typescriptlang.org/play)**, if possible.

Usually someone will try to answer and help solve the issue within a few hours. If not, and you have followed the bullets above, you may ping the <@&${trustedRoleId}> role.

For more tips, check out StackOverflow's guide on **[asking good questions](https://stackoverflow.com/help/how-to-ask)**.
`;

const DORMANT_MESSAGE = `
This help channel has been marked as **dormant**, and has been moved into the **Help: Dormant** category at the bottom of the channel list. It is no longer possible to send messages in this channel until it becomes available again.

If your question wasn't answered yet, you can claim a new help channel from the **Help: Available** category by simply asking your question again. Consider rephrasing the question to maximize your chance of getting a good answer. If you're not sure how, have a look through [StackOverflow's guide on asking a good question](https://stackoverflow.com/help/how-to-ask)
`;

export class HelpChanModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	CHANNEL_PREFIX = 'help-';

	AVAILABLE_EMBED = new MessageEmbed()
		.setTitle('✅ Available help channel')
		.setColor(GREEN)
		.setDescription(AVAILABLE_MESSAGE)
		.setFooter(
			`Closes after ${
				dormantChannelTimeout / 60 / 60 / 1000
			} hours of inactivity or when you send !close.`,
		);

	OCCUPIED_EMBED_BASE = new MessageEmbed()
		.setTitle('⌛ Occupied Help Channel')
		.setColor(HOURGLASS_ORANGE);

	occupiedEmbed(asker: User) {
		return new MessageEmbed(this.OCCUPIED_EMBED_BASE)
			.setDescription(occupiedMessage(asker))
			.setFooter(
				`Closes after ${
					dormantChannelTimeout / 60 / 60 / 1000
				} hours of inactivity or when ${asker.username} sends !close.`,
			);
	}

	DORMANT_EMBED = new MessageEmbed()
		.setTitle('💤 Dormant Help Channel')
		.setColor(TS_BLUE)
		.setDescription(DORMANT_MESSAGE);

	busyChannels: Set<string> = new Set(); // a lock to eliminate race conditions
	ongoingEmptyTimeouts: Map<string, NodeJS.Timeout> = new Map(); // a lock used to prevent multiple timeouts running on the same channel

	private getChannelName(guild: Guild) {
		const takenChannelNames = guild.channels.cache
			.filter(channel => channel.name.startsWith(this.CHANNEL_PREFIX))
			.map(channel => channel.name.replace(this.CHANNEL_PREFIX, ''));
		let decidedChannel = channelNames[0];

		do {
			decidedChannel =
				channelNames[Math.floor(Math.random() * channelNames.length)];
		} while (takenChannelNames.includes(decidedChannel));

		return `${this.CHANNEL_PREFIX}${decidedChannel}`;
	}

	private getOngoingChannels() {
		return this.client.channels.cache
			.filter(
				channel =>
					(channel as TextChannel).parentID === categories.ongoing,
			)
			.array() as TextChannel[];
	}

	@listener({ event: 'ready' })
	async startDormantLoop() {
		setInterval(() => {
			this.checkDormantPossibilities();
		}, dormantChannelLoop);
	}

	@listener({ event: 'ready' })
	async initialCheckEmptyOngoing() {
		for (const channel of this.getOngoingChannels()) {
			if (await this.checkEmptyOngoing(channel)) {
				await this.startEmptyTimeout(channel);
			}
		}
	}

	// Utility function used to check if there are no messages in an ongoing channel, meaning the bot
	// is the most recent message. This will be caused if somebody deletes their message after they
	// claim a channel.
	async checkEmptyOngoing(channel: TextChannel) {
		const messages = await channel.messages.fetch();

		const embed = messages.first()?.embeds[0];

		return (
			embed?.title &&
			embed.title.trim() === this.OCCUPIED_EMBED_BASE.title?.trim()
		);
	}

	async startEmptyTimeout(channel: TextChannel) {
		const existingTimeout = this.ongoingEmptyTimeouts.get(channel.id);
		if (existingTimeout) clearTimeout(existingTimeout);

		const timeout = setTimeout(async () => {
			this.ongoingEmptyTimeouts.delete(channel.id);

			if (await this.checkEmptyOngoing(channel)) {
				await this.markChannelAsDormant(channel);
			}
		}, ongoingEmptyTimeout);

		this.ongoingEmptyTimeouts.set(channel.id, timeout);
	}

	@listener({ event: 'messageDelete' })
	async onMessageDeleted(msg: Message) {
		if (
			msg.channel.type !== 'text' ||
			!msg.channel.parentID ||
			msg.channel.parentID !== categories.ongoing
		)
			return;

		await this.startEmptyTimeout(msg.channel);
	}

	async moveChannel(channel: TextChannel, category: string) {
		const parent = channel.guild.channels.resolve(category);
		if (parent == null) return;
		const data = {
			parentID: parent.id,
			permissionOverwrites: parent.permissionOverwrites,
		};
		await channel.edit(data);
	}

	@listener({ event: 'message' })
	async onNewQuestion(msg: Message) {
		if (
			msg.author.bot ||
			!msg.guild ||
			!msg.member ||
			msg.channel.type !== 'text' ||
			!msg.channel.parentID ||
			msg.channel.parentID !== categories.ask ||
			!msg.channel.name.startsWith(this.CHANNEL_PREFIX) ||
			this.busyChannels.has(msg.channel.id)
		)
			return;

		this.busyChannels.add(msg.channel.id);

		let embed = this.occupiedEmbed(msg.author);

		await this.updateStatusEmbed(msg.channel, embed);
		await msg.pin();
		await this.addCooldown(msg.member, msg.channel);
		await this.moveChannel(msg.channel, categories.ongoing);

		await this.ensureAskChannels(msg.guild);
		this.busyChannels.delete(msg.channel.id);
	}

	@listener({ event: 'message' })
	async onNewSystemPinMessage(msg: Message) {
		if (
			msg.type !== 'PINS_ADD' ||
			msg.channel.type !== 'text' ||
			!(
				msg.channel.parentID == categories.ask ||
				msg.channel.parentID == categories.ongoing
			)
		)
			return;
		await msg.delete({ reason: 'Pin system message' });
	}

	@command({
		aliases: ['close', 'resolve', 'done'],
		description: 'Help Channel: Marks this channel as resolved',
	})
	async resolved(msg: Message) {
		if (
			!(msg.channel instanceof TextChannel) ||
			!msg.guild ||
			this.busyChannels.has(msg.channel.id)
		)
			return;

		if (msg.channel.parentID !== categories.ongoing) {
			return await msg.channel.send(
				':warning: you can only run this in ongoing help channels.',
			);
		}

		const owner = await HelpUser.findOne({
			channelId: msg.channel.id,
		});

		if (
			(owner && owner.userId === msg.author.id) ||
			msg.member?.hasPermission('MANAGE_MESSAGES')
		) {
			await this.markChannelAsDormant(msg.channel);
		} else {
			return await msg.channel.send(
				':warning: you have to be the asker to close the channel.',
			);
		}
	}

	async ensureAskChannels(guild: Guild) {
		while (
			guild.channels.cache
				.filter(channel => channel.parentID == categories.ask)
				.filter(channel => channel.name.startsWith(this.CHANNEL_PREFIX))
				.size !== 2
		) {
			const dormant = guild.channels.cache.find(
				x => x.parentID == categories.dormant,
			);
			if (dormant && dormant instanceof TextChannel) {
				await this.moveChannel(dormant, categories.ask);
				await this.updateStatusEmbed(dormant, this.AVAILABLE_EMBED);
			} else {
				const chan = await guild.channels.create(
					this.getChannelName(guild),
					{
						type: 'text',
						topic: 'Ask your questions here!',
						reason: 'maintain help channel goal',
						parent: categories.ask,
					},
				);

				// Channel should already be in ask, but sync the permissions.
				await this.moveChannel(chan, categories.ask);
				await chan.send(this.AVAILABLE_EMBED);
			}
		}
	}

	private async markChannelAsDormant(channel: TextChannel) {
		this.busyChannels.add(channel.id);

		const pinned = await channel.messages.fetchPinned();
		await Promise.all(pinned.map(msg => msg.unpin()));

		const helpUser = await HelpUser.findOne({
			channelId: channel.id,
		});
		if (helpUser) {
			try {
				const member = await channel.guild.members.fetch({
					user: helpUser.userId,
				});
				await member.roles.remove(askCooldownRoleId);
			} catch {
				// Do nothing, member left the guild
			}
		}
		await HelpUser.delete({ channelId: channel.id });

		await this.moveChannel(channel, categories.dormant);

		await channel.send(this.DORMANT_EMBED);

		await this.ensureAskChannels(channel.guild);
		this.busyChannels.delete(channel.id);
	}

	private async checkDormantPossibilities() {
		for (const channel of this.getOngoingChannels()) {
			const messages = await channel.messages.fetch();

			const diff =
				Date.now() - (messages.first()?.createdAt.getTime() ?? 0);

			if (diff > dormantChannelTimeout)
				await this.markChannelAsDormant(channel);
		}
	}

	private async updateStatusEmbed(channel: TextChannel, embed: MessageEmbed) {
		const isStatusEmbed = (embed: MessageEmbed) =>
			[
				this.AVAILABLE_EMBED.title,
				this.OCCUPIED_EMBED_BASE.title,
				this.DORMANT_EMBED.title,
			].includes(embed.title);

		// The message cache/fetch does not have a stable order (at least w.r.t.
		// creation date), so sorting is needed to find the latest embed.
		let lastMessage = channel.messages.cache
			.array()
			.filter(m => m.author.id === this.client.user?.id)
			.sort((m1, m2) => m2.createdTimestamp - m1.createdTimestamp)
			.find(m => m.embeds.some(isStatusEmbed));

		if (!lastMessage)
			lastMessage = (await channel.messages.fetch({ limit: 5 }))
				.array()
				.filter(m => m.author.id === this.client.user?.id)
				.sort((m1, m2) => m2.createdTimestamp - m1.createdTimestamp)
				.find(m => m.embeds.some(isStatusEmbed));

		if (lastMessage) {
			// If there is a last message (the status message) by the bot, edit it
			await lastMessage.edit(embed);
		} else {
			// Otherwise, just send a new message
			await channel.send(embed);
		}
	}

	private async addCooldown(member: GuildMember, channel: TextChannel) {
		await member.roles.add(askCooldownRoleId);
		const helpUser = new HelpUser();
		helpUser.userId = member.user.id;
		helpUser.channelId = channel.id;
		await helpUser.save();
	}

	@command({
		inhibitors: [CommonInhibitors.guildsOnly],
		aliases: ['claimed'],
		description: 'Help Channel: Check if a user has an open help channel',
	})
	async cooldown(msg: Message, @optional member?: GuildMember) {
		const guildTarget = await msg.guild!.members.fetch(
			member ?? msg.author,
		);

		if (!guildTarget) return;

		if (!guildTarget.roles.cache.has(askCooldownRoleId)) {
			await msg.channel.send(
				`${guildTarget.displayName} doesn't have a cooldown.`,
			);
			return;
		}

		const helpUser = await HelpUser.findOne({
			userId: guildTarget.id,
		});

		if (helpUser) {
			return msg.channel.send(
				`${guildTarget.displayName} has an active help channel: <#${helpUser.channelId}>`,
			);
		}

		await guildTarget.roles.remove(askCooldownRoleId);
		await msg.channel.send(
			`Removed ${guildTarget.displayName}'s cooldown.`,
		);
	}

	@command({
		inhibitors: [isTrustedMember],
		description: "Help Channel: Claim a help channel for a user's question",
	})
	async claim(msg: Message, member: GuildMember) {
		const helpUser = await HelpUser.findOne({
			userId: member.id,
		});
		if (helpUser) {
			await msg.channel.send(
				`${member.displayName} already has an open help channel: <#${helpUser.channelId}>`,
			);
			return;
		}

		const channelMessages = await msg.channel.messages.fetch({ limit: 50 });
		const questionMessages = channelMessages.filter(
			questionMsg =>
				questionMsg.author.id === member.id &&
				questionMsg.id !== msg.id,
		);

		const msgContent = questionMessages
			.array()
			.slice(0, 10)
			.map(msg => msg.content)
			.reverse()
			.join('\n')
			.slice(0, 2000);

		const claimedChannel = msg.guild!.channels.cache.find(
			channel =>
				channel.type === 'text' &&
				channel.parentID == categories.ask &&
				channel.name.startsWith(this.CHANNEL_PREFIX) &&
				!this.busyChannels.has(channel.id),
		) as TextChannel | undefined;

		if (!claimedChannel) {
			await msg.channel.send(
				':warning: failed to claim a help channel, no available channel.',
			);
			return;
		}

		this.busyChannels.add(claimedChannel.id);
		const toPin = await claimedChannel.send(
			new MessageEmbed()
				.setAuthor(member.displayName, member.user.displayAvatarURL())
				.setDescription(msgContent),
		);

		await toPin.pin();
		const occupied = this.occupiedEmbed(member.user);
		await this.updateStatusEmbed(claimedChannel, occupied);
		await this.addCooldown(member, claimedChannel);
		await this.moveChannel(claimedChannel, categories.ongoing);
		await claimedChannel.send(
			`${member.user} this channel has been claimed for your question. Please review <#${askHelpChannelId}> for how to get help.`,
		);
		await this.ensureAskChannels(msg.guild!);

		this.busyChannels.delete(claimedChannel.id);

		await msg.channel.send(`👌 successfully claimed ${claimedChannel}`);
	}

	// Commands to fix race conditions
	@command({
		inhibitors: [CommonInhibitors.hasGuildPermission('MANAGE_MESSAGES')],
	})
	async removelock(msg: Message) {
		this.busyChannels.delete(msg.channel.id);
		await msg.channel.send(':ok_hand:');
	}

	@command({
		inhibitors: [CommonInhibitors.hasGuildPermission('MANAGE_MESSAGES')],
	})
	async ensureAsk(msg: Message) {
		if (!msg.guild) return;

		await this.ensureAskChannels(msg.guild);
		await msg.channel.send(':ok_hand:');
	}
}
