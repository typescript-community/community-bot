import { DataSource } from 'typeorm';
import { dbUrl } from './env.js';
import { Rep } from './entities/Rep.js';
import { HelpThread } from './entities/HelpThread.js';
import { Snippet } from './entities/Snippet.js';

let db: DataSource | undefined;
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

	db = new DataSource({
		type: 'postgres',
		url: dbUrl,
		synchronize: true,
		logging: false,
		entities: [Rep, HelpThread, Snippet],
		...extraOpts,
	});
	await db.initialize();
	console.log('Connected to DB');
	return db;
}
