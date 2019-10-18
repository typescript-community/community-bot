import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity('repcooldowns')
export class RepCooldownEntity {
    @PrimaryColumn()
    id: string; // the user id

    @Column({ default: 3 })
    left: number;

    @Column({ type: 'bigint' })
    updated: number; // Date.now()
}
