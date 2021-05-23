import { Module, listener } from 'cookiecord';
import { Message, GuildMember } from 'discord.js';
import { rulesChannelId } from '../env';

// Most job posts are in this format:
// > [FOR HIRE][REMOTE][SOMETHING ELSE]
// > Hi, I'm ponyman6000. Hire me!
const jobPostRegex = /^(?:\[[A-Z ]+\]){2,}\n/i;

// If more than RAID_JOINS occur in RAID_SECONDS, we're probably getting raided.
const RAID_JOINS = 4;
const RAID_SECONDS = 7;

export class ModModule extends Module {
	bannedUpTo = 0; // To avoid double banning
	joins: GuildMember[] = [];

	@listener({ event: 'message' })
	async onJobMessage(msg: Message) {
		if (msg.author.bot || !jobPostRegex.test(msg.content)) return;
		await msg.delete();
		await msg.channel.send(
			`${msg.author} We don't do job posts here; see <#${rulesChannelId}>`,
		);
	}

	@listener({ event: 'guildMemberAdd' })
	async onJoin(member: GuildMember) {
		const now = Date.now();
		const lowerBound = now - RAID_SECONDS * 1000;

		this.joins.push(member);

		// Clean up joins from from outside of our raid threshold.
		while ((this.joins[0].joinedTimestamp ?? 0) < lowerBound) {
			this.joins.splice(0, 1);
			this.bannedUpTo = Math.max(this.bannedUpTo - 1, 0);
		}

		// Ban everyone that just joined
		if (this.joins.length > RAID_JOINS) {
			const start = this.bannedUpTo;
			this.bannedUpTo = this.joins.length;

			await Promise.all(
				this.joins
					.slice(start)
					.map(m => m.ban({ reason: 'Raid', days: 1 })),
			);
		}
	}
}
