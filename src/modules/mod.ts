import { Module, listener } from 'cookiecord';
import { Message, GuildMember } from 'discord.js';
import { rulesChannelId, staffChannelId } from '../env';

// Most job posts are in this format:
// > [FOR HIRE][REMOTE][SOMETHING ELSE]
// > Hi, I'm ponyman6000. Hire me!
const jobPostRegex = /^(?:\[[A-Z ]+\]){2,}\n/i;

// If more than RAID_JOINS occur in RAID_SECONDS, we're probably getting raided.
const RAID_JOINS = 4;
const RAID_SECONDS = 7;

// Until this time passes, any joins are probably still part of the raid.
const RAID_DELAY = 5 * 60 * 1000;

export class ModModule extends Module {
	bannedUpTo = 0; // To avoid double banning
	raidEnd = 0;
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

		if (this.joins.length > RAID_JOINS) {
			if (now < this.raidEnd) {
				const channel = member.guild.channels.resolve(staffChannelId);
				if (channel?.isText()) {
					channel.send(
						'@Moderator detected a raid in progress, starting auto ban.',
					);
				}
			}
			this.raidEnd = now + RAID_DELAY;
		}

		// Ban everyone that joins during the raid
		if (now < this.raidEnd) {
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
