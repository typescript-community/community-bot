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
import { Shortcut } from '../entities/Shortcut';
import { BLOCKQUOTE_GREY } from '../env';
import { sendWithMessageOwnership } from '../util/send';

// https://stackoverflow.com/a/3809435
const LINK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

const DISCORD_MESSAGE_LINK_REGEX_ANCHORED = /^https:\/\/discord.com\/channels\/(\d+)\/(\d+)\/(\d+)$/;

export class ShortcutModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'message' })
	async runShortcut(msg: Message) {
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

		// We already know there's a shortcut under this id from the search
		const shortcut = (await this.getShortcut(match.id))!;

		await addShortcutUses(match.id);
		const onDelete = () => addShortcutUses(match.id, -1);

		if (shortcut.content)
			return await sendWithMessageOwnership(
				msg,
				shortcut.content,
				onDelete,
			);

		const owner = await this.client.users.fetch(shortcut.owner);
		const embed = new MessageEmbed({
			...shortcut,
			// image is in an incompatible format, so we have to set it later
			image: undefined,
		});
		if (match.id.includes(':'))
			embed.setAuthor(owner.tag, owner.displayAvatarURL());
		if (shortcut.image) embed.setImage(shortcut.image);
		await sendWithMessageOwnership(msg, { embed }, onDelete);
	}

	@command({
		description: 'Shortcut: List shortcuts matching an optional filter',
		aliases: ['shortcuts'],
	})
	async listShortcuts(msg: Message, @optional specifier: string = '*') {
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
		description: 'Shortcut: Create or edit a shortcut',
	})
	async shortcut(msg: Message, name: string, @optional messageLink?: string) {
		if (!msg.member) return;

		const linkedMessage =
			messageLink === undefined
				? undefined
				: await this.getMessageFromLink(messageLink);
		if (messageLink && !linkedMessage)
			return await sendWithMessageOwnership(
				msg,
				':x: Second argument must be a valid link to a discord message',
			);

		if (!name) {
			return await sendWithMessageOwnership(
				msg,
				':x: You have to supply a name for the command',
			);
		}

		const id = name.startsWith('!')
			? `${sanitizeIdPart(name.slice(1))}`
			: `${sanitizeIdPart(msg.author.username)}:${sanitizeIdPart(name)}`;
		const existingShortcut = await this.getShortcut(id);

		const globalShortcut = !id.includes(':');

		if (globalShortcut && !this.isMod(msg.member))
			return await sendWithMessageOwnership(
				msg,
				":x: You don't have permission to create a global shortcut",
			);

		if (
			!this.isMod(msg.member) &&
			existingShortcut &&
			existingShortcut.owner !== msg.author.id
		)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot edit another user's shortcut",
			);

		const sourceMessage =
			linkedMessage ??
			(msg.reference?.messageID != null &&
				(await msg.channel.messages.fetch(msg.reference?.messageID!)));
		if (!sourceMessage)
			return await sendWithMessageOwnership(
				msg,
				':x: You have to reply or link to a comment to make it a shortcut',
			);

		const description = sourceMessage.content;
		const referencedEmbed = sourceMessage.embeds[0];
		const base = {
			id,
			uses: existingShortcut?.uses ?? 0,
			owner: msg.author.id,
		};

		const title = `\`!${id}\`:`;

		let data: Omit<Shortcut, keyof BaseEntity> | undefined;
		if (LINK_REGEX.exec(description)?.[0] === description)
			data = {
				...base,
				content: description,
			};
		else if (description)
			data = {
				...base,
				title,
				description,
				color: parseInt(BLOCKQUOTE_GREY.slice(1), 16),
			};
		else if (referencedEmbed)
			data = {
				...base,
				title: referencedEmbed
					? `${title} ${referencedEmbed.title}`
					: title,
				description: referencedEmbed.description,
				color: referencedEmbed.color,
				image: referencedEmbed.image?.url,
				url: referencedEmbed.url,
			};

		if (!data)
			return await sendWithMessageOwnership(
				msg,
				':x: Cannot generate a shortcut from that message',
			);

		await existingShortcut?.remove();
		await Shortcut.create(data).save();
		await sendWithMessageOwnership(
			msg,
			`:white_check_mark: ${
				existingShortcut ? 'Edited' : 'Created'
			} shortcut \`${id}\``,
		);
	}

	private async getShortcut(id: string) {
		return await Shortcut.findOne(id);
	}

	@command({
		description: 'Shortcut: Delete a shortcut you own',
	})
	async deleteShortcut(msg: Message, id: string) {
		if (!msg.member) return;
		const shortcut = await this.getShortcut(id);
		if (!shortcut)
			return await sendWithMessageOwnership(
				msg,
				':x: No shortcut found with that id',
			);
		if (!this.isMod(msg.member) && shortcut.owner !== msg.author.id)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot delete another user's shortcut",
			);
		await shortcut.remove();
		sendWithMessageOwnership(msg, ':white_check_mark: Deleted shortcut');
	}

	private isMod(member: GuildMember | null) {
		return member?.hasPermission('MANAGE_MESSAGES') ?? false;
	}

	private async getMessageFromLink(messageLink: string) {
		const messageLinkExec = DISCORD_MESSAGE_LINK_REGEX_ANCHORED.exec(
			messageLink || '',
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
): Promise<ShortcutInfo[]> => {
	specifier = specifier.replace(/\\/g, '');
	if (/[^\w:*%]/.test(specifier)) return [];
	// `%` is SQL's /.*/g for LIKE
	specifier = specifier.replace(/\*/g, '%');
	const baseQuery = () =>
		Shortcut.createQueryBuilder()
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

const addShortcutUses = async (id: string, amount = 1) => {
	await Shortcut.createQueryBuilder()
		.update()
		.where('id = :id')
		.set({ uses: () => 'uses + :amount' })
		.setParameters({ id, amount })
		.execute();
};

type ShortcutInfo = Pick<Shortcut, 'id' | 'uses'>;
