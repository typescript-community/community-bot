import { EmbedBuilder, TextChannel, User } from 'discord.js';
import { Snippet } from '../entities/Snippet';
import { BLOCKQUOTE_GREY } from '../env';
import { sendWithMessageOwnership } from '../util/send';
import { getReferencedMessage } from '../util/getReferencedMessage';
import { splitCustomCommand } from '../util/customCommand';
import { Bot } from '../bot';
import { LOCALIZATION } from '../index';

// https://stackoverflow.com/a/3809435
const LINK_REGEX =
	/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

const DISCORD_MESSAGE_LINK_REGEX_ANCHORED =
	/^https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;

export function snippetModule(bot: Bot) {
	bot.client.on('messageCreate', async msg => {
		const commandData = await splitCustomCommand(bot, msg);
		if (!commandData) return;
		const { command } = commandData;

		if (command.includes('*') && !command.includes(':')) return;

		const [match] = await interpretSpecifier(msg.author, command, 1);

		if (!match) return;

		// We already know there's a snippet under this id from the search
		const snippet = (await Snippet.findOneBy({ id: match.id }))!;

		await addSnippetUses(match.id);
		const onDelete = () => addSnippetUses(match.id, -1);

		if (snippet.content) {
			await sendWithMessageOwnership(msg, snippet.content, onDelete);
			return;
		}

		const owner = await bot.client.users.fetch(snippet.owner);
		const embed = new EmbedBuilder({
			...snippet,
			// image is in an incompatible format, so we have to set it later
			image: undefined,
		});
		if (match.id.includes(':'))
			embed.setAuthor({
				name: owner.tag,
				iconURL: owner.displayAvatarURL(),
			});
		if (snippet.image) embed.setImage(snippet.image);
		await sendWithMessageOwnership(msg, { embeds: [embed] }, onDelete);
	});

	bot.registerCommand({
		aliases: ['listSnippets', 'snippets', 'snips'],
		description: LOCALIZATION.getLocalizedText(
			'snippets_command.description',
		),
		async listener(msg, specifier) {
			const limit = 20;
			const matches = await interpretSpecifier(
				msg.author,
				specifier || '*',
				limit + 1,
			);
			await sendWithMessageOwnership(msg, {
				embeds: [
					new EmbedBuilder()
						.setColor(BLOCKQUOTE_GREY)
						.setTitle(
							`${
								matches.length > limit
									? `${limit}+`
									: matches.length
							} Matches Found`,
						)
						.setDescription(
							matches
								.slice(0, limit)
								.map(
									s =>
										`- \`${s.id}\` with **${s.uses}** uses`,
								)
								.join('\n'),
						),
				],
			});
		},
	});

	bot.registerCommand({
		aliases: ['snip', 'snippet', 'createSnippet'],
		description: LOCALIZATION.getLocalizedText(
			'snippet_command.description',
		),
		async listener(msg, content) {
			if (!msg.member) return;

			const [name, ...parts] = content.split(' ');
			const source = parts.join(' ');

			const linkedMessage = await getMessageFromLink(source);

			if (!name) {
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'snippet_command.listener.not_name',
					),
				);
			}

			const id = name.startsWith('!')
				? `${sanitizeIdPart(name.slice(1))}`
				: `${sanitizeIdPart(msg.author.username)}:${sanitizeIdPart(
						name,
				  )}`;
			const existingSnippet = await Snippet.findOneBy({ id });

			if (!id.includes(':') && !bot.isMod(msg.member))
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'snippet_command.listener.dont_have_permissions',
					),
				);

			if (
				!bot.isMod(msg.member) &&
				existingSnippet &&
				existingSnippet.owner !== msg.author.id
			)
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'snippet_command.listener.cannot_edit',
					),
				);

			const title = `\`!${id}\`: `;
			const base = {
				id,
				uses: existingSnippet?.uses ?? 0,
				owner: msg.author.id,
				title,
			};
			let data: Partial<Snippet> | undefined;

			if (source && !linkedMessage) {
				const referencedSnippet = await Snippet.findOneBy({
					id: source,
				});
				if (!referencedSnippet)
					return await sendWithMessageOwnership(
						msg,
						LOCALIZATION.getLocalizedText(
							'snippet_command.listener.second_arg',
						),
					);
				data = {
					...referencedSnippet,
					...base,
					title:
						base.title +
						referencedSnippet.title
							?.split(': ')
							.slice(1)
							.join(': '),
				};
			} else {
				const sourceMessage =
					linkedMessage ?? (await getReferencedMessage(msg));
				if (!sourceMessage)
					return await sendWithMessageOwnership(
						msg,
						LOCALIZATION.getLocalizedText(
							'snippet_command.listener.have_reply',
						),
					);

				const description = sourceMessage.content;
				const referencedEmbed = sourceMessage.embeds[0];

				if (LINK_REGEX.exec(description)?.[0] === description)
					data = {
						...base,
						content: description,
					};
				else if (description)
					data = {
						...base,
						description,
						color: parseInt(BLOCKQUOTE_GREY.slice(1), 16),
					};
				else if (referencedEmbed)
					data = {
						...base,
						title: title + (referencedEmbed.title || ''),
						description: referencedEmbed.description!,
						color: referencedEmbed.color!,
						image: referencedEmbed.image?.url,
						url: referencedEmbed.url!,
					};
			}

			if (!data) {
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'snippet_command.listener.cannot_generate',
					),
				);
			}

			await existingSnippet?.remove();
			await Snippet.create(data).save();
			const verb = existingSnippet ? 'Edited' : 'Created';
			await sendWithMessageOwnership(
				msg,
				`:white_check_mark: ${verb} snippet \`${id}\``,
			);
			console.log(`${verb} snippet ${id} for`, msg.author);
		},
	});

	bot.registerCommand({
		aliases: ['deleteSnip'],
		description: LOCALIZATION.getLocalizedText(
			'delete_snippet_command.description',
		),
		async listener(msg, id) {
			if (!msg.member) return;
			const snippet = await Snippet.findOneBy({ id });
			if (!snippet)
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'delete_snippet_command.listener.not_found',
					),
				);
			if (!bot.isMod(msg.member) && snippet.owner !== msg.author.id)
				return await sendWithMessageOwnership(
					msg,
					LOCALIZATION.getLocalizedText(
						'delete_snippet_command.listener.cannot_delete',
					),
				);
			await snippet.remove();
			console.log(
				LOCALIZATION.getLocalizedText(
					'delete_snippet_command.listener.snippet_deleted_log',
					{ id, author: msg.author },
				),
			);
			sendWithMessageOwnership(
				msg,
				LOCALIZATION.getLocalizedText(
					'delete_snippet_command.listener.snippet_deleted_msg',
				),
			);
		},
	});

	async function getMessageFromLink(messageLink: string | undefined) {
		const messageLinkExec = DISCORD_MESSAGE_LINK_REGEX_ANCHORED.exec(
			messageLink ?? '',
		);
		if (!messageLinkExec) return;
		const guild = bot.client.guilds.cache.get(messageLinkExec[1]);
		const channel = guild?.channels.cache.get(messageLinkExec[2]);
		if (!channel || !(channel instanceof TextChannel)) return;
		const message = await channel.messages.fetch(messageLinkExec[3]);
		return message;
	}
}

