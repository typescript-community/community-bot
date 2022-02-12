import dotenv from 'dotenv-safe';
dotenv.config();

export const token = process.env.TOKEN!;
export const botAdmins = process.env.BOT_ADMINS!.split(',');

export const autorole = process.env.AUTOROLE!.split(',').map(x => {
	const [msgID, roleID, emoji, autoRemove] = x.split(':');
	return {
		msgID,
		roleID,
		emoji,
		autoRemove: autoRemove == 'true',
	};
});

export const dbUrl = process.env.DATABASE_URL!;

export const helpCategory = process.env.HELP_CATEGORY!;
export const howToGetHelpChannel = process.env.HOW_TO_GET_HELP_CHANNEL!;
export const generalHelpChannel = process.env.GENERAL_HELP_CHANNEL!;

export const trustedRoleId = process.env.TRUSTED_ROLE_ID!;

export const rulesChannelId = process.env.RULES_CHANNEL!;

export const TS_BLUE = '#007ACC';
export const GREEN = '#3ba55d';
// Picked from Discord's blockquote line
export const BLOCKQUOTE_GREY = '#4f545c';

export const timeBeforeHelperPing = parseInt(
	process.env.TIME_BEFORE_HELPER_PING!,
);
