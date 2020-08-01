import dotenv from "dotenv-safe";
dotenv.config();

export const token = process.env.TOKEN;
export const botAdmins = process.env.BOT_ADMINS!.split(",");
export const verificationMessage = process.env.VERIFICATION_MESSAGE;
export const experienceMessage = process.env.EXPERIENCE_MESSAGE;
export const helperMessage = process.env.HELPER_MESSAGE;