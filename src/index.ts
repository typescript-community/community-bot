import CookiecordClient from "cookiecord";
import dotenv from "dotenv-safe";
dotenv.config();

const client = new CookiecordClient({
	botAdmins: process.env.BOT_ADMINS?.split(","),
	prefix: "!",
});

client.loadModulesFromFolder("src/modules");
client.reloadModulesFromFolder("src/modules");
client.login(process.env.TOKEN);
client.on("ready", () => console.log(`Logged in as ${client.user?.tag}`));
