import { command, Module, listener } from 'cookiecord';
import { ThreadAutoArchiveDuration } from 'discord-api-types';
import {
	Message,
	TextChannel,
	Channel,
	ThreadChannel,
	MessageEmbed,
	GuildMember,
} from 'discord.js';
import { HelpThread } from '../entities/HelpThread';
import {
	trustedRoleId,
	helpCategory,
	timeBeforeHelperPing,
	GREEN,
	BLOCKQUOTE_GREY,
	generalHelpChannel,
	howToGetHelpChannel,
} from '../env';
import { isTrustedMember } from '../util/inhibitors';
import { sendWithMessageOwnership } from '../util/send';

const threadExpireEmbed = new MessageEmbed()
	.setColor(BLOCKQUOTE_GREY)
	.setTitle('This help thread expired.').setDescription(`
If your question was not resolved, you can make a new thread by simply asking your question again. \
Consider rephrasing the question to maximize your chance of getting a good answer. \
If you're not sure how, have a look through [StackOverflow's guide on asking a good question](https://stackoverflow.com/help/how-to-ask).
`);

// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
const indent = '\u200b\u00a0\u00a0\u00a0';

const helpInfo = (channel: TextChannel) =>
	new MessageEmbed()
		.setColor(GREEN)
		.setDescription(channel.topic ?? 'Ask your questions here!');

