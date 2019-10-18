import { GuildMember, TextChannel } from 'discord.js';

import { WELCOME } from '../constants';

export const guildMemberAddEvent = async (member: GuildMember) => {
	const formattedMessage = WELCOME.welcomeMessage
		.replace(/\{userMention\}/g, `<@${member.id}>`) // @name
		.replace(/\{userTag\}/g, member.user.tag); // name#1234

	const channel = (await member.guild.channels.get(
		process.env.WELCOME_CHANNEL,
	)) as TextChannel;

	channel.send(formattedMessage);
};
