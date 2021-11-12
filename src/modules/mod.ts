import { default as CookiecordClient, Module, listener } from 'cookiecord';
import { Message, Snowflake, User } from 'discord.js';
import { rulesChannelId } from '../env';

// Most job posts are in this format:
// > [FOR HIRE][REMOTE][SOMETHING ELSE]
// > Hi, I'm ponyman6000. Hire me!
const jobPostRegex = /^(?:\[[A-Z ]+\]){2,}\n/i;

const SPAM_CHANNEL_THRESHOLD = 3;
const SPAM_MAX_TIME = 5000;

interface RecentMessageInfo {
	author: User;
	firstPost: Date;
	channels: Set<Snowflake>;
	messages: Message[];
}
const recentMessages = new Map<string, RecentMessageInfo>();
const CLEANUP_RECENT_MESSAGES_MAP_INTERVAL = 10000;

export class ModModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'message' })
	async onJobMessage(msg: Message) {
		if (msg.author.bot || !jobPostRegex.test(msg.content)) return;
		await msg.delete();
		await msg.channel.send(
			`${msg.author} We don't do job posts here; see <#${rulesChannelId}>`,
		);
	}

	@listener({ event: 'message' })
	async onRepeatedMessage(msg: Message) {
		if (!msg.guild || msg.author.id === this.client.user!.id) return;
		const messageIdentifier = msg.content.trim().toLowerCase();
		if (!messageIdentifier) return;
		let recentMessageInfo = recentMessages.get(messageIdentifier);
		if (
			recentMessageInfo &&
			recentMessageInfo.author.id === msg.author.id &&
			+recentMessageInfo.firstPost + SPAM_MAX_TIME > Date.now()
		) {
			recentMessageInfo.channels.add(msg.channel.id);
			recentMessageInfo.messages.push(msg);
			if (recentMessageInfo.channels.size >= SPAM_CHANNEL_THRESHOLD) {
				await Promise.all([
					msg.guild.members
						.fetch(msg.author)
						.then(member => void member.kick('Spam')),
					...recentMessageInfo.messages.map(msg => void msg.delete()),
				]);
			}
		} else {
			recentMessages.set(messageIdentifier, {
				author: msg.author,
				firstPost: new Date(),
				channels: new Set([msg.channel.id]),
				messages: [msg],
			});
		}
	}
}

setInterval(() => {
	for (const [messageText, recentMessageInfo] of recentMessages) {
		if (+recentMessageInfo.firstPost + SPAM_MAX_TIME < Date.now()) {
			recentMessages.delete(messageText);
		}
	}
}, CLEANUP_RECENT_MESSAGES_MAP_INTERVAL);
