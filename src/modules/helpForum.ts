import {
	ChannelType,
	ThreadChannel,
	TextChannel,
	Channel,
	ForumChannel,
	Message,
} from 'discord.js';
import { Bot } from '../bot';
import { HelpThread } from '../entities/HelpThread';
import {
	helpForumChannel,
	helpForumOpenTagName,
	helpForumResolvedTagName,
	helpRequestsChannel,
	howToGetHelpChannel,
	howToGiveHelpChannel,
	rolesChannelId,
	timeBeforeHelperPing,
	trustedRoleId,
} from '../env';
import { sendWithMessageOwnership } from '../util/send';

const MAX_TAG_COUNT = 5;

// Use a non-breaking space to force Discord to leave empty lines alone
const postGuidelines = (here = true) =>
	listify(`
**How To Get Help**
- Create a new post ${
		here ? 'here' : `in <#${helpForumChannel}>`
	} with your question.
- It's always ok to just ask your question; you don't need permission.
- Someone will (hopefully!) come along and help you.
- When your question is resolved, type \`!resolved\`.
\u200b
**How To Get Better Help**
- Explain what you want to happen and why…
	- …and what actually happens, and your best guess at why.
	- Include a short code sample and any error messages you got.
- Text is better than screenshots. Start code blocks with \`\`\`ts.
- If possible, create a minimal reproduction in the TypeScript Playground: <https://www.typescriptlang.org/play>.
	- Send the full link in its own message; do not use a link shortener.
- For more tips, check out StackOverflow's guide on asking good questions: <https://stackoverflow.com/help/how-to-ask>
\u200b
**If You Haven't Gotten Help**
Usually someone will try to answer and help solve the issue within a few hours. If not, and if you have followed the bullets above, you can ping helpers by running !helper.
`);

const howToGiveHelp = listify(`
**How To Give Help**
- The channel sidebar on the left will list posts you have joined.
- You can scroll through the channel to see all recent questions.

**How To Give *Better* Help**
- Get yourself the <@&${trustedRoleId}> role at <#${rolesChannelId}>
	- (If you don't like the pings, you can disable role mentions for the server.)
- As a <@&${trustedRoleId}>, you can:
	- React to a help post to add tags.
	- If a post appears to be resolved, run \`!resolved\` to mark it as such.
		- *Only do this if the asker has indicated that their question has been resolved.*
	- Conversely, you can run \`!reopen\` if the asker has follow-up questions.

**Useful Snippets**
- \`!screenshot\` — for if an asker posts a screenshot of code
- \`!ask\` — for if an asker only posts "can I get help?"
`);

const helperResolve = (owner: string, helper: string) => `
<@${owner}>
Because your issue seemed to be resolved, this post was marked as resolved by <@${helper}>.
If your issue is not resolved, **you can reopen this post by running \`!reopen\`**.
*If you have a different question, make a new post in <#${helpForumChannel}>.*
`;

