import algoliasearch from 'algoliasearch/lite';
import { sendWithMessageOwnership } from '../util/send';
import { decode } from 'html-entities';
import { Bot } from '../bot';
import { MessageBuilder } from '../util/messageBuilder';

const ALGOLIA_APP_ID = 'BGCDYOIYZ5';
const ALGOLIA_API_KEY = '37ee06fa68db6aef451a490df6df7c60';
const ALGOLIA_INDEX_NAME = 'typescriptlang';

const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {});

type AlgoliaResult = {
	hierarchy: Record<string, string | null>;
	url: string;
};

const HANDBOOK_HELP = new MessageBuilder()
	.setTitle('The TypeScript Handbook')
	.setURL('https://www.typescriptlang.org/docs/handbook/intro.html')
	.setDescription('You can search with `!handbook <query>`')
	.build();

export async function handbookModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['handbook', 'hb'],
		description: 'Search the TypeScript Handbook',
		async listener(msg, content) {
			if (!content) {
				return await sendWithMessageOwnership(msg, HANDBOOK_HELP);
			}

			const data = await algolia.search<AlgoliaResult>([
				{
					indexName: ALGOLIA_INDEX_NAME,
					query: content,
					params: {
						offset: 0,
						length: 5,
					},
				},
			]);

			if (!data.results[0].hits.length) {
				return await sendWithMessageOwnership(
					msg,
					':x: No results found for that query',
				);
			}

			const response = new MessageBuilder();

			const pages = {} as Record<string, string[]>;

			for (const hit of data.results[0].hits) {
				const hierarchyParts = [0, 1, 2, 3, 4, 5, 6]
					.map(i => hit.hierarchy[`lvl${i}`])
					.filter(x => x);

				const page = hierarchyParts[0]!;
				const path = decode(hierarchyParts.slice(1).join(' / '));
				pages[page] ??= [];
				pages[page].push(`[${path}](<${hit.url}>)`);
			}

			for (const [page, entries] of Object.entries(pages)) {
				response.addFields({
					name: page,
					value: `- ${entries.join('\n- ')}`,
				});
			}

			await sendWithMessageOwnership(msg, response.build());
		},
	});
}
