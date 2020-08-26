import {
	Entity,
	BaseEntity,
	PrimaryGeneratedColumn,
	ManyToOne,
	CreateDateColumn,
} from 'typeorm';
import { RepUser } from './RepUser';

@Entity()
export class RepGive extends BaseEntity {
	@PrimaryGeneratedColumn()
	id!: number;

	@ManyToOne(type => RepUser, ru => ru.given, {
		nullable: false,
		eager: true,
	})
	from!: RepUser;

	@ManyToOne(type => RepUser, ru => ru.got, { nullable: false, eager: true })
	to!: RepUser;

	@CreateDateColumn()
	createdAt!: Date;
}