export async function helpForumModule(bot: Bot) {
	const channel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpForumChannel)!;
	if (channel?.type !== ChannelType.GuildForum) {
		console.error(`Expected ${helpForumChannel} to be a forum channel.`);
		return;
	}
	const forumChannel = channel;
	const openTag = getTag(forumChannel, helpForumOpenTagName);
	const resolvedTag = getTag(forumChannel, helpForumResolvedTagName);

	const helpRequestChannel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpRequestsChannel)!;
	if (!helpRequestChannel?.isTextBased()) {
		console.error(`Expected ${helpRequestChannel} to be a text channel.`);
		return;
	}

	await forumChannel.setTopic(postGuidelines());

	bot.client.on('threadCreate', async thread => {
		const owner = await thread.fetchOwner();
		if (!owner?.user || !isHelpThread(thread)) return;
		console.log(
			'Received new question from',
			owner.user.tag,
			'in thread',
			thread.id,
		);

		await HelpThread.create({
			threadId: thread.id,
			ownerId: owner.user.id,
		}).save();

		await setStatus(thread, openTag);
	});

	bot.client.on('threadDelete', async thread => {
		if (!isHelpThread(thread)) return;
		await HelpThread.delete({
			threadId: thread.id,
		});
	});

	bot.registerCommand({
		aliases: ['helper', 'helpers'],
		description: 'Help System: Ping the @Helper role from a help post',
		async listener(msg, comment) {
			if (!isHelpThread(msg.channel)) {
				return sendWithMessageOwnership(
					msg,
					':warning: You may only ping helpers from a help post',
				);
			}

			const thread = msg.channel;
			const threadData = await getHelpThread(thread.id);

			// Ensure the user has permission to ping helpers
			const isAsker = msg.author.id === threadData.ownerId;
			const isTrusted = bot.isTrusted(msg);

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

			const tagStrings = thread.appliedTags.flatMap(t => {
				const tag = forumChannel.availableTags.find(at => at.id === t);
				if (!tag) return [];
				if (!tag.emoji) return tag.name;

				const emoji = tag.emoji.id
					? `<:${tag.emoji.name}:${tag.emoji.id}>`
					: tag.emoji.name;
				return `${emoji} ${tag.name}`;
			});
			const tags = tagStrings ? `(${tagStrings.join(', ')})` : '';

			// The beacons are lit, Gondor calls for aid
			await Promise.all([
				helpRequestChannel.send(
					`<@&${trustedRoleId}> ${msg.channel} ${tags} ${
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

	bot.registerCommand({
		aliases: ['resolved', 'resolve', 'close', 'closed', 'done'],
		description: 'Help System: Mark a post as resolved',
		async listener(msg) {
			changeStatus(msg, true);
		},
	});

	bot.registerCommand({
		aliases: ['reopen', 'open', 'unresolved', 'unresolve'],
		description: 'Help System: Reopen a resolved post',
		async listener(msg) {
			changeStatus(msg, false);
		},
	});

	bot.client.on('messageReactionAdd', async reaction => {
		const message = reaction.message;
		const thread = await message.channel.fetch();
		if (!isHelpThread(thread)) {
			return;
		}
		const initial = await thread.fetchStarterMessage();
		if (initial?.id !== message.id) return;
		const tag = forumChannel.availableTags.find(
			t =>
				t.emoji &&
				!t.moderated &&
				t.emoji.id === reaction.emoji.id &&
				t.emoji.name === reaction.emoji.name,
		);
		if (!tag) return;
		if (thread.appliedTags.length < MAX_TAG_COUNT) {
			await thread.setAppliedTags([...thread.appliedTags, tag.id]);
		}
		await reaction.remove();
	});

	async function changeStatus(msg: Message, resolved: boolean) {
		const thread = msg.channel;
		if (thread?.type !== ChannelType.PublicThread) {
			return sendWithMessageOwnership(
				msg,
				':warning: Can only be run in a help post',
			);
		}

		const threadData = await getHelpThread(thread.id);
		const isAsker = msg.author.id === threadData.ownerId;
		const isTrusted = bot.isTrusted(msg);

		if (!isAsker && !isTrusted) {
			return sendWithMessageOwnership(
				msg,
				':warning: Only the asker can change the status of a help post',
			);
		}

		await setStatus(thread, resolved ? resolvedTag : openTag);
		await msg.react('✅');

		if (resolved && !isAsker) {
			await thread.send(helperResolve(thread.ownerId!, msg.author.id));
		}
	}

	bot.registerAdminCommand({
		aliases: ['htgh'],
		async listener(msg) {
			if (
				msg.channel.id !== howToGetHelpChannel &&
				msg.channel.id !== howToGiveHelpChannel
			) {
				return;
			}
			(await msg.channel.messages.fetch()).forEach(x => x.delete());
			const message =
				msg.channel.id === howToGetHelpChannel
					? postGuidelines(false)
					: howToGiveHelp;
			// Force a blank line at the beginning of the message for compact-mode users
			msg.channel.send(`** **\n` + message.trim());
		},
	});

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

	function getTag(channel: ForumChannel, name: string) {
		const tag = channel.availableTags.find(x => x.name === name);
		if (!tag) throw new Error(`Could not find tag ${name}`);
		return tag.id;
	}

	async function setStatus(thread: ThreadChannel, tag: string) {
		let tags = thread.appliedTags.filter(
			x => x !== openTag && x !== resolvedTag,
		);
		if (tags.length === MAX_TAG_COUNT) {
			tags = tags.slice(0, -1);
		}
		await thread.setAppliedTags([tag, ...tags]);
	}
}

function listify(text: string) {
	// A zero-width space (necessary to prevent discord from trimming the leading whitespace), followed by a three non-breaking spaces.
	const indent = '\u200b\u00a0\u00a0\u00a0';
	const bullet = '•';
	return text.replace(/^(\s*)-/gm, `$1${bullet}`).replace(/\t/g, indent);
}
