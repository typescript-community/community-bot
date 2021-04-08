import {
	command,
	default as CookiecordClient,
	Module,
	listener,
	optional,
} from 'cookiecord';
import {
	GuildMember,
	Message,
	MessageEmbed,
	TextChannel,
	User,
} from 'discord.js';
import { BaseEntity } from 'typeorm';
import { Snippet } from '../entities/Snippet';
import { BLOCKQUOTE_GREY } from '../env';
import { sendWithMessageOwnership } from '../util/send';

// https://stackoverflow.com/a/3809435
const LINK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

const DISCORD_MESSAGE_LINK_REGEX_ANCHORED = /^https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;

export class SnippetModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'message' })
	async runSnippet(msg: Message) {
		const [commandPart] = msg.content.split(' ');
		const prefixes = await this.client.getPrefix(msg);
		const matchingPrefix = [prefixes]
			.flat()
			.find(x => msg.content.startsWith(x));
		if (!matchingPrefix) return;
		let command = commandPart.slice(matchingPrefix.length);
		if (this.client.commandManager.getByTrigger(command)) return;

		if (!command) return;
		if (command.includes('*') && !command.includes(':')) return [];

		const [match] = await interpretSpecifier(msg.author, command, 1);

		if (!match) return;

		// We already know there's a snippet under this id from the search
		const snippet = (await this.getSnippet(match.id))!;

		await addSnippetUses(match.id);
		const onDelete = () => addSnippetUses(match.id, -1);

		if (snippet.content)
			return await sendWithMessageOwnership(
				msg,
				snippet.content,
				onDelete,
			);

		const owner = await this.client.users.fetch(snippet.owner);
		const embed = new MessageEmbed({
			...snippet,
			// image is in an incompatible format, so we have to set it later
			image: undefined,
		});
		if (match.id.includes(':'))
			embed.setAuthor(owner.tag, owner.displayAvatarURL());
		if (snippet.image) embed.setImage(snippet.image);
		await sendWithMessageOwnership(msg, { embed }, onDelete);
	}

	@command({
		description: 'Snippet: List snippets matching an optional filter',
		aliases: ['snippets', 'snips'],
	})
	async listSnippets(msg: Message, @optional specifier: string = '*') {
		const limit = 20;
		const matches = await interpretSpecifier(
			msg.author,
			specifier,
			limit + 1,
		);
		return await sendWithMessageOwnership(msg, {
			embed: new MessageEmbed()
				.setColor(BLOCKQUOTE_GREY)
				.setTitle(
					`${
						matches.length > limit ? `${limit}+` : matches.length
					} Matches Found`,
				)
				.setDescription(
					matches
						.slice(0, limit)
						.map(s => `- \`${s.id}\` with **${s.uses}** uses`),
				),
		});
	}

	@command({
		description: 'Snippet: Create or edit a snippet',
		aliases: ['snip', 'snippet'],
	})
	async createSnippet(msg: Message, name: string, @optional source?: string) {
		if (!msg.member) return;

		const linkedMessage = await this.getMessageFromLink(source);

		if (!name) {
			return await sendWithMessageOwnership(
				msg,
				':x: You have to supply a name for the command',
			);
		}

		const id = name.startsWith('!')
			? `${sanitizeIdPart(name.slice(1))}`
			: `${sanitizeIdPart(msg.author.username)}:${sanitizeIdPart(name)}`;
		const existingSnippet = await this.getSnippet(id);

		if (!id.includes(':') && !this.isMod(msg.member))
			return await sendWithMessageOwnership(
				msg,
				":x: You don't have permission to create a global snippet",
			);

		if (
			!this.isMod(msg.member) &&
			existingSnippet &&
			existingSnippet.owner !== msg.author.id
		)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot edit another user's snippet",
			);

		const title = `\`!${id}\`: `;
		const base = {
			id,
			uses: existingSnippet?.uses ?? 0,
			owner: msg.author.id,
			title,
		};
		let data: Omit<Snippet, keyof BaseEntity> | undefined;

		if (source && !linkedMessage) {
			const referencedSnippet = await this.getSnippet(source);
			if (!referencedSnippet)
				return await sendWithMessageOwnership(
					msg,
					':x: Second argument must be a valid discord message link or snippet id',
				);
			data = {
				...referencedSnippet,
				...base,
				title:
					base.title +
					referencedSnippet.title?.split(': ').slice(1).join(': '),
			};
		} else {
			const sourceMessage =
				linkedMessage ??
				(msg.reference?.messageID != null &&
					(await msg.channel.messages.fetch(
						msg.reference?.messageID!,
					)));
			if (!sourceMessage)
				return await sendWithMessageOwnership(
					msg,
					':x: You have to reply or link to a comment to make it a snippet',
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
					description: referencedEmbed.description,
					color: referencedEmbed.color,
					image: referencedEmbed.image?.url,
					url: referencedEmbed.url,
				};
		}

		if (!data)
			return await sendWithMessageOwnership(
				msg,
				':x: Cannot generate a snippet from that message',
			);

		await existingSnippet?.remove();
		await Snippet.create(data).save();
		await sendWithMessageOwnership(
			msg,
			`:white_check_mark: ${
				existingSnippet ? 'Edited' : 'Created'
			} snippet \`${id}\``,
		);
	}

	private async getSnippet(id: string) {
		return await Snippet.findOne(id);
	}

	@command({
		description: 'Snippet: Delete a snippet you own',
		aliases: ['deleteSnip'],
	})
	async deleteSnippet(msg: Message, id: string) {
		if (!msg.member) return;
		const snippet = await this.getSnippet(id);
		if (!snippet)
			return await sendWithMessageOwnership(
				msg,
				':x: No snippet found with that id',
			);
		if (!this.isMod(msg.member) && snippet.owner !== msg.author.id)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot delete another user's snippet",
			);
		await snippet.remove();
		sendWithMessageOwnership(msg, ':white_check_mark: Deleted snippet');
	}

	private isMod(member: GuildMember | null) {
		return member?.hasPermission('MANAGE_MESSAGES') ?? false;
	}

	private async getMessageFromLink(messageLink: string | undefined) {
		const messageLinkExec = DISCORD_MESSAGE_LINK_REGEX_ANCHORED.exec(
			messageLink ?? '',
		);
		if (!messageLinkExec) return;
		const guild = this.client.guilds.cache.get(messageLinkExec[1]);
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
