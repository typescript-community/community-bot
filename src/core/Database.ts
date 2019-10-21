import { join } from 'path';
import { Connection } from 'typeorm';

import { HistoryEntity } from '../entities/History';
import { ReminderEntity } from '../entities/Reminder';
import { RepEntity } from '../entities/Rep';
import { RepCooldownEntity } from '../entities/RepCooldown';

export class Database extends Connection {
    public constructor() {
        if (process.env.NODE_ENV != 'production') {
            super({
                type: 'sqlite',
                database: join(__dirname, '..', '..', 'database.sqlite'),
                logging: true,
                entities: [RepEntity, RepCooldownEntity, ReminderEntity, HistoryEntity],
                synchronize: true,
            });
        } else {
            super({
                type: 'postgres',
                logging: true,
                entities: [RepEntity, RepCooldownEntity, ReminderEntity, HistoryEntity],
                synchronize: true,
                ssl: true,
                url: process.env.DATABASE_URL!,
            });
        }

        this._connect();
    }

    private async _connect(): Promise<void> {
        await this.connect();
        console.log(`[DATABASE] Connected`);
    }
}
