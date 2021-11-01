import { command, Module, listener } from 'cookiecord';
import { ThreadAutoArchiveDuration } from 'discord-api-types';
import { Message, TextChannel, Channel, ThreadChannel } from 'discord.js';
import { trustedRoleId, helpCategory, timeBeforeHelperPing } from '../env';
import { isTrustedMember } from '../util/inhibitors';

const PINGED_HELPER_MESSAGE = '✅ Pinged helpers';

export class HelpThreadModule extends Module {
	@listener({ event: 'threadCreate' })
	async onNewThread(thread: ThreadChannel) {
		if (!this.isHelpThread(thread)) return;
		this.fixThreadExpiry(thread);
	}
	@listener({ event: 'threadUpdate' })
	async onThreadUpdated(thread: ThreadChannel) {
		if (!this.isHelpThread(thread)) return;
		this.fixThreadExpiry((await thread.fetch()) as ThreadChannel);
	}

	private async fixThreadExpiry(thread: ThreadChannel) {
		if (thread.autoArchiveDuration !== ThreadAutoArchiveDuration.OneDay)
			await thread.setAutoArchiveDuration(
				ThreadAutoArchiveDuration.OneDay,
			);
	}

	private isHelpThread(
		channel: Omit<Channel, 'partial'>,
	): channel is ThreadChannel & { parent: TextChannel } {
		return (
			channel instanceof ThreadChannel &&
			channel.parent instanceof TextChannel &&
			channel.parent.parentId == helpCategory
		);
	}

	@command({
		description: 'Pings a helper in a help-thread',
		aliases: ['helpers'],
	})
	async helper(msg: Message) {
		if (!this.isHelpThread(msg.channel)) {
			return msg.channel.send(
				':warning: You may only ping helpers from a help thread',
			);
		}

		const thread = msg.channel;

		// Ensure the user has permission to ping helpers
		const isAsker = thread.ownerId === msg.author.id;
		const isTrusted =
			(await isTrustedMember(msg, this.client)) === undefined; // No error if trusted

		if (!isAsker && !isTrusted) {
			return msg.channel.send(
				':warning: Only the asker can ping helpers',
			);
		}

		const askTime = thread.createdTimestamp;
		// Find the last time helpers were called, to avoid multiple successive !helper pings.
		// It's possible that the last helper ping would not be within the most recent 20 messages,
		// while still being more recent than allowed, but in that case the person has likely already
		// recieved help, so them asking for further help is less likely to be spammy.
		const lastHelperPing = (
			await thread.messages.fetch({ limit: 20 })
		).find(
			msg =>
				msg.author.id === this.client.user!.id &&
				msg.content === PINGED_HELPER_MESSAGE,
		)?.createdTimestamp;
		const pingAllowedAfter =
			(lastHelperPing ?? askTime) + timeBeforeHelperPing;

		// Ensure they've waited long enough
		// Trusted members (who aren't the asker) are allowed to disregard the timeout
		if (isAsker && Date.now() < pingAllowedAfter) {
			return msg.channel.send(
				`:warning: Please wait a bit longer. You can ping helpers <t:${Math.ceil(
					pingAllowedAfter / 1000,
				)}:R>.`,
			);
		}

		// The beacons are lit, Gondor calls for aid
		thread.parent.send(`<@&${trustedRoleId}> ${msg.channel}`);
		thread.send(PINGED_HELPER_MESSAGE);
	}
}
