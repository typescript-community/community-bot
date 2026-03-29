import { Entity, BaseEntity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Rep extends BaseEntity {
	@PrimaryColumn({ type: String })
	messageId!: string;

	@Column({ type: String })
	date!: string;

	@Column({ type: String })
	channel!: string;

	@Column({ type: Number })
	amount!: number;

	@Column({ type: String })
	recipient!: string;

	@Column({ type: String })
	initialGiver!: string;
}
