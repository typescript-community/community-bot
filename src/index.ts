import { token, botAdmins } from "./env";
import CookiecordClient from "cookiecord";
import { Intents } from "discord.js";
import { getDB } from "./db";
const client = new CookiecordClient(
	{
		botAdmins,
		prefix: "!",
	},
	{
		ws: { intents: Intents.NON_PRIVILEGED },
		partials: ["REACTION", "MESSAGE", "USER", "CHANNEL"],
	}
);
const prod = process.env.NODE_ENV == "production";

client.loadModulesFromFolder("src/modules");
if (!prod) client.reloadModulesFromFolder("src/modules");

getDB(); // prepare the db for later
client.login(token);
client.on("ready", () => console.log(`Logged in as ${client.user?.tag}`));
