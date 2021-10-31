import { token, botAdmins } from './env';
import CookiecordClient from 'cookiecord';
import { Intents } from 'discord.js';
import { getDB } from './db';

import { AutoroleModule } from './modules/autorole';
import { EtcModule } from './modules/etc';
import { HelpChanModule } from './modules/helpchan';
import { PlaygroundModule } from './modules/playground';
import { RepModule } from './modules/rep';
import { TwoslashModule } from './modules/twoslash';
import { HelpModule } from './modules/help';
import { SnippetModule } from './modules/snippet';
import { HandbookModule } from './modules/handbook';
import { ModModule } from './modules/mod';

const client = new CookiecordClient(
	{
		botAdmins,
		prefix: ['!', 't!'],
	},
	{
		partials: ['REACTION', 'MESSAGE', 'USER', 'CHANNEL'],
		allowedMentions: {
			parse: ['users'],
		},
		intents: new Intents([
			'GUILDS',
			'GUILD_MESSAGES',
			'GUILD_MEMBERS',
			'GUILD_MESSAGE_REACTIONS',
		]),
	},
).setMaxListeners(Infinity);

for (const mod of [
	AutoroleModule,
	EtcModule,
	HelpChanModule,
	PlaygroundModule,
	RepModule,
	TwoslashModule,
	HelpModule,
	SnippetModule,
	HandbookModule,
	ModModule,
]) {
	client.registerModule(mod);
}

getDB(); // prepare the db for later

client.login(token);
client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
