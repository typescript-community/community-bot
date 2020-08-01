import dotenv from "dotenv-safe";
dotenv.config();

export const token = process.env.TOKEN!;
export const botAdmins = process.env.BOT_ADMINS!.split(",");
export const autorole = process.env.AUTOROLE!.split(",").map(x => {
	const [msgID, roleID, emoji, autoRemove] = x.split(":");
	return {
		msgID,
		roleID,
		emoji,
		autoRemove: autoRemove == "true",
	};
});

export const dbUrl = process.env.DB_URL!;

export const TS_BLUE = "#007ACC";
