import { EmbedBuilder } from 'discord.js';
import { Bot, CommandRegistration } from '../bot';
import { Snippet } from '../entities/Snippet';
import { sendWithMessageOwnership } from '../util/send';

function getCategoryHelp(cat: string, commands: Iterable<CommandRegistration>) {
	const out: string[] = [];

	for (const cmd of new Set(commands)) {
		if (!cmd.description) continue;
		const [cat2, description] = splitCategoryDescription(cmd.description);
		if (cat !== cat2) continue;
		out.push(`\`${cmd.aliases[0]}\` ► ${description}`);
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

function getCommandCategories(commands: Iterable<CommandRegistration>) {
	const categories = new Set<string>();

	for (const cmd of commands) {
		categories.add(splitCategoryDescription(cmd.description ?? '')[0]);
	}

	return [...categories].sort((a, b) => a.localeCompare(b));
}

export function helpModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['help', 'commands', 'h'],
		description: "Sends what you're looking at right now",
		async listener(msg) {
			const cmdTrigger = msg.content.split(/\s/)[1];

			if (!msg.guild) return;

			if (!cmdTrigger) {
				const embed = new EmbedBuilder()
					.setAuthor({
						name: msg.guild.name,
						iconURL: msg.guild.iconURL() || undefined,
					})
					.setTitle('Bot Usage')
					.setDescription(
						`Hello ${msg.author.username}! Here is a list of all commands in me! To get detailed description on any specific command, do \`help <command>\``,
					);

				for (const cat of getCommandCategories(bot.commands.values())) {
					embed.addFields({
						name: `**${cat} Commands:**`,
						value: getCategoryHelp(cat, bot.commands.values()),
					});
				}

				embed
					.setFooter({
						text: bot.client.user.username,
						iconURL: bot.client.user.displayAvatarURL(),
					})
					.setTimestamp();

				return await sendWithMessageOwnership(msg, { embeds: [embed] });
			}

			let cmd: { description?: string; aliases?: string[] } =
				bot.getByTrigger(cmdTrigger) || {};

			if (!cmd.description && cmdTrigger.includes(':')) {
				const snippet = await Snippet.findOne({
					where: { title: cmdTrigger },
				});
				if (snippet)
					cmd = {
						description: `A custom snippet created by <@${snippet.owner}>`,
					};
				else
					cmd = {
						description:
							'Run the first snippet that matches that pattern',
					};
			}

			if (!cmd.description)
				return await sendWithMessageOwnership(
					msg,
					`:x: Command not found`,
				);

			const embed = new EmbedBuilder().setTitle(
				`\`${cmdTrigger}\` Usage`,
			);
			// Get rid of duplicates, this can happen if someone adds the method name as an alias
			const triggers = new Set(cmd.aliases ?? [cmdTrigger]);
			if (triggers.size > 1) {
				embed.addFields({
					name: 'Aliases',
					value: Array.from(triggers, t => `\`${t}\``).join(', '),
				});
			}
			embed.addFields({
				name: 'Description',
				value: `*${
					splitCategoryDescription(cmd.description ?? '')[1]
				}*`,
			});

			await sendWithMessageOwnership(msg, { embeds: [embed] });
		},
	});
}
