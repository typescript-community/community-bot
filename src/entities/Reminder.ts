import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('reminders')
export class ReminderEntity {
    @PrimaryGeneratedColumn()
    id: string;

    @Column()
    length: number; // in ms

    @Column({ type: 'bigint' })
    createdAt: number; // Date.now()

    @Column()
    member: string; // their id

    @Column({ nullable: true })
    reason: string;

    @Column()
    messageLink: string;
}
