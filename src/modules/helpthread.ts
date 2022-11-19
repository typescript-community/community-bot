import {
	ThreadAutoArchiveDuration,
	TextChannel,
	ThreadChannel,
	EmbedBuilder,
	GuildMember,
	MessageType,
	Channel,
} from 'discord.js';
import { Bot } from '../bot';
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
import { sendWithMessageOwnership } from '../util/send';

const threadExpireEmbed = new EmbedBuilder()
	.setColor(BLOCKQUOTE_GREY)
	.setTitle('This help thread expired.').setDescription(`
If your question was not resolved, you can make a new thread by simply asking your question again. \
Consider rephrasing the question to maximize your chance of getting a good answer. \
If you're not sure how, have a look through [StackOverflow's guide on asking a good question](https://stackoverflow.com/help/how-to-ask).
`);

const helperCloseEmbed = (member: GuildMember) =>
	new EmbedBuilder().setColor(BLOCKQUOTE_GREY).setDescription(`
Because your issue seemed to be resolved, this thread was closed by ${member}.

If your issue is not resolved, **you can post another message here and the thread will automatically re-open**.

*If you have a different question, just ask in <#${generalHelpChannel}>.*
`);

const closedEmoji = '☑️';

const helpInfo = (channel: TextChannel) =>
	new EmbedBuilder()
		.setColor(GREEN)
		.setDescription(channel.topic ?? 'Ask your questions here!');

