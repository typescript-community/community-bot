import { id } from 'common-tags';
import {
	command,
	default as CookiecordClient,
	Module,
	listener,
} from 'cookiecord';
import { GuildMember, Message, MessageEmbed } from 'discord.js';
import { BaseEntity } from 'typeorm';
import { Shortcut } from '../entities/Shortcut';
import { BLOCKQUOTE_GREY, TS_BLUE } from '../env';
import { sendWithMessageOwnership } from '../util/send';

// https://stackoverflow.com/a/3809435
const LINK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

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
		const command = commandPart.slice(matchingPrefix.length);
		if (this.client.commandManager.getByTrigger(command)) return;

		const limit = 20;
		if (!command.includes(':') || /[^\w*:]/.test(command)) return;
		const matches = (await Shortcut.createQueryBuilder()
			.select(['id', 'uses'])
			.where('id like :filter')
			.orderBy('uses', 'DESC')
			.limit(limit + 1)
			.setParameters({ filter: command.replace(/\*/g, '%') })
			.getRawMany()) as { id: string; uses: string }[];

		if (!matches.length)
			return await sendWithMessageOwnership(
				msg,
				':x: No matching shortcuts found',
			);
		if (matches.length > 1)
			return await sendWithMessageOwnership(msg, {
				embed: new MessageEmbed()
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
							.map(s => `- \`${s.id}\` with **${s.uses}** uses`),
					),
			});

		const id = matches[0].id;
		// We already know there's a shortcut under this id from the search
		const shortcut = (await this.getShortcut(id))!;

		if (shortcut.content)
			return await sendWithMessageOwnership(msg, shortcut.content);

		const owner = await this.client.users.fetch(shortcut.owner);
		const embed = new MessageEmbed({
			...shortcut,
			// image is in an incompatible format, so we have to set it later
			image: undefined,
		});
		if (!id.startsWith(':'))
			embed.setAuthor(owner.tag, owner.displayAvatarURL());
		if (shortcut.image) embed.setImage(shortcut.image);
		await sendWithMessageOwnership(msg, { embed });
		await Shortcut.createQueryBuilder()
			.update()
			.set({ uses: () => 'uses + 1' })
			.execute();
	}

	@command({
		single: true,
		description: 'Shortcut: Create or edit a shortcut',
	})
	async shortcut(msg: Message, arg: string) {
		if (!msg.member) return;

		const [name, ...titleParts] = arg.split(' ');
		const title = titleParts?.join(' ') ?? '';

		if (!name) {
			return await sendWithMessageOwnership(
				msg,
				':x: You have to supply a name for the command',
			);
		}

		const sanitizeIdPart = (part: string) =>
			part.toLowerCase().replace(/[^\w-]/g, '');
		const id = name.startsWith(':')
			? `:${sanitizeIdPart(name.slice(1))}`
			: `${sanitizeIdPart(msg.author.username)}:${sanitizeIdPart(name)}`;
		const existingShortcut = await this.getShortcut(id);

		const globalShortcut = id.startsWith(':');

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

		const referencedMessage = await msg.channel.messages.fetch(
			msg.reference?.messageID!,
		);
		if (!referencedMessage)
			return await sendWithMessageOwnership(
				msg,
				':x: You have to reply to a comment to make it a shortcut',
			);

		const description = referencedMessage.content;
		const referencedEmbed = referencedMessage.embeds[0];
		const base = {
			id,
			uses: existingShortcut?.uses ?? 0,
			owner: msg.author.id,
		};

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
				title:
					referencedEmbed.title && title
						? `${title}: ${referencedEmbed.title}`
						: referencedEmbed.title || title,
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
}
