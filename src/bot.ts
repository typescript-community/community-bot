import {
	Client,
	User,
	GuildMember,
	ChatInputCommandInteraction,
	ApplicationCommandOptionData,
	Interaction,
	Collection,
	ApplicationCommandType,
	PermissionFlagsBits,
} from 'discord.js';
import { botAdmins, trustedRoleId } from './env';

export interface CommandRegistration<Type extends ApplicationCommandType> {
	aliases: string[];
	description: string;
	options?: Type extends ApplicationCommandType.ChatInput
		? ApplicationCommandOptionData[]
		: never;
	type?: Type;
	listener: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

interface InternalCommand<
	Type extends ApplicationCommandType,
> extends CommandRegistration<Type> {
	admin: boolean;
}

type Command =
	| InternalCommand<ApplicationCommandType.ChatInput>
	| InternalCommand<ApplicationCommandType.Message>;

export class Bot {
	commands = new Collection<string, Command>();

	constructor(public client: Client<true>) {
		client.on('interactionCreate', interaction => {
			if (interaction.isChatInputCommand()) {
				const command = this.getByTrigger(interaction.commandName);

				if (
					!command ||
					(command.admin && !this.isAdmin(interaction.user))
				) {
					return;
				}
				command.listener(interaction).catch(err => {
					this.client.emit('error', err);
				});
			}
		});
	}

	registerCommand(
		registration:
			| CommandRegistration<ApplicationCommandType.ChatInput>
			| CommandRegistration<ApplicationCommandType.Message>,
	) {
		const command: Command = {
			...registration,
			admin: false,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	registerAdminCommand(
		registration: CommandRegistration<ApplicationCommandType.ChatInput>,
	) {
		const command: Command = {
			...registration,
			admin: true,
		};
		for (const a of command.aliases) {
			this.commands.set(a, command);
		}
	}

	async deployCommands() {
		await this.client.application.commands.set(
			this.commands
				.filter(cmd => !cmd.admin)
				.map(cmd => ({ name: cmd.aliases[0], ...cmd })),
		);
		await this.client.guilds.cache
			.first()
			?.commands.set(
				this.commands
					.filter(cmd => cmd.admin)
					.map(cmd => ({
						name: cmd.aliases[0],
						...cmd,
						defaultMemberPermissions:
							PermissionFlagsBits.Administrator,
					})),
			);
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

	isTrusted(interaction: Interaction) {
		if (
			!interaction.inCachedGuild() ||
			!interaction.channel?.isTextBased()
		) {
			return false;
		}

		if (
			!interaction.member.roles.cache.has(trustedRoleId) &&
			!interaction.member.permissions.has('ManageMessages')
		) {
			return false;
		}

		return true;
	}
}
