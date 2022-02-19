import { Inhibitor } from 'cookiecord';
import { TextChannel } from 'discord.js';
import { trustedRoleId } from '../env';

export const isTrustedMember: Inhibitor = async (msg, client) => {
	if (!msg.guild || !msg.member || !msg.channel.isText()) {
		return ":warning: you can't use that command here.";
	}

	if (
		!msg.member.roles.cache.has(trustedRoleId) &&
		!msg.member.permissions.has('MANAGE_MESSAGES')
	) {
		return ":warning: you don't have permission to use that command.";
	}
};
