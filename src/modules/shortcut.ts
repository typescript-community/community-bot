import {
	command,
	default as CookiecordClient,
	Module,
	listener,
} from 'cookiecord';
import { Message, MessageEmbed, User } from 'discord.js';
import { send } from 'process';
import { BaseEntity, DeepPartial, ObjectType } from 'typeorm';
import { Shortcut } from '../entities/Shortcut';
import { TS_BLUE } from '../env';
import { sendWithMessageOwnership } from '../util/send';

// https://stackoverflow.com/a/3809435
const LINK_REGEX = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/;

export class ShortcutModule extends Module {
	constructor(client: CookiecordClient) {
		super(client);
	}

	@listener({ event: 'message' })
	async runShortcut(msg: Message) {
		const { content } = msg;
		const commandPart = content.split(' ')[0];
		if (!commandPart.startsWith('!')) return;
		const id = commandPart.slice(1);
		if (this.client.commandManager.getByTrigger(id)) return;
		const shortcut = await this.getShortcut(id);
		if (!shortcut) return;
		if (shortcut.content)
			return await sendWithMessageOwnership(msg, shortcut.content);
		const owner = await this.client.users.fetch(shortcut.owner);
		const embed = new MessageEmbed({
			...shortcut,
			image: undefined,
		});
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
		const [name, ...titleParts] = arg.split(' ');
		const title = titleParts?.join(' ') ?? '';

		if (!name) {
			return await sendWithMessageOwnership(
				msg,
				':x: You have to supply a name for the command',
			);
		}

		const id = this.getId(msg.author, name);
		const existingShortcut = await this.getShortcut(id);

		if (existingShortcut && existingShortcut.owner !== msg.author.id)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot edit another's shortcut",
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
		aliases: ['ls'],
		description: 'Shortcut: List the most used shortcuts',
	})
	async listShortcuts(msg: Message) {
		const shortcuts: Shortcut[] = await Shortcut.createQueryBuilder()
			.select(['id', 'uses'])
			.orderBy('uses', 'DESC')
			.limit(10)
			.getRawMany();
		await sendWithMessageOwnership(msg, {
			embed: new MessageEmbed()
				.setTitle('Top 10 Shortcuts')
				.setColor(TS_BLUE)
				.setDescription(
					shortcuts.map(
						shortcut =>
							`- \`${shortcut.id}\` with **${shortcut.uses}** uses.`,
					),
				),
		});
	}

	@command({
		aliases: ['lsm'],
		description: 'Shortcut: List shortcuts owned by you',
	})
	async listMyShortcuts(msg: Message) {
		const shortcuts: Shortcut[] = await Shortcut.createQueryBuilder()
			.select(['id', 'owner', 'uses'])
			.where('owner = :userId')
			.orderBy('id', 'DESC')
			.setParameters({ userId: msg.author.id })
			.getRawMany();
		await sendWithMessageOwnership(msg, {
			embed: new MessageEmbed()
				.setTitle('Your Shortcuts')
				.setColor(TS_BLUE)
				.setDescription(
					shortcuts.map(shortcut => `- \`${shortcut.id}\``),
				),
		});
	}

	@command({
		description: 'Shortcut: Delete a shortcut you own',
	})
	async deleteShortcut(msg: Message, id: string) {
		const shortcut = await this.getShortcut(id);
		if (!shortcut)
			return await sendWithMessageOwnership(
				msg,
				':x: No shortcut with that id',
			);
		if (shortcut.owner !== msg.author.id)
			return await sendWithMessageOwnership(
				msg,
				":x: Cannot delete another's shortcut",
			);
		await shortcut.remove();
		sendWithMessageOwnership(msg, ':white_check_mark: Deleted shortcut');
	}

	private getId(user: User, name: string) {
		const sanitize = (part: string) =>
			part.toLowerCase().replace(/[^\w-]/g, '');
		return `${sanitize(user.username)}:${sanitize(name)}`;
	}
}
