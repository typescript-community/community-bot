import { EmbedBuilder } from 'discord.js';
import algoliasearch from 'algoliasearch/lite';
import { sendWithMessageOwnership } from '../util/send';
import { TS_BLUE } from '../env';
import { decode } from 'html-entities';
import { Bot } from '../bot';

const ALGOLIA_APP_ID = 'BGCDYOIYZ5';
const ALGOLIA_API_KEY = '37ee06fa68db6aef451a490df6df7c60';
const ALGOLIA_INDEX_NAME = 'typescriptlang';

const algolia = algoliasearch(ALGOLIA_APP_ID, ALGOLIA_API_KEY, {});

type AlgoliaResult = {
	hierarchy: Record<string, string | null>;
	url: string;
};

const HANDBOOK_EMBED = new EmbedBuilder()
	.setColor(TS_BLUE)
	.setTitle('The TypeScript Handbook')
	.setURL('https://www.typescriptlang.org/docs/handbook/intro.html')
	.setFooter({ text: 'You can search with `!handbook <query>`' });

export async function handbookModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['handbook', 'hb'],
		description: 'Search the TypeScript Handbook',
		async listener(msg, content) {
			if (!content) {
				return await sendWithMessageOwnership(msg, {
					embeds: [HANDBOOK_EMBED],
				});
			}

			console.log('Searching algolia for', [content]);
			const data = await algolia.search<AlgoliaResult>([
				{
					indexName: ALGOLIA_INDEX_NAME,
					query: content,
					params: {
						offset: 0,
						length: 1,
					},
				},
			]);
			console.log('Algolia response:', data);
			const hit = data.results[0].hits[0];
			if (!hit)
				return await sendWithMessageOwnership(
					msg,
					':x: No results found for that query',
				);
			const hierarchyParts = [0, 1, 2, 3, 4, 5, 6]
				.map(i => hit.hierarchy[`lvl${i}`])
				.filter(x => x);
			const embed = new EmbedBuilder()
				.setColor(TS_BLUE)
				.setTitle(decode(hierarchyParts[hierarchyParts.length - 1]))
				.setAuthor({
					name: decode(hierarchyParts.slice(0, -1).join(' / ')),
				})
				.setURL(hit.url);
			await sendWithMessageOwnership(msg, { embeds: [embed] });
		},
	});
}
