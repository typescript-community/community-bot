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
import { LOCALIZATION } from '../index';

const MAX_TAG_COUNT = 5;

// Use a non-breaking space to force Discord to leave empty lines alone
const postGuidelines = (here = true) =>
	listify(
		LOCALIZATION.getLocalizedText('forum_how_to_get_help', {
			post: here ? 'here' : `in <#${helpForumChannel}>`,
		}),
	);

const howToGiveHelp = listify(
	LOCALIZATION.getLocalizedText('how_to_give_help', {
		channel: `<#${rolesChannelId}>`,
		trusted: `<@&${trustedRoleId}>`,
	}),
);

const helperResolve = (owner: string, helper: string) =>
	LOCALIZATION.getLocalizedText('helper_resolve', {
		owner: `<@${owner}>`,
		helper: `<@${helper}>`,
		channel: `<#${helpForumChannel}>`,
	});

export async function helpForumModule(bot: Bot) {
	const channel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpForumChannel)!;
	if (channel?.type !== ChannelType.GuildForum) {
		console.error(
			LOCALIZATION.getLocalizedText('to_be_forum_channel', {
				channel: helpForumChannel,
			}),
		);
		return;
	}
	const forumChannel = channel;
	const openTag = getTag(forumChannel, helpForumOpenTagName);
	const resolvedTag = getTag(forumChannel, helpForumResolvedTagName);

	const helpRequestChannel = await bot.client.guilds.cache
		.first()
		?.channels.fetch(helpRequestsChannel)!;
	if (!helpRequestChannel?.isTextBased()) {
		console.error(
			LOCALIZATION.getLocalizedText('to_be_text_channel', {
				channel: helpRequestChannel,
			}),
		);
		return;
	}

	await forumChannel.setTopic(postGuidelines());

	bot.client.on('threadCreate', async thread => {
		const owner = await thread.fetchOwner();
		if (!owner?.user || !isHelpThread(thread)) return;
		console.log(
			LOCALIZATION.getLocalizedText('new_request', {
				owner: owner.user.tag,
				thread: thread.id,
			}),
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
		description: LOCALIZATION.getLocalizedText(
			'helpers_command.description',
		),
		async listener(msg, comment) {
			if (!isHelpThread(msg.channel)) {
				return sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'helpers_command.listener.not_help_channel',
					),
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
					LOCALIZATION.getLocalizedText(
						'helpers_command.listener.only_asker',
					),
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
					LOCALIZATION.getLocalizedText(
						'helpers_command.listener.pls_wait',
						{
							time: `<t:${Math.ceil(
								pingAllowedAfter / 1000,
							)}:R>.`,
						},
					),
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
		aliases: ['resolved', 'resolve', 'close', 'closed', 'done', 'solved'],
		description: LOCALIZATION.getLocalizedText(
			'resolved_command.description',
		),
		async listener(msg) {
			changeStatus(msg, true);
		},
	});

	bot.registerCommand({
		aliases: ['reopen', 'open', 'unresolved', 'unresolve'],
		description: LOCALIZATION.getLocalizedText(
			'reopen_command.description',
		),
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
		if (!isHelpThread(thread)) {
			return sendWithMessageOwnership(
				msg,
				LOCALIZATION.getLocalizedText('change_status.not_help_thread'),
			);
		}

		const threadData = await getHelpThread(thread.id);
		const isAsker = msg.author.id === threadData.ownerId;
		const isTrusted = bot.isTrusted(msg);

		if (!isAsker && !isTrusted) {
			return sendWithMessageOwnership(
				msg,
				LOCALIZATION.getLocalizedText('change_status.only_asker'),
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
