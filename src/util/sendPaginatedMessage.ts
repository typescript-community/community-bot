import {
	RepliableInteraction,
	ThumbnailBuilder,
	ContainerBuilder,
	SectionBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	TextDisplayBuilder,
	resolveColor,
} from 'discord.js';
import { TS_BLUE } from '../env';

const emojis = {
	back: '◀',
	first: '⏮',
	last: '⏭',
	next: '▶',
	stop: '⏹',
};

export async function sendPaginatedMessage(
	thumbnail: ThumbnailBuilder,
	pages: string[],
	interaction: RepliableInteraction,
	timeout: number = 100000,
) {
	const section = new SectionBuilder().setThumbnailAccessory(thumbnail);
	const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder().setCustomId(emojis.first).setEmoji(emojis.first),
		new ButtonBuilder().setCustomId(emojis.back).setEmoji(emojis.back),
		new ButtonBuilder().setCustomId(emojis.stop).setEmoji(emojis.stop),
		new ButtonBuilder().setCustomId(emojis.next).setEmoji(emojis.next),
		new ButtonBuilder().setCustomId(emojis.last).setEmoji(emojis.last),
	);
	let curPage = 0;
	const container = new ContainerBuilder()
		.setAccentColor(resolveColor(TS_BLUE))
		.addSectionComponents(
			section.addTextDisplayComponents(text =>
				text.setContent(pages[curPage]),
			),
		);

	if (pages.length > 1) {
		container.addActionRowComponents(row);
		container.addTextDisplayComponents(text =>
			text.setContent(`-# Page ${curPage + 1} of ${pages.length}`),
		);
	}

	const message = await interaction.editReply({
		components: [container],
	});

	const collector = message.createMessageComponentCollector({
		filter: int =>
			int.user.id === interaction.user.id &&
			int.user.id !== message.author.id,
		time: timeout,
	});

	collector.on('collect', async int => {
		switch (int.customId) {
			case emojis.first:
				curPage = 0;
				break;
			case emojis.last:
				curPage = pages.length - 1;
				break;
			case emojis.stop:
				await message.reactions.removeAll();
				break;
			case emojis.back:
				curPage--;
				if (curPage < 0) curPage = pages.length - 1;
				break;
			case emojis.next:
				curPage++;
				if (curPage > pages.length - 1) curPage = 0;
				break;
		}

		container
			.spliceComponents(
				0,
				1,
				section.spliceTextDisplayComponents(0, 1, text =>
					text.setContent(pages[curPage]),
				),
			)
			.spliceComponents(
				2,
				1,
				new TextDisplayBuilder().setContent(
					`-# Page ${curPage + 1} of ${pages.length}`,
				),
			);

		await int.update({
			components: [container],
		});
	});

	collector.on('end', () => {
		container.spliceComponents(1, 2);
		interaction.editReply({
			components: [container],
		});
	});
}
