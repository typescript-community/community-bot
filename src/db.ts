import { Connection, createConnection } from "typeorm";
import { Reminder } from "./modules/reminders";
import { dbUrl } from "./env";
import { RepUser, RepGive } from "./modules/rep";

let db: Connection | undefined;
export async function getDB() {
	if (db) return db;
	db = await createConnection({
		type: "postgres",
		url: dbUrl,
		synchronize: true,
		logging: false,
		entities: [Reminder, RepUser, RepGive],
	});
	console.log("Connected to DB");
	return db;
}
