import CookiecordClient from "cookiecord";
import { token, botAdmins } from "./env";

const client = new CookiecordClient({
	botAdmins,
	prefix: "!",
});

client.loadModulesFromFolder("src/modules");
client.reloadModulesFromFolder("src/modules");
client.login(token);
client.on("ready", () => console.log(`Logged in as ${client.user?.tag}`));
