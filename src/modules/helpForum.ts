import {
	ChannelType,
	User,
	GuildMember,
	EmbedBuilder,
	ThreadChannel,
	TextChannel,
	Channel,
	ThreadAutoArchiveDuration,
} from 'discord.js';
import { Bot } from '../bot';
import { HelpThread } from '../entities/HelpThread';
import {
	BLOCKQUOTE_GREY,
	helpForumChannel,
	helpRequestsChannel,
	howToGetHelpChannel,
	howToGiveHelpChannel,
	rolesChannelId,
	timeBeforeHelperPing,
	trustedRoleId,
} from '../env';
import { sendWithMessageOwnership } from '../util/send';

const threadExpireHours = ThreadAutoArchiveDuration.OneDay;
const threadCheckInterval = 60 * 60 * 1000;

// Use a non-breaking space to force Discord to leave empty lines alone
const postGuidelines = listify(`
How To Get Help
- Create a new post here with your question
	- It's always ok to just ask your question; you don't need permission.
- Someone will (hopefully!) come along and help you.
- When your question is resolved, type !close.
\u200b
How To Get Better Help
- Explain what you want to happen and why…
	- …and what actually happens, and your best guess at why.
	- Include a short code sample and any error messages you got.
- Text is better than screenshots. Start code blocks with \`\`\`ts.
- If possible, create a minimal reproduction in the TypeScript Playground: <https://www.typescriptlang.org/play>.
	- Send the full link in its own message; do not use a link shortener.
- For more tips, check out StackOverflow's guide on asking good questions: <https://stackoverflow.com/help/how-to-ask>
\u200b
If You Haven't Gotten Help
Usually someone will try to answer and help solve the issue within a few hours. If not, and if you have followed the bullets above, you can ping helpers by running !helper.
`);

const howToGiveHelp = listify(`
How To Give Help
- The channel sidebar on the left will list threads you have joined.
- You can scroll through the channel to see all recent questions.

How To Give *Better* Help
- Get yourself the <@&${trustedRoleId}> role at <#${rolesChannelId}>
	- (If you don't like the pings, you can disable role mentions for the server.)
- As a <@&${trustedRoleId}>, if a thread appears to be resolved, run \`!close\` to close it.
	- *Only do this if the asker has indicated that their question has been resolved.*

Useful Snippets
- \`!screenshot\` — for if an asker posts a screenshot of code
- \`!ask\` — for if an asker only posts "can I get help?"
`);

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

*If you have a different question, create a new post in <#${helpForumChannel}>.*
`);

const helpPostWelcomeMessage = (owner: User) => `
${owner} this thread is for your question. \
When it's resolved, please type \`!close\`. \
See <#${howToGetHelpChannel}> for info on how to get better help.
`;

export async function helpForumModule(bot: Bot) {
	const manuallyArchivedThreads = new Set<string>();

	const channel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpForumChannel)!;
	if (channel?.type !== ChannelType.GuildForum) {
		console.error(`Expected ${helpForumChannel} to be a forum channel.`);
		return;
	}
	const forumChannel = channel;

	const helpRequestChannel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpRequestsChannel)!;
	if (!helpRequestChannel?.isTextBased()) {
		console.error(`Expected ${helpRequestChannel} to be a text channel.`);
		return;
	}

	await forumChannel.setTopic(postGuidelines);

	bot.client.on('threadCreate', async thread => {
		const owner = await thread.fetchOwner();
		if (!owner?.user || !isHelpThread(thread)) return;
		console.log(
			'Received new question from',
			owner.user.tag,
			'in thread',
			thread.id,
		);
		thread.send(helpPostWelcomeMessage(owner.user));

		await HelpThread.create({
			threadId: thread.id,
			ownerId: owner.user.id,
		}).save();
	});

	bot.client.on('threadUpdate', async thread => {
		if (
			!isHelpThread(thread) ||
			!(await thread.fetch()).archived ||
			manuallyArchivedThreads.delete(thread.id)
		) {
			return;
		}
		await onThreadExpire(thread);
	});

	bot.client.on('threadDelete', async thread => {
		if (!isHelpThread(thread)) return;
		await HelpThread.delete({
			threadId: thread.id,
		});
	});

	bot.registerCommand({
		aliases: ['close', 'closed', 'resolved', 'resolve', 'done', 'solved'],
		description: 'Help System: Close an active help thread',
		async listener(msg) {
			if (
				msg.channel.type !== ChannelType.PublicThread ||
				msg.channel.parentId !== forumChannel.id
			) {
				return await sendWithMessageOwnership(
					msg,
					':warning: This can only be run in a help thread',
				);
			}

			const threadData = await getHelpThread(msg.channel.id);

			const isOwner = threadData.ownerId === msg.author.id;

			if (
				isOwner ||
				msg.member?.roles.cache.has(trustedRoleId) ||
				bot.isMod(msg.member)
			) {
				console.log(`Closing help thread:`, msg.channel);
				await msg.react('✅');
				if (!isOwner)
					await msg.channel.send({
						content: `<@${threadData.ownerId}>`,
						embeds: [helperCloseEmbed(msg.member!)],
					});
				manuallyArchivedThreads.add(msg.channelId);
				await msg.channel?.setArchived(true);
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
			const threadData = await getHelpThread(thread.id);

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
				helpRequestChannel.send(
					`<@&${trustedRoleId}> ${msg.channel} ${
						isTrusted ? comment : ''
					}`,
				),
				msg.react('✅'),
				HelpThread.update(thread.id, {
					helperTimestamp: Date.now().toString(),
				}),
			]);
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
			const message =
				msg.channel.id === howToGetHelpChannel
					? postGuidelines
					: howToGiveHelp;
			msg.channel.send(message);
		},
	});

	setInterval(async () => {
		const threads = await forumChannel.threads.fetchActive();
		for (const thread of threads.threads.values()) {
			const time =
				Date.now() -
				(await thread.messages.fetch({ limit: 1 })).first()!
					.createdTimestamp;
			if (time >= threadExpireHours * 60 * 1000) {
				onThreadExpire(thread).catch(console.error);
			}
		}
	}, threadCheckInterval);

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
		await thread.setArchived(true);
	}

	async function getHelpThread(threadId: string) {
		const threadData = await HelpThread.findOneBy({ threadId });

		if (!threadData) {
			// Thread was created when the bot was down.
			const thread = await forumChannel.threads.fetch(threadId);
			if (!thread) {
				throw new Error('Not a forum thread ID');
			}
			return await HelpThread.create({
				threadId,
				ownerId: thread.ownerId!,
			}).save();
		}

		return threadData;
	}

	function isHelpThread(
		channel: ThreadChannel | Channel,
	): channel is ThreadChannel & { parent: TextChannel } {
		return (
			channel instanceof ThreadChannel &&
			channel.parent?.id === forumChannel.id
		);
	}
}

function listify(text: string) {
	// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
	const indent = '\u200b\u00a0\u00a0\u00a0';
	const bullet = '•';
	return text.replace(/^(\s*)-/gm, `$1${bullet}`).replace(/\t/g, indent);
}
