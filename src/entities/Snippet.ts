import { BaseEntity, Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class Snippet extends BaseEntity {
	@PrimaryColumn({ type: String })
	id!: string;

	@Column({ type: String })
	owner!: string;

	@Column({ type: Number })
	uses!: number;

	@Column({ nullable: true, type: String })
	content?: string;

	@Column({ nullable: true, type: String })
	title?: string;

	@Column({ nullable: true, type: String })
	description?: string;

	@Column({ nullable: true, type: Number })
	color?: number;

	@Column({ nullable: true, type: String })
	image?: string;

	@Column({ nullable: true, type: String })
	url?: string;
}
