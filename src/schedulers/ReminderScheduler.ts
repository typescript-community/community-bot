import { MessageEmbed } from 'discord.js';
import ms from 'ms';
import { Repository } from 'typeorm';

import { ReminderEntity } from '../entities/Reminder';
import { client, database } from '../index';

// thanks robin
const timeElapsed = (timestamp: Date | number): number => Date.now() - new Date(timestamp).getTime();

export class ReminderScheduler {
    private timeout: NodeJS.Timeout;
    private repository: Repository<ReminderEntity> = database.getRepository(ReminderEntity);

    public constructor() {
        this.timeout = setInterval(() => {
            this.check();
        }, 10000);
    }

    private async check(): Promise<void> {
        const all = await this.repository.find();

        all.forEach(async (reminder: ReminderEntity) => {
            if (timeElapsed(reminder.createdAt) >= reminder.length) {
                const member = client.guilds.get('508357248330760243')!.member(reminder.member);

                if (member) {
                    try {
                        let description;
                        if (reminder.reason) {
                            description = `:clock1: **${ms(reminder.length)}** ago you asked me to remind you: ${reminder.reason}. [Scroll to message](${
                                reminder.messageLink
                                })`;
                        } else {
                            description = `:clock1: **${ms(reminder.length)}** ago you asked me to remind you. [Scroll to message](${reminder.messageLink})`;
                        }
                        member.send(new MessageEmbed().setDescription(description).setColor('#3178C6'));
                    } catch { } // eslint-disable-line no-empty
                }

                await this.repository.delete(reminder);
            }
        });
    }
}
