import { BaseEntity, Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class HelpUser extends BaseEntity {
	@PrimaryGeneratedColumn()
	id!: string;

	@Column()
	userId!: string;

	@Column()
	channelId!: string;
}
