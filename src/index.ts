import { Client, GatewayIntentBits, Partials } from 'discord.js';
import { Bot } from './bot';
import { getDB } from './db';
import { token } from './env';
import { hookLog } from './log';

import { autoroleModule } from './modules/autorole';
import { etcModule } from './modules/etc';
import { handbookModule } from './modules/handbook';
import { helpModule } from './modules/help';
import { modModule } from './modules/mod';
import { playgroundModule } from './modules/playground';
import { repModule } from './modules/rep';
import { twoslashModule } from './modules/twoslash';
import { snippetModule } from './modules/snippet';
import { helpForumModule } from './modules/helpForum';

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
		GatewayIntentBits.GuildMessageReactions,
		GatewayIntentBits.DirectMessages,
	],
}).setMaxListeners(Infinity);

getDB().then(() => client.login(token));

client.on('ready', async c => {
	const bot = new Bot(c);
	console.log(`Logged in as ${c.user.tag}`);
	await hookLog(c);

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
	await bot.deployCommands();
});

client.on('error', error => {
	console.error(error);
});

if (process.env.NODE_ENV === 'production') {
	process.on('unhandledRejection', e => {
		console.error('Unhandled rejection', e);
	});
}
