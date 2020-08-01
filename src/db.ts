import { Connection, createConnection } from "typeorm";
import { Reminder } from "./modules/reminders";

let db: Connection | undefined;
export async function getDB() {
	if (db) return db;
	db = await createConnection({
		type: "postgres",
		host: "localhost",
		port: 5432,
		username: "ron",
		database: "tsc-bot",
		synchronize: true,
		logging: true,
		entities: [Reminder],
	});
	console.log("Connected to DB");
	return db;
}
