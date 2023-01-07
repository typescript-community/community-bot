import { Message, Client, User, GuildMember } from 'discord.js';
import { botAdmins, prefixes, trustedRoleId } from './env';

export interface CommandRegistration {
	aliases: string[];
	description?: string;
	listener: (msg: Message, content: string) => Promise<void>;
}

interface Command {
	admin: boolean;
	aliases: string[];
	description?: string;
	listener: (msg: Message, content: string) => Promise<void>;
}

export class Bot {
	commands = new Map<string, Command>();

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

				const command = this.getByTrigger(
					triggerWithPrefix.substring(matchingPrefix.length),
				);

				if (!command || (command.admin && !this.isAdmin(msg.author))) {
					return;
				}
				command.listener(msg, content).catch(err => {
					this.client.emit('error', err);
				});
			}
		});
	}

	registerCommand(registration: CommandRegistration) {
		const command: Command = {
			...registration,
			admin: false,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	registerAdminCommand(registration: CommandRegistration) {
		const command: Command = {
			...registration,
			admin: true,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	getByTrigger(trigger: string): Command | undefined {
		return this.commands.get(trigger);
	}

	isMod(member: GuildMember | null) {
		return member?.permissions.has('ManageMessages') ?? false;
	}

	isAdmin(user: User) {
		return botAdmins.includes(user.id);
	}

	isTrusted(msg: Message) {
		if (!msg.guild || !msg.member || !msg.channel.isTextBased()) {
			return false;
		}

		if (
			!msg.member.roles.cache.has(trustedRoleId) &&
			!msg.member.permissions.has('ManageMessages')
		) {
			return false;
		}

		return true;
	}

	async getTargetUser(msg: Message): Promise<User | undefined> {
		const query = msg.content.split(/\s/)[1];

		const mentioned = msg.mentions.members?.first()?.user;
		if (mentioned) return mentioned;

		if (!query) return;

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
