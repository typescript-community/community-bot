import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reminders')
export class ReminderEntity {
    @PrimaryGeneratedColumn()
    public id!: string;

    @Column()
    public length!: number; // in ms

    @Column({ type: 'bigint' })
    public createdAt!: number; // Date.now()

    @Column()
    public member!: string; // their id

    @Column({ nullable: true })
    public reason!: string;

    @Column()
    public messageLink!: string;
}
