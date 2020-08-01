import { Message } from "discord.js";
import { command, default as CookiecordClient, Module } from "cookiecord";

export default class EtcModule extends Module {
    constructor(client: CookiecordClient) {
        super(client);
    }

    @command()
    async ping(msg: Message) {
        await msg.channel.send("pong. :ping_pong:");
    }
}
