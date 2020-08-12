import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	CommonInhibitors,
} from 'cookiecord';
import { Message, MessageEmbed, Guild, TextChannel } from 'discord.js';
import {
	categories,
	TS_BLUE,
	askCooldownRoleId,
	channelNames,
	dormantChannelTimeout,
	dormantChannelLoop,
	askCooldownTimeout,
} from '../env';

export default class HelpChanModule extends Module {
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
					dormantChannelTimeout / 60
				} minutes or is closed ` +
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
			.filter(channel => channel.name.startsWith('help-'))
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
		await msg.channel.setParent(categories.ongoing);
		await msg.member.roles.add(askCooldownRoleId);
		await msg.channel.lockPermissions();

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

	@command({ aliases: ['resolve', 'done', 'close'] })
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
			!msg.member?.hasPermission('MANAGE_MESSAGES')
		)
			return await msg.channel.send(
				':warning: you have to be the asker to close the channel.',
			);
		if (msg.channel.parentID !== categories.ongoing)
			return await msg.channel.send(
				':warning: you can only run this in ongoing help channels.',
			);

		await this.markChannelAsDormant(msg.channel, pinned);
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
				await dormant.setParent(categories.ask);

				const lastMessage = dormant.messages.cache
					.array()
					.reverse()
					.find(m => m.author.id === this.client.user?.id);
				if (lastMessage) {
					// If there is a last message (the dormant message) by the bot, just edit it
					await lastMessage.edit(this.AVAILABLE_EMBED);
				} else {
					// Otherwise, just send a new message
					await dormant.send(this.AVAILABLE_EMBED);
				}

				await dormant.lockPermissions();
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
				await chan.lockPermissions();
				await chan.send(this.AVAILABLE_EMBED);
			}
		}
	}

	private async markChannelAsDormant(channel: TextChannel, pinned?: Message) {
		if (!pinned) pinned = (await channel.messages.fetchPinned()).first();

		this.busyChannels.add(channel.id);
		await pinned?.unpin();
		setTimeout(() => {
			pinned?.member?.roles.remove(askCooldownRoleId);
		}, askCooldownTimeout * 1000);

		const parent = channel.guild.channels.resolve(categories.dormant);
		if (parent == null) return;
		const data = {
			parentID: categories.dormant,
			permissionOverwrites: parent.permissionOverwrites,
		};
		await channel.edit(data);

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

	@command({
		inhibitors: [CommonInhibitors.hasGuildPermission('MANAGE_MESSAGES')],
	})
	async removelock(msg: Message) {
		// just incase it somehow gets stuck
		this.busyChannels.delete(msg.channel.id);
		await msg.channel.send(':ok_hand:');
	}
}
