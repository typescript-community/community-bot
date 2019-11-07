import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('repcooldowns')
export class RepCooldownEntity {
    @PrimaryColumn()
    public id!: string; // the user id

    @Column({ default: 3 })
    public left!: number;

    @Column({ type: 'bigint' })
    public updated!: number; // Date.now()
}
