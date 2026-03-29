import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class HelpThread extends BaseEntity {
	@PrimaryColumn({ type: String })
	threadId!: string;

	@Column({ type: String })
	ownerId!: string;

	// When @helper was last pinged
	@Column({ nullable: true, type: String })
	helperTimestamp?: string;

	/**
	 * When the title was last set, exists only for backwards compat
	 * @deprecated
	 */
	@Column({ nullable: true, type: String })
	titleSetTimestamp?: string;

	/**
	 * The id of the original message, exists only for backwards compat
	 * @deprecated
	 */
	@Column({ nullable: true, type: String })
	origMessageId?: string;
}
