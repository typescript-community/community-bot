require('dotenv').config();

import { PascalClient } from './core/Client';
import { Database } from './core/Database';

export const client = new PascalClient(process.env.TOKEN);
export const database = new Database();

const bootstrap = async () => {
	client.start();
};

bootstrap();
