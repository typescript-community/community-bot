import { Client, Message } from 'discord.js';

interface FilterOptions {
    name: string;
    handler: (message: Message) => Promise<unknown>;
}

interface FilterManagerOptions {
    logger: (...message: string[]) => void;
}

export class Filter {
    public constructor(public options: FilterOptions) {}
}

export class FilterHandler {
    private filters: Filter[] = [];

    public constructor(private bot: Client, private options: FilterManagerOptions) {
        this.bot.on('message', this.handleMessage.bind(this));
    }

    public registerFilter(filter: Filter): void {
        this.filters.push(filter);
        this.options.logger(`Added filter:`, filter.options.name);
    }

    private handleMessage(message: Message): void {
        this.filters.forEach(filter => {
            filter.options.handler(message);
        });
    }
}
