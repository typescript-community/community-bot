import { Connection, createConnection } from 'typeorm';
import { dbUrl } from './env';
import { RepUser } from './entities/RepUser';
import { RepGive } from './entities/RepGive';
import { HelpThread } from './entities/HelpThread';
import { Snippet } from './entities/Snippet';

let db: Connection | undefined;
export async function getDB() {
	if (db) return db;

	// Require ssl in production
	const extraOpts =
		process.env.NODE_ENV === 'production'
			? {
					ssl: true,
					extra: {
						ssl: {
							rejectUnauthorized: false,
						},
					},
			  }
			: {};

	db = await createConnection({
		type: 'postgres',
		url: dbUrl,
		synchronize: true,
		logging: false,
		entities: [RepUser, RepGive, HelpThread, Snippet],
		...extraOpts,
	});
	console.log('Connected to DB');
	return db;
}