const howToGetHelpEmbeds = () => [
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Get Help')
		.setDescription(
			`
• Post your question to one of the channels in this category.
${indent}• If you're not sure which channel is best, just post in <#${generalHelpChannel}>.
${indent}• It's always ok to just ask your question; you don't need permission.
• Our bot will make a thread dedicated to answering your channel.
• Someone will (hopefully!) come along and help you.
• When your question is resolved, type \`!close\`.
`,
		),
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Get *Better* Help')
		.setDescription(
			`
• Explain what you want to happen and why…
${indent}• …and what actually happens, and your best guess at why.
• Include a short code sample and any error messages you got.
${indent}• Text is better than screenshots. Start code blocks with ${'\\`\\`\\`ts'}.
• If possible, create a minimal reproduction in the **[TypeScript Playground](https://www.typescriptlang.org/play)**.
${indent}• Send the full link in its own message; do not use a link shortener.
• Run \`!title <brief description>\` to make your help thread easier to spot.
• For more tips, check out StackOverflow's guide on **[asking good questions](https://stackoverflow.com/help/how-to-ask)**.
`,
		),
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle("If You Haven't Gotten Help")
		.setDescription(
			`
Usually someone will try to answer and help solve the issue within a few hours. \
If not, and if you have followed the bullets above, you can ping helpers by running \`!helper\`.
`,
		),
];

const helpThreadWelcomeMessage = (owner: GuildMember) => `
${owner} This thread is for your question; when it's resolved, please type \`!close\`. \
See <#${howToGetHelpChannel}> for info on how to get better help.
`;

// The rate limit for thread naming is 2 time / 10 mins, tracked per thread
const titleSetCooldown = 5 * 60 * 1000;

export class HelpThreadModule extends Module {
	@listener({ event: 'messageCreate' })
	async onNewQuestion(msg: Message) {
		if (!isHelpChannel(msg.channel)) return;
		if (msg.author.id === this.client.user!.id) return;
		this.updateHelpInfo(msg.channel);
		let thread = await msg.startThread({
			name: `[Open] Help ${msg.member?.nickname ?? msg.author.username}`,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
		});
		thread.send(helpThreadWelcomeMessage(msg.member!));
		await HelpThread.create({
			threadId: thread.id,
			ownerId: msg.author.id,
		}).save();
	}

	// Used to differentiate automatic archive from bot archive
	manuallyArchivedThreads = new Set<string>();

	@listener({ event: 'threadUpdate' })
	async onThreadExpire(thread: ThreadChannel) {
		if (
			!isHelpThread(thread) ||
			!((await thread.fetch()) as ThreadChannel).archived ||
			this.manuallyArchivedThreads.delete(thread.id)
		)
			return;
		await thread.send({ embeds: [threadExpireEmbed] });
		this.manuallyArchivedThreads.add(thread.id);
		await thread.setName(`[Closed] ${thread.name.replace(/\[.+?] /, '')}`);
		await thread.setArchived(true);
	}

	@command({
		aliases: ['closed', 'resolved', 'resolve', 'done'],
		description: 'Help System: Close an active help thread',
	})
	async close(msg: Message) {
		if (!isHelpThread(msg.channel))
			return await sendWithMessageOwnership(
				msg,
				':warning: This can only be run in a help thread',
			);

		let thread: ThreadChannel = msg.channel;
		const threadData = (await HelpThread.findOne(thread.id))!;

		if (
			threadData.ownerId === msg.author.id ||
			msg.member?.permissions.has('MANAGE_MESSAGES')
		) {
			await msg.react('✅');
			this.manuallyArchivedThreads.add(thread.id);
			await thread.setName(
				`[Closed] ${thread.name.replace(/\[.+?] /, '')}`,
			);
			await thread.setArchived(true);
		} else {
			return await sendWithMessageOwnership(
				msg,
				':warning: You have to be the asker to close the thread.',
			);
		}
	}

	private helpInfoLocks = new Map<string, Promise<void>>();
	private updateHelpInfo(channel: TextChannel) {
		this.helpInfoLocks.set(
			channel.id,
			(this.helpInfoLocks.get(channel.id) ?? Promise.resolve()).then(
				async () => {
					await Promise.all([
						...(await channel.messages.fetchPinned()).map(x =>
							x.delete(),
						),
						channel
							.send({ embeds: [helpInfo(channel)] })
							.then(x => x.pin()),
					]);
				},
			),
		);
	}

	@listener({ event: 'messageCreate' })
	deletePinMessage(msg: Message) {
		if (isHelpChannel(msg.channel) && msg.type === 'CHANNEL_PINNED_MESSAGE')
			msg.delete();
	}

	@command({
		description: 'Help System: Ping the @Helper role from a help thread',
		aliases: ['helpers'],
	})
	async helper(msg: Message) {
		if (!isHelpThread(msg.channel)) {
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

	@command({ single: true, description: 'Help System: Rename a help thread' })
	async title(msg: Message, title: string) {
		if (!isHelpThread(msg.channel))
			return sendWithMessageOwnership(
				msg,
				':warning: This can only be run in a help thread',
			);
		if (!title)
			return sendWithMessageOwnership(msg, ':warning: Missing title');
		const thread = msg.channel;
		const threadData = (await HelpThread.findOne(thread.id))!;
		if (
			msg.author.id !== threadData.ownerId &&
			!msg.member!.roles.cache.has(trustedRoleId)
		)
			return sendWithMessageOwnership(
				msg,
				':warning: Only the asker and helpers can set the title',
			);
		const titleSetAllowedAfter =
			+(threadData.titleSetTimestamp ?? 0) + titleSetCooldown;
		if (threadData.titleSetTimestamp && Date.now() < titleSetAllowedAfter)
			return sendWithMessageOwnership(
				msg,
				`:warning: You can set the title again <t:${Math.ceil(
					titleSetAllowedAfter / 1000,
				)}:R>`,
			);
		const owner = await msg.guild!.members.fetch(threadData.ownerId);
		const username = owner.nickname ?? owner.user.username;
		await Promise.all([
			HelpThread.update(thread.id, {
				titleSetTimestamp: Date.now() + '',
			}),
			msg.channel.setName(`[Open] ${username} - ${title}`),
		]);
	}

	@command()
	async htgh(msg: Message) {
		if (
			msg.channel.id !== howToGetHelpChannel ||
			!msg.member?.permissions.has('MANAGE_MESSAGES')
		)
			return;
		(await msg.channel.messages.fetch()).forEach(x => x.delete());
		msg.channel.send({ embeds: howToGetHelpEmbeds() });
	}
}

export function isHelpChannel(
	channel: Omit<Channel, 'partial'>,
): channel is TextChannel {
	return (
		channel instanceof TextChannel &&
		channel.parentId == helpCategory &&
		channel.id !== howToGetHelpChannel
	);
}

export function isHelpThread(
	channel: Omit<Channel, 'partial'>,
): channel is ThreadChannel & { parent: TextChannel } {
	return channel instanceof ThreadChannel && isHelpChannel(channel.parent!);
}
