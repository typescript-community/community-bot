import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';

@Entity()
export class Reminder extends BaseEntity {
	@PrimaryGeneratedColumn()
	id!: number;

	@Column()
	userID!: string;

	@Column({ type: 'bigint' })
	date!: number;

	@Column()
	message!: string;
}
