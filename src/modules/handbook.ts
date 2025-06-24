import { EmbedBuilder } from 'discord.js';
import algoliasearch from 'algoliasearch/lite';
import { sendWithMessageOwnership } from '../util/send';
import { TS_BLUE } from '../env';
import { decode } from 'html-entities';
import { Bot } from '../bot';
import { LOCALIZATION } from '../index';

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
	.setTitle(LOCALIZATION.getLocalizedText('handbook_embed.title'))
	.setURL(LOCALIZATION.getLocalizedText('handbook_embed.url'))
	.setFooter({
		text: LOCALIZATION.getLocalizedText('handbook_embed.footer.text'),
	});

export async function handbookModule(bot: Bot) {
	bot.registerCommand({
		aliases: ['handbook', 'hb'],
		description: LOCALIZATION.getLocalizedText(
			'handbook_command.description',
		),
		async listener(msg, content) {
			if (!content) {
				return await sendWithMessageOwnership(msg, {
					embeds: [HANDBOOK_EMBED],
				});
			}

			console.log(
				LOCALIZATION.getLocalizedText('searching_algolia', { content }),
			);
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
			console.log(
				LOCALIZATION.getLocalizedText('algolia_response', { data }),
			);
			const hit = data.results[0].hits[0];
			if (!hit)
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'handbook_command.listener.no_results_found',
					),
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
