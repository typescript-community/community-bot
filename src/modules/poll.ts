import {
	default as CookiecordClient,

	listener, Module
} from "cookiecord";
import { Message } from "discord.js";

export default class PollModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: "message" })
	async onMessage(msg: Message) {
		const POLL_REGEX = /^poll:/i;
		if (msg.author.bot || !POLL_REGEX.test(msg.content)) return;
		await msg.react("✅");
		await msg.react("❌");
	}
}
