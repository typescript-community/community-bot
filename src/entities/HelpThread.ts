import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class HelpThread extends BaseEntity {
	@PrimaryColumn()
	threadId!: string;

	@Column()
	ownerId!: string;

	// When @helper was last pinged
	@Column({ nullable: true })
	helperTimestamp?: string;

	// When the title was last set
	@Column({ nullable: true })
	titleSetTimestamp?: string;
}
