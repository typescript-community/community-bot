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
} from 'discord.js';
import { HelpUser } from '../entities/HelpUser';
import {
	categories,
	TS_BLUE,
	askCooldownRoleId,
	channelNames,
	dormantChannelTimeout,
	dormantChannelLoop,
	askHelpChannelId,
} from '../env';
import { isTrustedMember } from '../util/inhibitors';

export class HelpChanModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	CHANNEL_PREFIX = 'help-';

	AVAILABLE_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setDescription(
			'This help channel is now **available**, which means that ' +
				'you can claim it by typing your question into it. ' +
				'Once claimed, the channel will move into the **Help: Ongoing** category, and ' +
				`will be yours until it has been inactive for ${
					dormantChannelTimeout / 60 / 60
				} hours or is closed ` +
				'manually with `!close`. When that happens, it will be set to **dormant** and moved into the **Help: Dormant** category.\n\n' +
				"Try to write the best question you can by providing a detailed description and telling us what you've tried already.",
		);

	DORMANT_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setDescription(
			'This help channel has been marked as **dormant**, and has been moved into the **Help: Dormant** category at the ' +
				'bottom of the channel list. It is no longer possible to send messages in this channel until it becomes available again.\n\n' +
				"If your question wasn't answered yet, you can claim a new help channel from the **Help: Available** category" +
				' by simply asking your question again. Consider rephrasing the question to maximize your chance of getting ' +
				"a good answer. If you're not sure how, have a look through " +
				"[StackOverflow's guide on asking a good question](https://stackoverflow.com/help/how-to-ask)",
		);

	busyChannels: Set<string> = new Set(); // a lock to eliminate race conditions

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

	@listener({ event: 'ready' })
	async startDormantLoop() {
		setInterval(() => {
			this.checkDormantPossibilities();
		}, dormantChannelLoop);
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
		aliases: ['resolve', 'done', 'close'],
		description: 'Marks this channel as resolved',
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

				let lastMessage = dormant.messages.cache
					.array()
					.reverse()
					.find(m => m.author.id === this.client.user?.id);

				if (!lastMessage)
					lastMessage = (await dormant.messages.fetch({ limit: 5 }))
						.array()
						.find(m => m.author.id === this.client.user?.id);

				if (lastMessage) {
					// If there is a last message (the dormant message) by the bot, just edit it
					await lastMessage.edit(this.AVAILABLE_EMBED);
				} else {
					// Otherwise, just send a new message
					await dormant.send(this.AVAILABLE_EMBED);
				}
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
			const member = await channel.guild.members.fetch({
				user: helpUser.userId,
			});
			await member?.roles.remove(askCooldownRoleId);
		}
		await HelpUser.delete({ channelId: channel.id });

		await this.moveChannel(channel, categories.dormant);

		await channel.send(this.DORMANT_EMBED);

		await this.ensureAskChannels(channel.guild);
		this.busyChannels.delete(channel.id);
	}

	private async checkDormantPossibilities() {
		const ongoingChannels = this.client.channels.cache.filter(channel => {
			if (channel.type === 'dm') return false;

			return (channel as TextChannel).parentID === categories.ongoing;
		});

		for (const channel of ongoingChannels.array()) {
			const messages = await (channel as TextChannel).messages.fetch();

			const diff =
				(Date.now() - messages.array()[0].createdAt.getTime()) / 1000;

			if (diff > dormantChannelTimeout)
				await this.markChannelAsDormant(channel as TextChannel);
		}
	}

	private async addCooldown(member: GuildMember, channel: TextChannel) {
		await member.roles.add(askCooldownRoleId);
		const helpUser = new HelpUser();
		helpUser.userId = member.user.id;
		helpUser.channelId = channel.id;
		await helpUser.save();
	}

	@command({ inhibitors: [CommonInhibitors.guildsOnly] })
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

	@command({ inhibitors: [isTrustedMember] })
	async claim(msg: Message, member: GuildMember) {
		const helpUser = await HelpUser.findOne({
			userId: member.id,
		});
		if (helpUser) {
			return msg.channel.send(
				`${member.displayName} already has an open help channel: <#${helpUser.channelId}>`,
			);
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
			return msg.channel.send(
				':warning: failed to claim a help channel, no available channel.',
			);
		}

		this.busyChannels.add(claimedChannel.id);
		const toPin = await claimedChannel.send(
			new MessageEmbed()
				.setAuthor(member.displayName, member.user.displayAvatarURL())
				.setDescription(msgContent),
		);
		await toPin.pin();
		await this.addCooldown(member, claimedChannel);
		await this.moveChannel(claimedChannel, categories.ongoing);
		await claimedChannel.send(
			`${member.user} this channel has been claimed for your question. Please review <#${askHelpChannelId}> for how to get help.`,
		);
		await this.ensureAskChannels(msg.guild!);

		this.busyChannels.delete(claimedChannel.id);
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
