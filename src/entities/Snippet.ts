import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Snippet extends BaseEntity {
	@PrimaryColumn()
	id!: string;

	@Column()
	owner!: string;

	@Column()
	uses!: number;

	@Column({ nullable: true })
	content?: string;

	@Column({ nullable: true })
	title?: string;

	@Column({ nullable: true })
	description?: string;

	@Column({ nullable: true })
	color?: number;

	@Column({ nullable: true })
	image?: string;

	@Column({ nullable: true })
	url?: string;
}
