import CookiecordClient from 'cookiecord';
import { Channel, GuildMember, TextChannel, User } from 'discord.js';
import { inspect } from 'util';
import { logChannelId } from './env';

const logDebounceTime = 5000;
const logMaxLength = 2000;

export async function hookLog(client: CookiecordClient) {
	const guild = client.guilds.cache.get(
		(await client.guilds.fetch()).first()!.id,
	)!;
	const channel = (await guild.channels.fetch(logChannelId)) as TextChannel;
	let curLogText = '';
	let timeout: NodeJS.Timeout | null = null;
	const origLog = console.log;
	console.log = (...args) => {
		origLog(...args);
		postLog(args);
	};
	const origError = console.error;
	console.error = (...args) => {
		origError(...args);
		postLog(['[ERROR]', ...args]);
	};
	console.log('Writing logs to', channel);
	function argToString(arg: unknown) {
		if (typeof arg === 'string') return arg;
		return inspect(arg);
	}
	function postLog(args: unknown[]) {
		curLogText += `[${new Date().toISOString()}] ${args
			.map(argToString)
			.join(' ')}\n`;
		if (timeout) clearTimeout(timeout);
		while (curLogText.length > logMaxLength) {
			const initial =
				curLogText.match(/^[^]{0,2000}\n/g)?.[0] ??
				curLogText.slice(0, 2000);
			curLogText = curLogText.slice(initial.length);
			postCodeblock(initial);
		}
		if (curLogText.trim().length)
			timeout = setTimeout(() => {
				postCodeblock(curLogText);
				curLogText = '';
			}, logDebounceTime);
	}
	async function postCodeblock(content: string) {
		channel.send(`\`\`\`ts\n${content}\n\`\`\``);
	}
}

function defineCustomUtilInspect<T>(
	Cls: { new (...args: any): T; prototype: T },
	cb: (value: T) => string,
) {
	// @ts-ignore
	Cls.prototype[inspect.custom] = function () {
		return cb(this);
	};
}

const inspectUser = (user: User) =>
	`@${user.username}#${user.discriminator}/${user.id}`;
defineCustomUtilInspect(User, inspectUser);
defineCustomUtilInspect(GuildMember, member => inspectUser(member.user));

defineCustomUtilInspect(Channel, channel =>
	'name' in channel
		? `#${(channel as any).name}/${(channel as Channel).id}`
		: `#${channel.id}`,
);
