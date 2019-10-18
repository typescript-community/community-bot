require('dotenv').config();

import { PascalClient } from './core/Client';
import { Database } from './core/Database';

export const client = new PascalClient(process.env.TOKEN as string);
export const database = new Database();

const bootstrap = async (): Promise<void> => {
    client.start();
};

bootstrap();
