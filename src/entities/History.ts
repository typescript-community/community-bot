import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('rephistory')
export class HistoryEntity {
    @PrimaryGeneratedColumn()
    public id!: string;

    @Column()
    public from!: string;

    @Column()
    public to!: string;

    @Column({ type: 'bigint' })
    public date!: number;

    @Column()
    public messageLink!: string;
}
