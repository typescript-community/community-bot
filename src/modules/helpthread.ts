import { command, Module, listener } from 'cookiecord';
import { ThreadAutoArchiveDuration } from 'discord-api-types';
import {
	Message,
	TextChannel,
	Channel,
	ThreadChannel,
	MessageEmbed,
} from 'discord.js';
import { threadId } from 'worker_threads';
import { HelpThread } from '../entities/HelpThread';
import {
	trustedRoleId,
	helpCategory,
	timeBeforeHelperPing,
	GREEN,
	BLOCKQUOTE_GREY,
} from '../env';
import { isTrustedMember } from '../util/inhibitors';
import { LimitedSizeMap } from '../util/limitedSizeMap';
import { sendWithMessageOwnership } from '../util/send';

const THREAD_EXPIRE_MESSAGE = new MessageEmbed()
	.setColor(BLOCKQUOTE_GREY)
	.setTitle('This help thread expired.').setDescription(`
If your question was not resolved, you can make a new thread by simply asking your question again. \
Consider rephrasing the question to maximize your chance of getting a good answer. \
If you're not sure how, have a look through [StackOverflow's guide on asking a good question](https://stackoverflow.com/help/how-to-ask).
`);

// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
const indent = '\u200b\u00a0\u00a0\u00a0';

