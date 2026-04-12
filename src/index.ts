import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Bot } from './bot.js';
import { getDB } from './db.js';
import { token } from './env.js';
import { hookLog } from './log.js';

import { autoroleModule } from './modules/autorole.js';
import { etcModule } from './modules/etc.js';
import { handbookModule } from './modules/handbook.js';
import { helpModule } from './modules/help.js';
import { modModule } from './modules/mod.js';
import { playgroundModule } from './modules/playground.js';
import { repModule } from './modules/rep.js';
import { twoslashModule } from './modules/twoslash.js';
import { snippetModule } from './modules/snippet.js';
import { helpForumModule } from './modules/helpForum.js';

const client = new Client({
	partials: [
		Partials.Reaction,
		Partials.Message,
		Partials.User,
		Partials.Channel,
	],
	allowedMentions: {
		parse: ['users', 'roles'],
	},
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages,
		GatewayIntentBits.MessageContent,
	],
}).setMaxListeners(Infinity);

getDB().then(() => client.login(token));

client.on('clientReady', async client => {
	const bot = new Bot(client);
	console.log(`Logged in as ${client.user?.tag}`);
	await hookLog(client);

	for (const mod of [
		autoroleModule,
		etcModule,
		helpForumModule,
		playgroundModule,
		repModule,
		twoslashModule,
		helpModule,
		snippetModule,
		handbookModule,
		modModule,
	]) {
		await mod(bot);
	}
});

client.on('error', error => {
	console.error(error);
});

if (process.env.NODE_ENV === 'production') {
	process.on('unhandledRejection', e => {
		console.error('Unhandled rejection', e);
	});
}
