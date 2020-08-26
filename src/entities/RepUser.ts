import { RepGive } from './RepGive';
import { BaseEntity, Entity, OneToMany, PrimaryColumn } from 'typeorm';

const DAY_MS = 86400000;

@Entity()
export class RepUser extends BaseEntity {
	@PrimaryColumn()
	id!: string;

	@OneToMany(type => RepGive, rg => rg.from, { nullable: false })
	got!: Promise<RepGive[]>;

	@OneToMany(type => RepGive, rg => rg.to, { nullable: false })
	given!: Promise<RepGive[]>;

	async sent() {
		return (await this.got).filter(
			x => Date.now() - x.createdAt.getTime() < DAY_MS,
		).length;
	}
}
