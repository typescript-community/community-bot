import {
	default as CookiecordClient,
	Module,
	command,
	listener,
} from 'cookiecord';
import { Column, Entity, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';
import parse from 'parse-duration';
import { Message } from 'discord.js';
import { getDB } from '../db';
import prettyMs from 'pretty-ms';
import { setTimeout } from 'timers';
import { Reminder } from '../entities/Reminder';

export class ReminderModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'ready' })
	async loadPrevReminders() {
		const reminders = await Reminder.find();

		for (const rem of reminders) {
			setTimeout(
				() =>
					this.sendReminder(rem).catch(err => {
						throw err;
					}),
				rem.date - Date.now(),
			);
		}
	}

	@command({
		single: true,
		description: 'Get me to remind you about anything in the future',
	})
	async remind(msg: Message, args: string) {
		// cookiecord can't have args with spaces in them (yet)
		const splitArgs = args.split(' ').filter(x => x.trim().length !== 0);
		if (splitArgs.length == 0)
			return await msg.channel.send(
				':warning: syntax: !remind <duration> [message]',
			);
		const maxDur = parse('10yr');
		const dur = parse(splitArgs.shift()!); // TS doesn't know about the length check
		if (!dur || !maxDur || dur > maxDur)
			return await msg.channel.send(':warning: invalid duration!');

		const reminder = new Reminder();
		reminder.userID = msg.author.id;
		reminder.date = Date.now() + dur;
		reminder.message = splitArgs.join('');

		await reminder.save();

		if (splitArgs.length == 0) {
			await msg.channel.send(
				`:ok_hand: set a reminder for ${prettyMs(dur)}.`,
			);
		} else {
			await msg.channel.send(
				`:ok_hand: set a reminder for ${prettyMs(
					dur,
				)} to remind you about "${splitArgs.join('')}".`,
			);
		}

		// set the timeout, bot will take all the reminders from the DB on init if interrupted while a reminder is still pending
		setTimeout(
			() =>
				this.sendReminder(reminder).catch(err => {
					throw err;
				}),
			dur,
		);
	}

	async sendReminder(rem: Reminder) {
		const user = await this.client.users.fetch(rem.userID);
		try {
			if (rem.message.length == 0) {
				user.send(':clock1: hey! you asked me to remind you.');
			} else {
				user.send(
					`:clock1: hey! you asked me to remind you about "${rem.message}"`,
				);
			}
		} catch (e) {
			// Fail silently, as the user might have their DMs off.
		}

		await rem.remove();
	}
}
