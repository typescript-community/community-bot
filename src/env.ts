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

export const categories = {
	ask: process.env.ASK_CATEGORY!,
	ongoing: process.env.ONGOING_CATEGORY!,
	dormant: process.env.DORMANT_CATEGORY!,
};

export const askCooldownRoleId = process.env.ASK_COOLDOWN_ROLE!;

export const trustedRoleId = process.env.TRUSTED_ROLE_ID!;
export const askHelpChannelId = process.env.ASK_HELP_CHANNEL!;

export const channelNames = process.env.CHANNEL_NAMES!.split(',');

export const dormantChannelTimeout = parseInt(
	process.env.DORMANT_CHANNEL_TIMEOUT!,
);
export const dormantChannelLoop = parseInt(process.env.DORMANT_CHANNEL_LOOP!);

export const ongoingEmptyTimeout = parseInt(process.env.ONGOING_EMPTY_TIMEOUT!);

export const TS_BLUE = '#007ACC';
export const GREEN = '#77b155';
// Picked from Discord's "hourglass" emoji (in ⌛ | Occupied Help Channels)
export const HOURGLASS_ORANGE = '#ffa647';
// Picked from Discord's :ballot_box_with_check: emoji (☑)
export const BALLOT_BOX_BLUE = '#066696';
// Picked from Discord's blockquote line
export const BLOCKQUOTE_GREY = '#4f545c';
