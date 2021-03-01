import {
	command,
	default as CookiecordClient,
	Module,
	CommonInhibitors,
	optional,
	Command,
} from 'cookiecord';
import { Message, MessageEmbed } from 'discord.js';
import { sendWithMessageOwnership } from '../util/send';

function getCategoryHelp(cat: string, commands: Set<Command>) {
	const out: string[] = [];

	for (const cmd of commands) {
		if (
			cmd.description &&
			splitCategoryDescription(cmd.description)[0] === cat
		) {
			out.push(
				`\`${cmd.triggers[0]}\` ► ${cmd.description.substr(
					cat.length + 2,
				)}`,
			);
		}
	}

	return out.join('\n');
}

function splitCategoryDescription(description: string): [string, string] {
	const split = description.split(': ', 2);
	if (split.length !== 2) {
		return ['Misc', description];
	}
	return split as [string, string];
}

function getCommandCategories(commands: Set<Command>) {
	const categories = new Set<string>();

	for (const cmd of commands) {
		categories.add(splitCategoryDescription(cmd.description ?? '')[0]);
	}

	return [...categories].sort((a, b) => a.localeCompare(b));
}

export class HelpModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({
		aliases: ['help', 'commands', 'h'],
		inhibitors: [CommonInhibitors.guildsOnly],
		description: "Sends what you're looking at right now",
	})
	async help(msg: Message, @optional cmdTrigger?: string) {
		if (!msg.guild) return;

		if (!cmdTrigger) {
			const embed = new MessageEmbed()
				.setAuthor(
					msg.guild.name,
					msg.guild.iconURL({ dynamic: true }) || undefined,
				)
				.setTitle('Bot Usage')
				.setDescription(
					`Hello ${msg.author.username}! Here is a list of all commands in me! To get detailed description on any specific command, do \`help <command>\``,
				);

			for (const cat of getCommandCategories(
				this.client.commandManager.cmds,
			)) {
				embed.addField(
					`**${cat} Commands:**`,
					getCategoryHelp(cat, this.client.commandManager.cmds),
				);
			}

			embed
				.setFooter(
					this.client.user?.username,
					this.client.user?.displayAvatarURL(),
				)
				.setTimestamp();

			return await sendWithMessageOwnership(msg, { embed });
		}

		const cmd = this.client.commandManager.getByTrigger(cmdTrigger);
		if (!cmd || !cmd.description) {
			await sendWithMessageOwnership(
				msg,
				`:x: Command "${cmdTrigger}" not found`,
			);
			return;
		}

		const embed = new MessageEmbed().setTitle(`\`${cmdTrigger}\` Usage`);
		// Get rid of duplicates, this can happen if someone adds the method name as an alias
		const triggers = new Set(cmd.triggers);
		if (triggers.size > 1) {
			embed.addField(
				'Aliases',
				Array.from(triggers, t => `\`${t}\``).join(', '),
			);
		}
		embed.addField(
			'Description',
			`*${splitCategoryDescription(cmd.description ?? '')[1]}*`,
		);

		await sendWithMessageOwnership(msg, { embed });
	}
}
