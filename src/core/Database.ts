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
                database: join(__dirname, '..', '..', 'database.sqlite'),
                entities,
                logging: true,
                synchronize: true,
                type: 'sqlite',
            });
        } else {
            super({
                entities,
                logging: true,
                ssl: true,
                synchronize: true,
                type: 'postgres',
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
