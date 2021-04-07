import { command, default as CookiecordClient, Module } from 'cookiecord';
import { Message, MessageEmbed } from 'discord.js';
import algoliasearch from 'algoliasearch/lite';
import { sendWithMessageOwnership } from '../util/send';
import { TS_BLUE } from '../env';

const ALGOLIA_APP_ID = 'BH4D9OD16A';
const ALGOLIA_API_KEY = '3c2db2aef0c7ff26e8911267474a9b2c';
const ALGOLIA_INDEX_NAME = 'typescriptlang';

const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {});

type AlgoliaResult = {
	hierarchy: Record<string, string | null>;
	url: string;
};

export class HandbookModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	HANDBOOK_EMBED = new MessageEmbed()
		.setColor(TS_BLUE)
		.setTitle('The TypeScript Handbook')
		.setURL('https://www.typescriptlang.org/docs/handbook/intro.html')
		.setFooter('You can search with `!handbook <query>`');

	@command({
		description: 'Search the TypeScript Handbook',
		single: true,
	})
	async handbook(msg: Message, text: string) {
		if (!text)
			return await sendWithMessageOwnership(msg, {
				embed: this.HANDBOOK_EMBED,
			});
		const data = await algolia.search<AlgoliaResult>([
			{
				indexName: ALGOLIA_INDEX_NAME,
				query: text,
				params: {
					offset: 0,
					length: 1,
				},
			},
		]);
		const hit = data.results[0].hits[0];
		const hierarchyParts = [0, 1, 2, 3, 4, 5, 6]
			.map(i => hit.hierarchy[`lvl${i}`])
			.filter(x => x);
		const embed = new MessageEmbed()
			.setColor(TS_BLUE)
			.setTitle(hierarchyParts[hierarchyParts.length - 1])
			.setAuthor(hierarchyParts.slice(0, -1).join(' / '))
			.setURL(hit.url);
		await sendWithMessageOwnership(msg, { embed });
	}
}
