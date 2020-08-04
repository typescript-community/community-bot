import { token, botAdmins, sentryDsn } from './env';
import CookiecordClient from 'cookiecord';
import { Intents } from 'discord.js';
import { getDB } from './db';
import Sentry from '@sentry/node';

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
const prod = process.env.NODE_ENV == 'production';

client.loadModulesFromFolder('src/modules');

if (!prod) client.reloadModulesFromFolder('src/modules');

if (prod && sentryDsn) Sentry.init({ dsn: sentryDsn });

getDB(); // prepare the db for later
client.login(token);
client.on('ready', () => console.log(`Logged in as ${client.user?.tag}`));
