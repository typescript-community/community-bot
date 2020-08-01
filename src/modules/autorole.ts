import {
	default as CookiecordClient,

	listener, Module
} from "cookiecord";
import { MessageReaction, User } from "discord.js";
import { autorole } from "../env";

export default class AutoroleModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: "messageReactionAdd" })
	async onReactionAdd(reaction: MessageReaction, user: User) {
		if (user.id == this.client.user!.id) return;
		if (reaction.partial) await reaction.fetch();
		for (const ar of autorole) {
			const msg = reaction.message;
			if (
				ar.emoji !== reaction.emoji.toString() ||
				ar.msgID !== msg.id ||
				!msg.guild
			)
				continue;
			if (ar.autoRemove) reaction.users.remove(user);
			const member = await msg.guild.members.fetch({
				user,
			});
			await member.roles.add(ar.roleID);
			if (!reaction.users.cache.has(this.client.user!.id)) {
				await msg.react(reaction.emoji);
			}
		}
	}

	@listener({ event: "messageReactionRemove" })
	async onReactionRemove(reaction: MessageReaction, user: User) {
		if (user.id == this.client.user!.id) return;
		if (reaction.partial) await reaction.fetch();
		for (const ar of autorole) {
			const msg = reaction.message;
			if (
				ar.emoji !== reaction.emoji.toString() ||
				ar.msgID !== msg.id ||
				ar.autoRemove ||
				!msg.guild
			)
				continue;
			const member = await msg.guild.members.fetch({
				user,
			});
			await member.roles.remove(ar.roleID);
		}
	}
}
