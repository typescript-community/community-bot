import CookiecordClient from "cookiecord";
import { Intents } from "discord.js";
import { botAdmins, token } from "./env";
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

client.loadModulesFromFolder("src/modules");
client.reloadModulesFromFolder("src/modules");
client.login(token);
client.on("ready", () => console.log(`Logged in as ${client.user?.tag}`));
