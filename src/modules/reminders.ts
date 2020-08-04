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

export default class ReminderModule extends Module {
    constructor(client: CookiecordClient) {
        super(client);
    }

    @listener({ event: 'ready' })
    async loadPrevReminders() {
        const db = await getDB();
        const reminders = await db.manager.find(Reminder);
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

    @command({ single: true })
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
        const db = await getDB();
        const rem = await db.manager.save(
            new Reminder(msg.author.id, Date.now() + dur, splitArgs.join(' ')),
        );

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
                this.sendReminder(rem).catch(err => {
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
        const db = await getDB();
        await db.manager.remove(rem);
    }
}

@Entity()
export class Reminder {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    userID: string;

    @Column({ type: 'bigint' })
    date: number;

    @Column()
    message: string;

    constructor(userID: string, date: number, message: string) {
        this.userID = userID;
        this.date = date;
        this.message = message;
    }
}
