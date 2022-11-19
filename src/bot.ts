import { Message, Client, User, GuildMember } from 'discord.js';
import { prefixes, trustedRoleId } from './env';

export interface CommandRegistration {
	aliases: string[];
	description?: string;
	listener: (msg: Message, content: string) => Promise<void>;
}

export class Bot {
	commands: CommandRegistration[] = [];
	adminCommands: CommandRegistration[] = [];

	constructor(public client: Client<true>) {
		client.on('messageCreate', msg => {
			const triggerWithPrefix = msg.content.split(/\s/)[0];
			const matchingPrefix = prefixes.find(p =>
				triggerWithPrefix.startsWith(p),
			);
			if (matchingPrefix) {
				const content = msg.content
					.substring(triggerWithPrefix.length + 1)
					.trim();
				this.getByTrigger(
					triggerWithPrefix.substring(matchingPrefix.length),
				)
					?.listener(msg, content)
					.catch(err => {
						this.client.emit('error', err);
					});
			}
		});
	}

	registerCommand(command: CommandRegistration) {
		this.commands.push(command);
	}

	registerAdminCommand(command: CommandRegistration) {
		this.adminCommands.push(command);
	}

	getByTrigger(trigger: string): CommandRegistration | undefined {
		const match = (c: CommandRegistration) => c.aliases.includes(trigger);
		return this.commands.find(match) || this.adminCommands.find(match);
	}

	isMod(member: GuildMember | null) {
		return member?.permissions.has('ManageMessages') ?? false;
	}

	getTrustedMemberError(msg: Message) {
		if (!msg.guild || !msg.member || !msg.channel.isTextBased()) {
			return ":warning: you can't use that command here.";
		}

		if (
			!msg.member.roles.cache.has(trustedRoleId) &&
			!msg.member.permissions.has('ManageMessages')
		) {
			return ":warning: you don't have permission to use that command.";
		}
	}

	async getTargetUser(msg: Message): Promise<User | undefined> {
		const query = msg.content.split(/\s/)[1];

		const mentioned = msg.mentions.members?.first()?.user;
		if (mentioned) return mentioned;

		if (query) {
			// Search by ID
			const queriedUser = await this.client.users
				.fetch(query)
				.catch(() => undefined);
			if (queriedUser) return queriedUser;

			// Search by name, likely a better way to do this...
			for (const user of this.client.users.cache.values()) {
				if (user.tag === query || user.username === query) {
					return user;
				}
			}
		}
	}
}
