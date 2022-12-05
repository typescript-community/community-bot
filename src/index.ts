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
import { helpThreadModule } from './modules/helpthread';

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

client.on('ready', async () => {
	const bot = new Bot(client);
	console.log(`Logged in as ${client.user?.tag}`);
	await hookLog(client);

	for (const mod of [
		autoroleModule,
		etcModule,
		helpThreadModule,
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
