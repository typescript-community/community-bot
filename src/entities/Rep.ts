import { Entity, BaseEntity, PrimaryColumn, Column } from 'typeorm';

@Entity()
export class Rep extends BaseEntity {
	@PrimaryColumn()
	messageId!: string;

	@Column()
	date!: string;

	@Column()
	channel!: string;

	@Column()
	amount!: number;

	@Column()
	recipient!: string;

	@Column()
	initialGiver!: string;
}
