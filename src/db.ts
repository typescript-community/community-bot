import { Connection, createConnection } from "typeorm";
import { Reminder } from "./modules/reminders";
import { db as dbEnv } from "./env";

let db: Connection | undefined;
export async function getDB() {
	if (db) return db;
	db = await createConnection({
		type: "postgres",
		host: dbEnv.host,
		port: dbEnv.port,
		username: dbEnv.user,
		database: "tsc-bot",
		synchronize: true,
		logging: true,
		entities: [Reminder],
	});
	console.log("Connected to DB");
	return db;
}
