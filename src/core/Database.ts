import { join } from 'path';
import { Connection } from 'typeorm';

import { HistoryEntity } from '../entities/History';
import { ReminderEntity } from '../entities/Reminder';
import { RepEntity } from '../entities/Rep';
import { RepCooldownEntity } from '../entities/RepCooldown';
import { TagEntity } from '../entities/Tag';

export class Database extends Connection {
    public constructor() {
        const entities = [RepEntity, RepCooldownEntity, ReminderEntity, HistoryEntity, TagEntity];

        if (process.env.NODE_ENV != 'production') {
            super({
                type: 'sqlite',
                database: join(__dirname, '..', '..', 'database.sqlite'),
                logging: true,
                entities,
                synchronize: true,
            });
        } else {
            super({
                type: 'postgres',
                logging: true,
                entities,
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
