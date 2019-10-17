import { Entity, Column, PrimaryColumn } from 'typeorm';

@Entity('reps')
export class RepEntity {
	@PrimaryColumn()
	id: string; // the user id

	@Column({ default: 0 })
	rep: number;
}
