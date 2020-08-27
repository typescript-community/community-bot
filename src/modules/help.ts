import {
	command,
	default as CookiecordClient,
	Module,
	CommonInhibitors,
	optional,
} from 'cookiecord';
import { Message, MessageEmbed } from 'discord.js';

export default class HelpModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@command({
		aliases: ['help', 'commands', 'h'],
		inhibitors: [CommonInhibitors.guildsOnly],
	})
	async help(msg: Message, @optional cmdTrigger?: string) {
		if (!msg.guild) return;

		if (!cmdTrigger) {
			let embed = new MessageEmbed()
				.setAuthor(
					msg.guild.name,
					msg.guild.iconURL({ dynamic: true }) || undefined,
				)
				.setTitle('Bot Usage')
				.setDescription(
					`Hello ${msg.author.username}! Here is a list of all commands in me! To get detailed description on any specific command, do \`help <command>\``,
				)
				.addField(
					`**Misc Commands:**`,
					`\`help\` ► View a list of all commands!\n\`ping\` ► View the latency of the bot\n\`ask\` ► Sends a message with a link redirecting to dontasktoask.com\n\`playground\` ► Just enter your code and get a link with TS playground!`,
				)
				.addField(
					`**Help Channel Commands:**`,
					`\`done\` ► Close a __ongoing__ help channel opened by you!`,
				)
				.addField(
					`**Reputation Commands**`,
					`\`rep\` ► Did somebody help you? Give them a reputation point!\n\`history\` ► Check the reputation history of a user!\n\`leaderboard\` ► See the reputation leaderboard!`,
				)
				.setFooter(
					this.client.user?.username,
					this.client.user?.displayAvatarURL(),
				)
				.setTimestamp();

			return await msg.channel.send(embed);
		} else {
			const cmd = this.client.commandManager.getByTrigger(cmdTrigger);
			await msg.channel.send(
				`Usage: \`${cmd?.triggers.join('|')} ${cmd?.args.map(arg =>
					arg.optional ? `[${arg.type.name}]` : `<${arg.type.name}>`,
				)}\`${
					cmd?.description
						? `\nDescription: *${cmd?.description}*`
						: ''
				}`,
			);
			// case 'ping':
			// 	msg.channel.send(
			// 		`Aliases: \`ping\`\nDescription: *View the latency of the bot*\nUsage: \`ping\``,
			// 	);
			// 	break;
			// case 'ask':
			// 	msg.channel.send(
			// 		`Aliases: \`ask\`\nDescription: *Bot sends a dontasktoask website link*\nUsage: \`ask\``,
			// 	);
			// 	break;
			// case 'done':
			// 	msg.channel.send(
			// 		`Aliases: \`done\`, \`close\`, \`resolve\`\nDescription: *Close a opened help channel*\nUsage: \`close\``,
			// 	);
			// 	break;
			// case 'rep':
			// 	msg.channel.send(
			// 		`Aliases: \`rep\`\nDescription: *Give a user some reputation*\nUsage: \`rep <user>\``,
			// 	);
			// 	break;
			// case 'history':
			// 	msg.channel.send(
			// 		`Aliases: \`getrep\`, \`history\`\nDescription: *Get the reputation history of a user*\nUsage: \`history <user>\``,
			// 	);
			// 	break;
			// case 'leaderboard':
			// 	msg.channel.send(
			// 		`Aliases: \`leaderboard\`, \`lb\`\nDescription: *View the reputation leaderboard!*\nUsage: \`leaderboard\``,
			// 	);
			// 	break;
			// case 'help':
			// 	msg.channel.send(
			// 		`Aliases: \`help\`, \`commands\`, \`h\`\nDescription: *Get the list of commands in me!*\nUsage: \`help [command (optional)]\``,
			// 	);
			// 	break;
		}
	}
}
