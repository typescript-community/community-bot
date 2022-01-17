import {
	GuildMember,
	Message,
	MessageEmbed,
	MessageReaction,
	ReactionCollector,
	TextChannel,
	User,
} from 'discord.js';

const emojis = {
	back: '◀',
	first: '⏮',
	last: '⏭',
	next: '▶',
	stop: '⏹',
};

export class Paginator {
	private message!: Message;
	private curPage = 0;

	private collector!: ReactionCollector;

	public constructor(
		private readonly embed: MessageEmbed,
		private readonly pages: string[],
		private readonly member: GuildMember,
		private readonly channel: TextChannel,
		private readonly timeout: number = 100000,
	) {
		this.init();
	}

	private async init(): Promise<void> {
		this.message = await this.channel.send(
			this.embed
				.setDescription(this.pages[this.curPage])
				.setFooter(`Page ${this.curPage + 1} of ${this.pages.length}`),
		);

		if (this.pages.length === 1) return;

		await this.message.react(emojis.first);
		await this.message.react(emojis.back);
		await this.message.react(emojis.stop);
		await this.message.react(emojis.next);
		await this.message.react(emojis.last);

		this.collector = this.message.createReactionCollector(
			(reaction, user) =>
				reaction.me &&
				user.id === this.member.id &&
				user.id !== this.message.author!.id,
			{ time: this.timeout },
		);

		this.collector.on(
			'collect',
			async (reaction: MessageReaction, user: User) => {
				await reaction.users.remove(user);

				switch (reaction.emoji.toString()) {
					case emojis.first:
						this.curPage = 0;
						break;
					case emojis.last:
						this.curPage = this.pages.length - 1;
						break;
					case emojis.stop:
						await this.message.reactions.removeAll();
						break;
					case emojis.back:
						this.curPage--;
						if (this.curPage < 0)
							this.curPage = this.pages.length - 1;
						break;
					case emojis.next:
						this.curPage++;
						if (this.curPage > this.pages.length - 1)
							this.curPage = 0;
						break;
				}

				await this.refresh();
			},
		);

		this.collector.on('end', () => {
			this.message.reactions.removeAll();
		});
	}

	private async refresh(): Promise<void> {
		await this.message.edit(
			this.embed
				.setDescription(this.pages[this.curPage])
				.setFooter(`Page ${this.curPage + 1} of ${this.pages.length}`),
		);
	}
}