const howToGetHelpEmbeds = () => [
	new EmbedBuilder()
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
	new EmbedBuilder()
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
	new EmbedBuilder()
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
	new EmbedBuilder()
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
	new EmbedBuilder()
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
	new EmbedBuilder()
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

const threadExpireHours = ThreadAutoArchiveDuration.OneDay;
const threadCheckInterval = 60 * 60 * 1000;

export function helpThreadModule(bot: Bot) {
	const { client } = bot;

	const helpInfoLocks = new Map<string, Promise<void>>();
	const manuallyArchivedThreads = new Set<string>();

	client.on('messageCreate', async msg => {
		if (!isHelpChannel(msg.channel)) return;
		if (msg.author.bot) return;
		console.log(
			'Received new question from',
			msg.author,
			'in',
			msg.channel,
		);
		updateHelpInfo(msg.channel);
		let thread = await msg.startThread({
			name: `Help ${msg.member?.nickname ?? msg.author.username}`,
			autoArchiveDuration: threadExpireHours,
		});
		thread.send(helpThreadWelcomeMessage(msg.member!));
		await HelpThread.create({
			threadId: thread.id,
			ownerId: msg.author.id,
			origMessageId: msg.id,
		}).save();
		console.log(`Created a new help thread for`, msg.author);
	});

	client.on('threadUpdate', async thread => {
		if (
			!isHelpThread(thread) ||
			!thread.archived ||
			((await thread.fetch()) as ThreadChannel).archived
		)
			return;
		const threadData = (await HelpThread.findOneBy({
			threadId: thread.id,
		}))!;
		if (!threadData.origMessageId) return;
		try {
			const origMessage = await thread.parent.messages.fetch(
				threadData.origMessageId,
			);
			origMessage.reactions
				.resolve(closedEmoji)
				?.users.remove(client.user.id);
		} catch {
			// Asker deleted original message
		}
	});

	checkThreads();
	function checkThreads() {
		setTimeout(checkThreads, threadCheckInterval);
		bot.client.guilds.cache.forEach(guild => {
			guild.channels.cache.forEach(async channel => {
				if (!isHelpChannel(channel)) return;
				const threads = await channel.threads.fetchActive();
				threads.threads.forEach(async thread => {
					const time =
						Date.now() -
						(await thread.messages.fetch({ limit: 1 })).first()!
							.createdTimestamp;
					if (time >= threadExpireHours * 60 * 1000) {
						onThreadExpire(thread).catch(console.error);
					}
				});
			});
		});
	}

	client.on('threadUpdate', async thread => {
		if (
			!isHelpThread(thread) ||
			!(await thread.fetch()).archived ||
			manuallyArchivedThreads.delete(thread.id)
		)
			return;
		await onThreadExpire(thread);
	});

	client.on('messageCreate', msg => {
		if (
			isHelpChannel(msg.channel) &&
			msg.type === MessageType.ChannelPinnedMessage
		) {
			msg.delete();
		}
	});

	bot.registerCommand({
		aliases: ['close', 'closed', 'resolved', 'resolve', 'done', 'solved'],
		description: 'Help System: Close an active help thread',
		async listener(msg) {
			if (!isHelpThread(msg.channel))
				return await sendWithMessageOwnership(
					msg,
					':warning: This can only be run in a help thread',
				);

			let thread: ThreadChannel = msg.channel;
			const threadData = (await HelpThread.findOneBy({
				threadId: thread.id,
			}))!;

			const isOwner = threadData.ownerId === msg.author.id;

			if (
				isOwner ||
				msg.member?.roles.cache.has(trustedRoleId) ||
				bot.isMod(msg.member)
			) {
				console.log(`Closing help thread:`, thread);
				await msg.react('✅');
				if (!isOwner)
					await msg.channel.send({
						content: `<@${threadData.ownerId}>`,
						embeds: [helperCloseEmbed(msg.member!)],
					});
				manuallyArchivedThreads.add(thread.id);
				await archiveThread(thread);
			} else {
				return await sendWithMessageOwnership(
					msg,
					':warning: You have to be the asker to close the thread.',
				);
			}
		},
	});

	bot.registerCommand({
		aliases: ['helper', 'helpers'],
		description: 'Help System: Ping the @Helper role from a help thread',
		async listener(msg, comment) {
			if (!isHelpThread(msg.channel)) {
				return sendWithMessageOwnership(
					msg,
					':warning: You may only ping helpers from a help thread',
				);
			}

			const thread = msg.channel;
			const threadData = (await HelpThread.findOneBy({
				threadId: thread.id,
			}))!;

			// Ensure the user has permission to ping helpers
			const isAsker = msg.author.id === threadData.ownerId;
			const isTrusted = bot.getTrustedMemberError(msg) === undefined; // No error if trusted

			if (!isAsker && !isTrusted) {
				return sendWithMessageOwnership(
					msg,
					':warning: Only the asker can ping helpers',
				);
			}

			const askTime = thread.createdTimestamp;
			const pingAllowedAfter =
				+(threadData.helperTimestamp ?? askTime ?? Date.now()) +
				timeBeforeHelperPing;

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
				thread.parent!.send(
					`<@&${trustedRoleId}> ${msg.channel} ${
						isTrusted ? comment : ''
					}`,
				),
				updateHelpInfo(thread.parent!),
				msg.react('✅'),
				HelpThread.update(thread.id, {
					helperTimestamp: Date.now().toString(),
				}),
			]);
		},
	});

	bot.registerCommand({
		aliases: ['title'],
		description: 'Help System: Rename a help thread',
		async listener(msg, title) {
			const m = /^<#(\d+)>\s*([^]*)/.exec(title);
			let thread: Omit<Channel, 'partial'> | undefined = msg.channel;
			if (m) {
				thread = msg.guild?.channels.cache.get(m[1])!;
				title = m[2];
			}
			if (!thread || !isHelpThread(thread))
				return sendWithMessageOwnership(
					msg,
					':warning: This can only be run in a help thread',
				);
			if (!title)
				return sendWithMessageOwnership(msg, ':warning: Missing title');
			const threadData = (await HelpThread.findOneBy({
				threadId: thread.id,
			}))!;
			if (
				msg.author.id !== threadData.ownerId &&
				!msg.member!.roles.cache.has(trustedRoleId)
			) {
				return sendWithMessageOwnership(
					msg,
					':warning: Only the asker and helpers can set the title',
				);
			}

			const titleSetAllowedAfter =
				+(threadData.titleSetTimestamp ?? 0) + titleSetCooldown;
			if (
				threadData.titleSetTimestamp &&
				Date.now() < titleSetAllowedAfter
			) {
				return sendWithMessageOwnership(
					msg,
					`:warning: You can set the title again <t:${Math.ceil(
						titleSetAllowedAfter / 1000,
					)}:R>`,
				);
			}

			const owner = await msg.guild!.members.fetch(threadData.ownerId);
			const username = owner.nickname ?? owner.user.username;
			await Promise.all([
				HelpThread.update(thread.id, {
					titleSetTimestamp: Date.now() + '',
				}),
				// Truncate if longer than 100, the max thread title length
				thread.setName(`${username} - ${title}`.slice(0, 100)),
			]);
			if (thread !== msg.channel) {
				await msg.react('✅');
			}
		},
	});

	bot.registerAdminCommand({
		aliases: ['htgh'],
		async listener(msg) {
			if (!bot.isMod(msg.member)) return;
			if (
				msg.channel.id !== howToGetHelpChannel &&
				msg.channel.id !== howToGiveHelpChannel
			) {
				return;
			}
			(await msg.channel.messages.fetch()).forEach(x => x.delete());
			const embeds =
				msg.channel.id === howToGetHelpChannel
					? howToGetHelpEmbeds()
					: howToGiveHelpEmbeds();
			msg.channel.send({ embeds });
		},
	});

	async function onThreadExpire(thread: ThreadChannel) {
		const threadData = (await HelpThread.findOneBy({
			threadId: thread.id,
		}))!;
		console.log(`Help thread expired:`, thread);
		await thread.send({
			content: `<@${threadData.ownerId}>`,
			embeds: [threadExpireEmbed],
		});
		manuallyArchivedThreads.add(thread.id);
		await archiveThread(thread);
	}

	function updateHelpInfo(channel: TextChannel) {
		helpInfoLocks.set(
			channel.id,
			(helpInfoLocks.get(channel.id) ?? Promise.resolve()).then(
				async () => {
					await Promise.all([
						...(
							await channel.messages.fetchPinned()
						).map(x => x.delete()),
						channel
							.send({ embeds: [helpInfo(channel)] })
							.then(x => x.pin()),
					]);
				},
			),
		);
	}

	async function archiveThread(thread: ThreadChannel) {
		await thread.setArchived(true);
		const threadData = (await HelpThread.findOneBy({
			threadId: thread.id,
		}))!;
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
}

export function isHelpChannel(channel: unknown): channel is TextChannel {
	return (
		channel instanceof TextChannel &&
		channel.parentId == helpCategory &&
		channel.id !== howToGetHelpChannel &&
		channel.id !== howToGiveHelpChannel
	);
}

export function isHelpThread(
	channel: unknown,
): channel is ThreadChannel & { parent: TextChannel } {
	return channel instanceof ThreadChannel && isHelpChannel(channel.parent!);
}

function listify(text: string) {
	// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
	const indent = '\u200b\u00a0\u00a0\u00a0';
	const bullet = '•';
	return text.replace(/^(\s*)-/gm, `$1${bullet}`).replace(/\t/g, indent);
}
