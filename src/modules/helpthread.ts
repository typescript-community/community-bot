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
	howToGiveHelpChannel,
	rolesChannelId,
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

const helperCloseEmbed = (member: GuildMember) =>
	new MessageEmbed().setColor(BLOCKQUOTE_GREY).setDescription(`
Because your issue seemed to be resolved, this thread was closed by ${member}.

If your issue is not resolved, **you can post another message here and the thread will automatically re-open**.

*If you have a different question, just ask in <#${generalHelpChannel}>.*
`);

const closedEmoji = '☑️';

const helpInfo = (channel: TextChannel) =>
	new MessageEmbed()
		.setColor(GREEN)
		.setDescription(channel.topic ?? 'Ask your questions here!');

const howToGetHelpEmbeds = () => [
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Get Help')
		.setDescription(
			listify(`
- Post your question to one of the channels in this category.
	- If you're not sure which channel is best, just post in <#${generalHelpChannel}>.
	- It's always ok to just ask your question; you don't need permission.
- Our bot will make a thread dedicated to answering your channel.
- Someone will (hopefully!) come along and help you.
- When your question is resolved, type \`!close\`.
`),
		),
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Get *Better* Help')
		.setDescription(
			listify(`
- Explain what you want to happen and why…
	- …and what actually happens, and your best guess at why.
- Include a short code sample and any error messages you got.
	- Text is better than screenshots. Start code blocks with ${'\\`\\`\\`ts'}.
- If possible, create a minimal reproduction in the **[TypeScript Playground](https://www.typescriptlang.org/play)**.
	- Send the full link in its own message; do not use a link shortener.
- Run \`!title <brief description>\` to make your help thread easier to spot.
- For more tips, check out StackOverflow's guide on **[asking good questions](https://stackoverflow.com/help/how-to-ask)**.
`),
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

const howToGiveHelpEmbeds = () => [
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Give Help')
		.setDescription(
			listify(`
- There are a couple ways you can browse help threads:
	- The channel sidebar on the left will list threads you have joined.
	- You can scroll through the channel to see all recent questions.
		- The bot will mark closed questions with ${closedEmoji}.
	- In the channel, you can click the *⌗*\u2004icon at the top right to view threads by title.

`),
		),
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('How To Give *Better* Help')
		.setDescription(
			listify(`
- Get yourself the <@&${trustedRoleId}> role at <#${rolesChannelId}>
	- (If you don't like the pings, you can disable role mentions for the server.)
- As a <@&${trustedRoleId}>, you can:
	- Run \`!title <brief description>\` to set/update the thread title.
		- This will assist other helpers in finding the thread.
		- Also, it means your help is more accessible to others in the future.
	- If a thread appears to be resolved, run \`!close\` to close it.
		- *Only do this if the asker has indicated that their question has been resolved.*
`),
		),
	new MessageEmbed()
		.setColor(GREEN)
		.setTitle('Useful Snippets')
		.setDescription(
			listify(`
- \`!screenshot\` — for if an asker posts a screenshot of code
- \`!ask\` — for if an asker only posts "can I get help?"
`),
		),
];

const helpThreadWelcomeMessage = (owner: GuildMember) => `
${owner} This thread is for your question; type \`!title <brief description>\`. \
When it's resolved, please type \`!close\`. \
See <#${howToGetHelpChannel}> for info on how to get better help.
`;

// The rate limit for thread naming is 2 time / 10 mins, tracked per thread
const titleSetCooldown = 5 * 60 * 1000;

export class HelpThreadModule extends Module {
	@listener({ event: 'messageCreate' })
	async onNewQuestion(msg: Message) {
		if (!isHelpChannel(msg.channel)) return;
		if (msg.author.bot) return;
		console.log(
			'Received new question from',
			msg.author,
			'in',
			msg.channel,
		);
		this.updateHelpInfo(msg.channel);
		let thread = await msg.startThread({
			name: `Help ${msg.member?.nickname ?? msg.author.username}`,
			autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
		});
		thread.send(helpThreadWelcomeMessage(msg.member!));
		await HelpThread.create({
			threadId: thread.id,
			ownerId: msg.author.id,
			origMessageId: msg.id,
		}).save();
		console.log(`Created a new help thread for`, msg.author);
	}

	// Used to differentiate automatic archive from bot archive
	manuallyArchivedThreads = new Set<string>();

	@listener({ event: 'threadUpdate' })
	async onThreadReopen(thread: ThreadChannel, ...a: any[]) {
		if (
			!isHelpThread(thread) ||
			!thread.archived ||
			((await thread.fetch()) as ThreadChannel).archived
		)
			return;
		const threadData = (await HelpThread.findOne(thread.id))!;
		if (!threadData.origMessageId) return;
		try {
			const origMessage = await thread.parent.messages.fetch(
				threadData.origMessageId,
			);
			origMessage.reactions
				.resolve(closedEmoji)
				?.users.remove(this.client.user!.id);
		} catch {
			// Asker deleted original message
		}
	}

	@listener({ event: 'threadUpdate' })
	async onThreadExpire(thread: ThreadChannel) {
		if (
			!isHelpThread(thread) ||
			!((await thread.fetch()) as ThreadChannel).archived ||
			this.manuallyArchivedThreads.delete(thread.id)
		)
			return;
		const threadData = (await HelpThread.findOne(thread.id))!;
		console.log(`Help thread expired:`, thread);
		await thread.send({
			content: `<@${threadData.ownerId}>`,
			embeds: [threadExpireEmbed],
		});
		this.manuallyArchivedThreads.add(thread.id);
		await this.archiveThread(thread);
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

		const isOwner = threadData.ownerId === msg.author.id;

		if (
			isOwner ||
			msg.member?.roles.cache.has(trustedRoleId) ||
			msg.member?.permissions.has('MANAGE_MESSAGES')
		) {
			console.log(`Closing help thread:`, thread);
			await msg.react('✅');
			if (!isOwner)
				await msg.channel.send({
					content: `<@${threadData.ownerId}>`,
					embeds: [helperCloseEmbed(msg.member!)],
				});
			this.manuallyArchivedThreads.add(thread.id);
			await this.archiveThread(thread);
		} else {
			return await sendWithMessageOwnership(
				msg,
				':warning: You have to be the asker to close the thread.',
			);
		}
	}

	private async archiveThread(thread: ThreadChannel) {
		await thread.setArchived(true);
		const threadData = (await HelpThread.findOne(thread.id))!;
		if (!threadData.origMessageId) return;
		try {
			const origMessage = await thread.parent!.messages.fetch(
				threadData.origMessageId,
			);
			await origMessage.react(closedEmoji);
		} catch {
			// Asker deleted original message
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
		single: true,
	})
	async helper(msg: Message, comment: string) {
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
			thread.parent.send(
				`<@&${trustedRoleId}> ${msg.channel} ${
					isTrusted ? comment : ''
				}`,
			),
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
			msg.channel.setName(`${username} - ${title}`),
		]);
	}

	@command()
	async htgh(msg: Message) {
		if (!msg.member?.permissions.has('MANAGE_MESSAGES')) return;
		if (
			msg.channel.id !== howToGetHelpChannel &&
			msg.channel.id !== howToGiveHelpChannel
		)
			return;
		(await msg.channel.messages.fetch()).forEach(x => x.delete());
		const embeds =
			msg.channel.id === howToGetHelpChannel
				? howToGetHelpEmbeds()
				: howToGiveHelpEmbeds();
		msg.channel.send({ embeds });
	}
}

export function isHelpChannel(
	channel: Omit<Channel, 'partial'>,
): channel is TextChannel {
	return (
		channel instanceof TextChannel &&
		channel.parentId == helpCategory &&
		channel.id !== howToGetHelpChannel &&
		channel.id !== howToGiveHelpChannel
	);
}

export function isHelpThread(
	channel: Omit<Channel, 'partial'>,
): channel is ThreadChannel & { parent: TextChannel } {
	return channel instanceof ThreadChannel && isHelpChannel(channel.parent!);
}

function listify(text: string) {
	// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
	const indent = '\u200b\u00a0\u00a0\u00a0';
	const bullet = '•';
	return text.replace(/^(\s*)-/gm, `$1${bullet}`).replace(/\t/g, indent);
}
