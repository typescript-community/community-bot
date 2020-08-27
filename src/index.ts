import { token, botAdmins } from './env';
import CookiecordClient, { Module } from 'cookiecord';
import { Intents } from 'discord.js';
import { getDB } from './db';

import { AutoroleModule } from './modules/autorole';
import { EtcModule } from './modules/etc';
import { HelpChanModule } from './modules/helpchan';
import { PlaygroundModule } from './modules/playground';
import { PollModule } from './modules/poll';
import { ReminderModule } from './modules/reminders';
import { RepModule } from './modules/rep';
import { TwoslashModule } from './modules/twoslash';

const client = new CookiecordClient(
	{
		botAdmins,
		prefix: ['!', 't!'],
	},
	{
		ws: { intents: Intents.NON_PRIVILEGED },
		partials: ['REACTION', 'MESSAGE', 'USER', 'CHANNEL'],
	},
);

for (const mod of [
	AutoroleModule,
	EtcModule,
	HelpChanModule,
	PlaygroundModule,
	PollModule,
	ReminderModule,
	RepModule,
	TwoslashModule,
]) {
	client.registerModule(mod);
}

getDB(); // prepare the db for later

client.login(token);
client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