const sanitizeIdPart = (part: string) =>
	part.toLowerCase().replace(/[^\w-]/g, '');

const interpretSpecifier = async (
	sender: User,
	specifier: string,
	limit: number,
): Promise<SnippetInfo[]> => {
	specifier = specifier.replace(/\\/g, '');
	if (/[^\w:*%-]/.test(specifier)) return [];
	// `%` is SQL's /.*/g for LIKE
	specifier = specifier.replace(/\*/g, '%');
	const baseQuery = () =>
		Snippet.createQueryBuilder()
			.select(['id', 'owner', 'uses'])
			.where('id like :specifier')
			.orderBy('uses', 'DESC')
			.setParameters({ specifier: specifier, owner: sender.id })
			.limit(limit);
	if (specifier.startsWith(':')) {
		specifier = '%' + specifier;
		const matches = await baseQuery()
			.andWhere('owner = :owner')
			.getRawMany();
		if (matches.length) return matches;
	}
	return await baseQuery().getRawMany();
};

const addSnippetUses = async (id: string, amount = 1) => {
	await Snippet.createQueryBuilder()
		.update()
		.where('id = :id')
		.set({ uses: () => 'uses + :amount' })
		.setParameters({ id, amount })
		.execute();
};

type SnippetInfo = Pick<Snippet, 'id' | 'uses'>;
