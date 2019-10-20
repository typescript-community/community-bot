import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rephistory')
export class HistoryEntity {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    from: string;

    @Column()
    to: string;

    @Column({ type: 'bigint' })
    date: number;

    @Column()
    messageLink: string;
}
