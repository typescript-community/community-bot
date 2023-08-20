import { MessageCreateOptions, MessageMentionTypes } from 'discord.js';

/**
 * Roughly based on Discord.js's EmbedBuilder, but doesn't build an embed
 * so that bot messages for users with embeds turned off work nicely.
 *
 * By default, disables mentions.
 */
export class MessageBuilder {
	private author?: string | null = null;
	private title?: string | null = null;
	private url?: string | null = null;
	private description?: string | null = null;
	private fields: { name: string; value: string }[] = [];
	private footer?: string | null = null;
	private allowMentions: MessageMentionTypes[] = [];

	setAuthor(name: string | null | undefined): this {
		this.author = name;
		return this;
	}

	setTitle(title: string | null | undefined): this {
		this.title = title;
		return this;
	}

	setURL(url: string | null | undefined): this {
		this.url = url;
		return this;
	}

	setDescription(description: string | null | undefined): this {
		this.description = description;
		return this;
	}

	addFields(...fields: { name: string; value: string }[]): this {
		this.fields.push(...fields);
		return this;
	}

	setFooter(footer: string | null | undefined): this {
		this.footer = footer;
		return this;
	}

	setAllowMentions(...mentions: MessageMentionTypes[]): this {
		this.allowMentions = mentions;
		return this;
	}

	build(): MessageCreateOptions {
		const message: string[] = [];

		if (this.author) {
			message.push(this.author);
		}

		if (this.title) {
			if (this.url) {
				message.push(`## [${this.title}](<${this.url}>)`);
			} else {
				message.push(`## ${this.title}`);
			}
		}

		if (this.description) {
			message.push(this.description);
		}

		for (const field of this.fields) {
			message.push(`### ${field.name}`);
			message.push(field.value);
		}

		if (this.footer) {
			message.push('', this.footer);
		}

		return {
			content: message.join('\n'),
			allowedMentions: { parse: this.allowMentions },
		};
	}
}