const HELP_INFO = (channel: TextChannel) =>
	new MessageEmbed().setColor(GREEN).setTitle('How To Get Help')
		.setDescription(`
${
	channel.topic
		? `This channel is for ${
				channel.topic[0].toLowerCase() +
				channel.topic.slice(1).split('\n')[0]
		  }`
		: ''
}

**To get help:**
• Post your question to this channel.
${indent}• It's always ok to just ask your question; you don't need permission.
• Our bot will make a thread dedicated to answering your channel.
• Someone will (hopefully!) come along and help you.
• When your question is resolved, type \`!tclose\`.

**For better & faster answers:**
• Explain what you want to happen and why…
${indent}• …and what actually happens, and your best guess at why.
• Include a short code sample and error messages, if you got any.
${indent}• Text is better than screenshots. Start code blocks with ${'\\`\\`\\`ts'}.
• If possible, create a minimal reproduction in the **[TypeScript Playground](https://www.typescriptlang.org/play)**.
${indent}• Send the full link in its own message. Do not use a link shortener.
• Run \`!title <brief description>\` to make your help thread easier to spot.

For more tips, check out StackOverflow's guide on **[asking good questions](https://stackoverflow.com/help/how-to-ask)**.

Usually someone will try to answer and help solve the issue within a few hours. \
If not, and **if you have followed the bullets above**, you may ping helpers by running \`!helper\`. \
Please allow extra time at night in America/Europe.
`);

const helpInfoLocks = new Map<string, Promise<void>>();
const manuallyArchivedThreads = new LimitedSizeMap<string, void>(100);

export class HelpThreadModule extends Module {
	@listener({ event: 'messageCreate' })
	async onNewQuestion(msg: Message) {
		if (!this.isHelpChannel(msg.channel)) return;
		if (msg.author.id === this.client.user!.id) return;
		this.updateHelpInfo(msg.channel);
		let thread = await msg.startThread({
			name: msg.member?.nickname ?? msg.author.username,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
		});
		thread.setLocked(true);
		await HelpThread.create({
			threadId: thread.id,
			ownerId: msg.author.id,
		}).save();
	}

	@listener({ event: 'threadUpdate' })
	async onThreadExpire(thread: ThreadChannel) {
		if (
			!this.isHelpThread(thread) ||
			manuallyArchivedThreads.has(thread.id) ||
			!((await thread.fetch()) as ThreadChannel).archived
		)
			return;
		await thread.send({ embeds: [THREAD_EXPIRE_MESSAGE] });
		await this.closeThread(thread);
	}

	@command()
	async tclose(msg: Message) {
		if (!this.isHelpThread(msg.channel)) return;

		const threadData = (await HelpThread.findOne(msg.channel.id))!;

		if (
			threadData.ownerId === msg.author.id ||
			msg.member?.permissions.has('MANAGE_MESSAGES')
		) {
			await this.closeThread(msg.channel);
		} else {
			return await msg.channel.send(
				':warning: you have to be the asker to close the thread.',
			);
		}
	}

	private async closeThread(thread: ThreadChannel) {
		manuallyArchivedThreads.set(thread.id);
		await thread.setArchived(true, 'grrr');
		await HelpThread.delete(thread.id);
	}

	private updateHelpInfo(channel: TextChannel) {
		helpInfoLocks.set(
			channel.id,
			(helpInfoLocks.get(channel.id) ?? Promise.resolve()).then(
				async () => {
					await Promise.all([
						...(await channel.messages.fetchPinned()).map(x =>
							x.delete(),
						),
						channel
							.send({ embeds: [HELP_INFO(channel)] })
							.then(x => x.pin()),
					]);
				},
			),
		);
	}

	@listener({ event: 'messageCreate' })
	deletePinMessage(msg: Message) {
		if (
			this.isHelpChannel(msg.channel) &&
			msg.type === 'CHANNEL_PINNED_MESSAGE'
		)
			msg.delete();
	}

	private isHelpChannel(
		channel: Omit<Channel, 'partial'>,
	): channel is TextChannel {
		return (
			channel instanceof TextChannel && channel.parentId == helpCategory
		);
	}

	private isHelpThread(
		channel: Omit<Channel, 'partial'>,
	): channel is ThreadChannel & { parent: TextChannel } {
		return (
			channel instanceof ThreadChannel &&
			this.isHelpChannel(channel.parent!)
		);
	}

	@command({
		description: 'Pings a helper in a help-thread',
		aliases: ['helpers'],
	})
	async helper(msg: Message) {
		if (!this.isHelpThread(msg.channel)) {
			return sendWithMessageOwnership(
				msg,
				':warning: You may only ping helpers from a help thread',
			);
		}

		const thread = msg.channel;
		const threadData = (await HelpThread.findOne(thread.id))!;

		// Ensure the user has permission to ping helpers
		const isAsker = msg.author.id === threadData.ownerId;
		const isTrusted =
			(await isTrustedMember(msg, this.client)) === undefined; // No error if trusted

		if (!isAsker && !isTrusted) {
			return sendWithMessageOwnership(
				msg,
				':warning: Only the asker can ping helpers',
			);
		}

		const askTime = thread.createdTimestamp;
		const pingAllowedAfter =
			+(threadData.helperTimestamp ?? askTime) + timeBeforeHelperPing;

		// Ensure they've waited long enough
		// Trusted members (who aren't the asker) are allowed to disregard the timeout
		if (isAsker && Date.now() < pingAllowedAfter) {
			return sendWithMessageOwnership(
				msg,
				`:warning: Please wait a bit longer. You can ping helpers <t:${Math.ceil(
					pingAllowedAfter / 1000,
				)}:R>.`,
			);
		}

		// The beacons are lit, Gondor calls for aid
		await Promise.all([
			thread.parent.send(`<@&${trustedRoleId}> ${msg.channel}`),
			this.updateHelpInfo(thread.parent),
			msg.react('✅'),
			HelpThread.update(thread.id, {
				helperTimestamp: Date.now().toString(),
			}),
		]);
	}

	@command({ single: true })
	async title(msg: Message, title: string) {
		if (!this.isHelpThread(msg.channel)) return;
		if (!title) return sendWithMessageOwnership(msg, ':x: Missing title');
		let username = msg.member?.nickname ?? msg.author.username;
		if (msg.channel.name !== username)
			return sendWithMessageOwnership(msg, ':x: Already set thread name');
		msg.channel.setName(`${username} - ${title}`);
	}
}
